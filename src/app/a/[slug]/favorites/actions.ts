"use server";

import { revalidatePath } from "next/cache";
import type { SaveState } from "@/components/save-form";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { leadAssignedEmailContent } from "@/lib/lead-assigned";
import { checkLeadLink, MAX_LINKS_PER_LEAD } from "@/lib/lead-links";
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

/** A link on a favorite exhibitor to a file or folder in the account's own storage, e.g. Google Drive or Dropbox. */
export async function addLeadLink(slug: string, exhibitorId: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { user, organization } = await requireMembership(slug);
  const checked = checkLeadLink(formData.get("url"), formData.get("title"));
  if (checked.error !== undefined) return { error: checked.error };
  const item = await db.savedListItem.findFirst({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    select: { listId: true, _count: { select: { links: true } } },
  });
  if (!item) return { error: "This exhibitor is no longer in Favorites." };
  if (item._count.links >= MAX_LINKS_PER_LEAD) return { error: `A favorite can have up to ${MAX_LINKS_PER_LEAD} links. Delete one first.` };
  await db.leadLink.create({
    data: { organizationId: organization.id, listId: item.listId, exhibitorId, url: checked.url, title: checked.title, addedById: user.id },
  });
  revalidatePath(`/a/${slug}/favorites`, "layout");
  return { saved: true };
}

/** Takes a link off a favorite exhibitor. The file itself stays in the account's storage. */
export async function deleteLeadLink(slug: string, linkId: string) {
  const { organization } = await requireMembership(slug);
  await db.leadLink.deleteMany({ where: { id: linkId, organizationId: organization.id } });
  revalidatePath(`/a/${slug}/favorites`, "layout");
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
