"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import type { SaveState } from "@/components/save-form";
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

/** Saves which centers the finder checks. */
export async function saveFinderCenters(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const ids = formData.getAll("centers").filter((v): v is string => typeof v === "string");
  await db.$transaction([
    db.exhibitionCenter.updateMany({ where: { id: { notIn: ids } }, data: { findShows: false } }),
    db.exhibitionCenter.updateMany({ where: { id: { in: ids }, eventsUrl: { not: null } }, data: { findShows: true } }),
  ]);
  refresh(slug);
  return { saved: true };
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
