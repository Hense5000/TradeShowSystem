"use server";

import { revalidatePath } from "next/cache";
import type { SaveState } from "@/components/save-form";
import { isCompanyProfileConfigured } from "@/lib/company-profile-run";
import { db } from "@/lib/db";
import { MAX_DRAFT_GOAL, parseDraftLanguage } from "@/lib/email-draft";
import { writeEmailDraft } from "@/lib/email-draft-run";
import { checkFollowUp, checkLeadNote, parseLeadStatus } from "@/lib/leads";
import { requireMembership } from "@/lib/tenant";

// Every member of an account works the same favorites. Each action only
// touches the account in the URL, so no account can change another's.

function refresh(slug: string) {
  revalidatePath(`/a/${slug}/favorites`);
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

/** The user in the account who is responsible for a favorite exhibitor, or no one. */
export async function setLeadAssignee(slug: string, exhibitorId: string, formData: FormData) {
  const { organization } = await requireMembership(slug);
  const chosen = String(formData.get("assignee") ?? "");
  // Only members of this account can be made responsible.
  const member = chosen ? await db.membership.findFirst({ where: { organizationId: organization.id, userId: chosen }, select: { userId: true } }) : null;
  if (chosen && !member) return;
  await db.savedListItem.updateMany({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    data: { assigneeId: member?.userId ?? null, leadUpdatedAt: new Date() },
  });
  refresh(slug);
}

export type DraftState = { subject?: string; body?: string; error?: string } | undefined;

/** Writes a first email to a favorite exhibitor with AI. It is only shown to the user; nothing is sent. */
export async function draftLeadEmail(slug: string, exhibitorId: string, _prev: DraftState, formData: FormData): Promise<DraftState> {
  const { user, organization } = await requireMembership(slug);
  if (!isCompanyProfileConfigured()) return { error: "Add ANTHROPIC_API_KEY in Vercel before AI can write emails." };
  const goal = String(formData.get("goal") ?? "").trim().slice(0, MAX_DRAFT_GOAL);
  const item = await db.savedListItem.findFirst({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    include: { exhibitor: { include: { tradeShow: { select: { name: true, startDate: true, endDate: true, city: true } } } } },
  });
  if (!item) return { error: "This exhibitor is no longer in Favorites." };
  const e = item.exhibitor;
  try {
    return await writeEmailDraft({
      language: parseDraftLanguage(formData.get("language")),
      goal,
      sender: { name: user.name ?? user.email, company: organization.name, website: organization.website },
      exhibitor: e,
      tradeShow: e.tradeShow,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "The AI could not write the email. Try again." };
  }
}

/** The tick on a trade show's meeting plan: the account has visited the exhibitor's booth, or not yet. */
export async function setVisited(slug: string, exhibitorId: string, visited: boolean) {
  const { user, organization } = await requireMembership(slug);
  await db.savedListItem.updateMany({
    where: { exhibitorId, list: { organizationId: organization.id, favorites: true } },
    data: visited ? { visitedAt: new Date(), visitedById: user.id } : { visitedAt: null, visitedById: null },
  });
  revalidatePath(`/a/${slug}/favorites/plan`);
}
