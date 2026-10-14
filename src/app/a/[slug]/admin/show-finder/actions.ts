"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { db } from "@/lib/db";
import { runShowFinder } from "@/lib/show-finder-run";
import { requirePlatformAdmin } from "@/lib/tenant";
import { firstError, tradeShowSchema } from "@/lib/validation";

function refresh(slug: string) {
  revalidatePath(`/a/${slug}/admin/show-finder`);
  revalidatePath(`/a/${slug}/admin`);
}

export async function setFinderEnabled(slug: string, enabled: boolean): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.showFinderSettings.upsert({ where: { id: 1 }, create: { id: 1, enabled }, update: { enabled } });
  refresh(slug);
  return undefined;
}

/** Turns the finder on or off for one center. */
export async function setCenterChosen(slug: string, id: string, chosen: boolean): Promise<void> {
  await requirePlatformAdmin(slug);
  await db.exhibitionCenter.updateMany({ where: { id, ...(chosen && { eventsUrl: { not: null } }) }, data: { findShows: chosen } });
  refresh(slug);
}

/**
 * Takes a center off the finder: it is no longer checked, and its check day
 * and last check result are cleared. Suggestions already made are kept.
 */
export async function removeCenterFromFinder(slug: string, id: string): Promise<void> {
  await requirePlatformAdmin(slug);
  await db.exhibitionCenter.updateMany({
    where: { id },
    data: { findShows: false, showsCheckDay: null, showsGroupId: null, showsCheckedAt: null, showsCheckError: null, showsCheckNote: null, showsFoundLast: null },
  });
  refresh(slug);
}

/** Sets the day of the month a center is checked on (null: about every four weeks). */
export async function setCenterCheckDay(slug: string, id: string, day: number | null): Promise<void> {
  await requirePlatformAdmin(slug);
  await db.exhibitionCenter.updateMany({ where: { id }, data: { showsCheckDay: validDay(day) } });
  refresh(slug);
}

function validDay(day: number | null): number | null {
  return day !== null && Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

/**
 * Puts a center in a check group, or takes it out (null). Putting it in a
 * group also ticks it, since a group is a set of centers to check.
 */
export async function setCenterGroup(slug: string, id: string, groupId: string | null): Promise<void> {
  await requirePlatformAdmin(slug);
  const group = groupId ? await db.showFinderGroup.findUnique({ where: { id: groupId }, select: { id: true } }) : null;
  await db.exhibitionCenter.updateMany({
    where: { id, ...(group && { eventsUrl: { not: null } }) },
    data: { showsGroupId: group?.id ?? null, ...(group && { findShows: true }) },
  });
  refresh(slug);
}

function groupName(formData: FormData): string {
  return String(formData.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
}

async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const other = await db.showFinderGroup.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true },
  });
  return Boolean(other);
}

/** Creates a named check group, e.g. "Europe". */
export async function createGroup(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  const name = groupName(formData);
  if (!name) return { error: "Give the group a name." };
  if (await nameTaken(name)) return { error: `There is already a group called ${name}.` };
  await db.showFinderGroup.create({ data: { name } });
  refresh(slug);
  return undefined;
}

export async function renameGroup(slug: string, id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  const name = groupName(formData);
  if (!name) return { error: "Give the group a name." };
  if (await nameTaken(name, id)) return { error: `There is already a group called ${name}.` };
  await db.showFinderGroup.updateMany({ where: { id }, data: { name } });
  refresh(slug);
  return undefined;
}

/** Sets the day of the month all the group's centers are checked on (null: about every four weeks). */
export async function setGroupCheckDay(slug: string, id: string, day: number | null): Promise<void> {
  await requirePlatformAdmin(slug);
  await db.showFinderGroup.updateMany({ where: { id }, data: { checkDay: validDay(day) } });
  refresh(slug);
}

/** Deletes a group. Its centers stay chosen, without a group, and go back to their own check day. */
export async function deleteGroup(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.showFinderGroup.deleteMany({ where: { id } });
  refresh(slug);
  return undefined;
}

export type RunState = { error?: string; summary?: string } | undefined;

export async function runFinderNow(slug: string): Promise<RunState> {
  await requirePlatformAdmin(slug);
  try {
    const summary = await runShowFinder({ onlyDue: false });
    refresh(slug);
    return { summary };
  } catch {
    return { error: "The check stopped unexpectedly. Try again in a moment." };
  }
}

/** Checks one center right away, whether or not it is chosen. */
export async function checkCenterNow(slug: string, id: string): Promise<RunState> {
  await requirePlatformAdmin(slug);
  try {
    const summary = await runShowFinder({ onlyDue: false, centerIds: [id] });
    refresh(slug);
    return { summary };
  } catch {
    return { error: "The check stopped unexpectedly. Try again in a moment." };
  }
}

/** Checks the ticked centers of one group right away. */
export async function checkGroupNow(slug: string, groupId: string): Promise<RunState> {
  await requirePlatformAdmin(slug);
  try {
    const summary = await runShowFinder({ onlyDue: false, groupId });
    refresh(slug);
    return { summary };
  } catch {
    return { error: "The check stopped unexpectedly. Try again in a moment." };
  }
}

/** Adds a suggestion to the trade show list, with any corrections made in the form. */
export async function approveSuggestion(slug: string, id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  const suggestion = await db.suggestedShow.findUnique({ where: { id }, include: { center: true } });
  if (!suggestion || suggestion.status !== "PENDING") return { error: "This suggestion has already been handled." };

  const parsed = tradeShowSchema.safeParse({
    name: formData.get("name") ?? "",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    website: formData.get("website") ?? "",
    city: suggestion.center.city ?? "",
    country: suggestion.center.country ?? "",
    exhibitorDirectoryUrl: "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { centerName: _unused, ...data } = parsed.data;

  // If someone added the same show by hand meanwhile, link to that one instead.
  const existing = await db.tradeShow.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" }, startDate: data.startDate },
    select: { id: true },
  });
  const show = existing ?? (await db.tradeShow.create({ data: { ...data, centerId: suggestion.centerId } }));
  await db.suggestedShow.update({
    where: { id },
    data: { status: "APPROVED", decidedAt: new Date(), tradeShowId: show.id },
  });
  refresh(slug);
  revalidatePath(`/a/${slug}/trade-shows`);
  revalidatePath(`/a/${slug}`);
  return undefined;
}

export async function rejectSuggestion(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.suggestedShow.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED", decidedAt: new Date() } });
  refresh(slug);
  return undefined;
}
