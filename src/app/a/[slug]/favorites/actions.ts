"use server";

import { del, head } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import type { SaveState } from "@/components/save-form";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { leadAssignedEmailContent } from "@/lib/lead-assigned";
import { cleanFileName, leadFileContentType, leadFileFolder, MAX_FILES_PER_LEAD, MAX_LEAD_FILE_BYTES } from "@/lib/lead-files";
import { isFileStoreConfigured } from "@/lib/lead-files-run";
import { checkFollowUp, checkLeadNote, parseLeadStatus } from "@/lib/leads";
import { parseProjectValue } from "@/lib/project-value";
import { requireMembership } from "@/lib/tenant";

// Every member of an account works the same favorites. Each action only
// touches the account in the URL, so no account can change another's.

function refresh(slug: string) {
  revalidatePath(`/a/${slug}/favorites`, "layout");
  revalidatePath(`/a/${slug}`); // the dashboard counts the open leads
}

/** The star on the Trade shows page: adds the show to the account's favorites, or takes it off. */
export async function toggleFavoriteShow(slug: string, tradeShowId: string, add: boolean) {
  const { user, organization } = await requireMembership(slug);
  if (add) {
    const show = await db.tradeShow.findUnique({ where: { id: tradeShowId }, select: { id: true } });
    if (!show) return;
    await db.favoriteShow.createMany({ data: [{ organizationId: organization.id, tradeShowId, addedById: user.id }], skipDuplicates: true });
  } else {
    await db.favoriteShow.deleteMany({ where: { organizationId: organization.id, tradeShowId } });
  }
  refresh(slug);
  revalidatePath(`/a/${slug}/trade-shows`);
}

/** The status of a favorite exhibitor, e.g. Contacted or Won. */
export async function setLeadStatus(slug: string, exhibitorId: string, formData: FormData) {
  const { organization } = await requireMembership(slug);
  const status = parseLeadStatus(formData.get("status"));
  if (!status) return;
  await db.savedListItem.updateMany({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    data: { leadStatus: status, leadUpdatedAt: new Date() },
  });
  refresh(slug);
}

/** The account's own notes about a favorite exhibitor. */
export async function saveLeadNote(slug: string, exhibitorId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug);
  const checked = checkLeadNote(formData.get("note"));
  if (checked.error !== undefined) return { error: checked.error };
  const { count } = await db.savedListItem.updateMany({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    data: { leadNote: checked.note, leadUpdatedAt: new Date() },
  });
  if (count === 0) return { error: "This exhibitor is no longer in Favorites." };
  refresh(slug);
  return { saved: true };
}

/** The follow-up reminder on a favorite exhibitor: a date and a short text. No date clears it. */
export async function saveFollowUp(slug: string, exhibitorId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug);
  const checked = checkFollowUp(formData.get("date"), formData.get("note"));
  if (checked.error !== undefined) return { error: checked.error };
  const { count } = await db.savedListItem.updateMany({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    data: { followUpAt: checked.date, followUpNote: checked.note, leadUpdatedAt: new Date() },
  });
  if (count === 0) return { error: "This exhibitor is no longer in Favorites." };
  refresh(slug);
  return { saved: true };
}

/** What the project with a favorite exhibitor is worth. An empty field clears it. */
export async function saveProjectValue(slug: string, exhibitorId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug);
  const checked = parseProjectValue(formData.get("value"));
  if (checked.error !== undefined) return { error: checked.error };
  const { count } = await db.savedListItem.updateMany({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    data: { projectValue: checked.value, leadUpdatedAt: new Date() },
  });
  if (count === 0) return { error: "This exhibitor is no longer in Favorites." };
  refresh(slug);
  return { saved: true };
}

export type AssigneeState = { notified?: string; notifyFailed?: string } | undefined;

/**
 * The user in the account who is responsible for a favorite exhibitor, or no one.
 * When it is another user than the one signed in, they get an email about it.
 */
export async function setLeadAssignee(slug: string, exhibitorId: string, _prev: AssigneeState, formData: FormData): Promise<AssigneeState> {
  const { user, organization } = await requireMembership(slug);
  const chosen = String(formData.get("assignee") ?? "");
  // Only members of this account can be made responsible.
  const member = chosen
    ? await db.membership.findFirst({
        where: { organizationId: organization.id, userId: chosen },
        select: { user: { select: { id: true, name: true, email: true } } },
      })
    : null;
  if (chosen && !member) return;
  const where = { exhibitorId, list: { organizationId: organization.id, favorites: true } };
  const before = await db.savedListItem.findFirst({
    where,
    select: { assigneeId: true, exhibitor: { select: { name: true, tradeShow: { select: { name: true } } } } },
  });
  if (!before) return;
  const assignee = member?.user ?? null;
  await db.savedListItem.updateMany({ where, data: { assigneeId: assignee?.id ?? null, leadUpdatedAt: new Date() } });
  refresh(slug);

  if (!assignee || assignee.id === user.id || assignee.id === before.assigneeId) return;
  const who = assignee.name ?? assignee.email;
  if (!isEmailConfigured()) return { notifyFailed: who };
  try {
    await sendEmail({
      to: assignee.email,
      ...leadAssignedEmailContent({
        assignedBy: user.name ?? user.email,
        accountName: organization.name,
        exhibitor: before.exhibitor.name,
        tradeShow: before.exhibitor.tradeShow.name,
        url: `${appUrl()}/a/${slug}/favorites/exhibitors?owner=me`,
      }),
    });
    return { notified: who };
  } catch (e) {
    console.error("Lead assigned email failed", e);
    return { notifyFailed: who };
  }
}

/**
 * Saves a file the browser has just uploaded to the store (through
 * files/upload/route.ts) on a favorite exhibitor. The upload must be in the
 * account's own folder for that favorite; anything else is deleted again.
 */
export async function addLeadFile(slug: string, exhibitorId: string, pathname: string, fileName: string): Promise<SaveState> {
  const { user, organization } = await requireMembership(slug);
  if (!isFileStoreConfigured()) return { error: "File uploads are not set up yet." };
  if (!pathname.startsWith(leadFileFolder(organization.id, exhibitorId)) || pathname.includes("..")) return { error: "The file could not be saved." };

  const stored = await head(pathname).catch(() => null);
  if (!stored) return { error: "The upload did not finish. Try again." };
  const name = cleanFileName(fileName);
  const item = await db.savedListItem.findFirst({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    select: { listId: true, _count: { select: { files: true } } },
  });
  const problem = !item
    ? "This exhibitor is no longer in Favorites."
    : item._count.files >= MAX_FILES_PER_LEAD
      ? `A favorite can have up to ${MAX_FILES_PER_LEAD} files. Delete one first.`
      : stored.size > MAX_LEAD_FILE_BYTES
        ? "The file is too large."
        : undefined;
  if (problem || !item) {
    await del(pathname).catch(() => {});
    return { error: problem };
  }
  await db.leadFile.create({
    data: {
      organizationId: organization.id,
      listId: item.listId,
      exhibitorId,
      pathname,
      name,
      size: stored.size,
      contentType: leadFileContentType(name) ?? stored.contentType,
      uploadedById: user.id,
    },
  });
  revalidatePath(`/a/${slug}/favorites`, "layout");
  return { saved: true };
}

/** Deletes a file kept with a favorite exhibitor, from the list and from the store. */
export async function deleteLeadFile(slug: string, fileId: string): Promise<SaveState> {
  const { organization } = await requireMembership(slug);
  const file = await db.leadFile.findFirst({ where: { id: fileId, organizationId: organization.id }, select: { id: true, pathname: true } });
  if (!file) return { saved: true }; // already gone
  try {
    await del(file.pathname);
  } catch (e) {
    console.error("Deleting a lead file from the store failed", e);
    return { error: "The file could not be deleted. Try again." };
  }
  await db.leadFile.deleteMany({ where: { id: file.id } });
  revalidatePath(`/a/${slug}/favorites`, "layout");
  return { saved: true };
}

/** The tick on a trade show's meeting plan: the account has visited the exhibitor's booth, or not yet. */
export async function setVisited(slug: string, exhibitorId: string, visited: boolean) {
  const { user, organization } = await requireMembership(slug);
  // exhibitorId is the company's row at the show; each show keeps its own tick.
  if (visited) {
    if (!(await db.exhibitor.findUnique({ where: { id: exhibitorId }, select: { id: true } }))) return;
    await db.boothVisit.upsert({
      where: { organizationId_exhibitorId: { organizationId: organization.id, exhibitorId } },
      create: { organizationId: organization.id, exhibitorId, visitedById: user.id },
      update: {},
    });
  } else {
    await db.boothVisit.deleteMany({ where: { organizationId: organization.id, exhibitorId } });
  }
  revalidatePath(`/a/${slug}/favorites/plan`);
}

/** "Not interested" on a recommended trade show: it is not recommended to the account again. */
export async function hideRecommendation(slug: string, tradeShowId: string) {
  const { organization } = await requireMembership(slug);
  const show = await db.tradeShow.findUnique({ where: { id: tradeShowId }, select: { id: true } });
  if (!show) return;
  await db.hiddenShowRecommendation.createMany({ data: [{ organizationId: organization.id, tradeShowId }], skipDuplicates: true });
  refresh(slug);
}
