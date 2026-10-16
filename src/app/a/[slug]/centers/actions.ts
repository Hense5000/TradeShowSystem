"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { ImportState } from "@/components/import-form";
import type { SaveState } from "@/components/save-form";
import { centerKey, parseCenterRows } from "@/lib/centers";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import type { EventsPageFillResult } from "@/lib/events-page";
import {
  describeEventsPageError,
  fillMissingEventsPages,
  findEventsPage,
  isEventsPageFinderConfigured,
  missingEventsPageWhere,
} from "@/lib/events-page-run";
import { requirePlatformAdmin } from "@/lib/tenant";
import { type CenterInput, centerSchema, firstError, website } from "@/lib/validation";

const MAX_IMPORT_BYTES = 2_000_000;

/** The id of another center with the same name and city, if there is one. */
async function findDuplicate(input: CenterInput, exceptId?: string) {
  const match = await db.exhibitionCenter.findFirst({
    where: {
      id: exceptId ? { not: exceptId } : undefined,
      name: { equals: input.name, mode: "insensitive" },
      city: input.city ? { equals: input.city, mode: "insensitive" } : null,
    },
    select: { id: true },
  });
  return match?.id;
}

export async function createCenter(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = centerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await findDuplicate(parsed.data)) return { error: `${parsed.data.name} is already in the list.` };

  await db.exhibitionCenter.create({ data: parsed.data });
  revalidatePath(`/a/${slug}/centers`);
  redirect(`/a/${slug}/centers`);
}

export async function updateCenter(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = centerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await findDuplicate(parsed.data, id)) return { error: `Another ${parsed.data.name} is already in the list.` };

  // An emptied events page may be looked up by AI again, e.g. after the website was corrected.
  const data = { ...parsed.data, ...(!parsed.data.eventsUrl && { eventsUrlTriedAt: null }) };
  const { count } = await db.exhibitionCenter.updateMany({ where: { id }, data });
  if (count === 0) return { error: "This center no longer exists." };
  revalidatePath(`/a/${slug}/centers`);
  return { saved: true };
}

export async function deleteCenter(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.exhibitionCenter.deleteMany({ where: { id } });
  revalidatePath(`/a/${slug}/centers`);
  redirect(`/a/${slug}/centers`);
}

export async function importCenters(slug: string, _prev: ImportState, formData: FormData): Promise<ImportState> {
  await requirePlatformAdmin(slug);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "The file is too large. Split it into files under 2 MB." };

  const { items: centers, problems, error } = parseCenterRows(parseCsv(await file.text()));
  if (error) return { error };

  // Leave out centers that are already in the list, so importing the same
  // file twice does not create copies.
  const existing = await db.exhibitionCenter.findMany({ select: { name: true, city: true } });
  const known = new Set(existing.map(centerKey));
  const fresh = centers.filter((c) => !known.has(centerKey(c)));

  if (fresh.length > 0) await db.exhibitionCenter.createMany({ data: fresh });
  revalidatePath(`/a/${slug}/centers`);
  return { imported: fresh.length, alreadyThere: centers.length - fresh.length, problems };
}

const NO_KEY = "Add ANTHROPIC_API_KEY in Vercel before AI can look up events pages.";

export type EventsPageState = { eventsUrl?: string; website?: string; error?: string };

/** Finds the events page of the center typed in the form. Nothing is saved until the form is. */
export async function findCenterEventsPage(
  slug: string,
  center: { name: string; city: string; country: string; website: string },
): Promise<EventsPageState> {
  await requirePlatformAdmin(slug);
  if (!isEventsPageFinderConfigured()) return { error: NO_KEY };
  if (!center.name.trim()) return { error: "Enter the center's name first." };
  const site = website.safeParse(center.website);
  if (!site.success) return { error: firstError(site.error) };
  try {
    const found = await findEventsPage({
      name: center.name.trim(),
      city: center.city.trim() || null,
      country: center.country.trim() || null,
      website: site.data,
    });
    if (!found) return { error: "AI could not find a page on the center's website that lists its events." };
    return { eventsUrl: found.eventsUrl, ...(found.website && { website: found.website }) };
  } catch (error) {
    return { error: describeEventsPageError(error) };
  }
}

/** How many centers still wait for AI to look up their events page. */
export async function countMissingEventsPages(slug: string): Promise<number> {
  await requirePlatformAdmin(slug);
  if (!isEventsPageFinderConfigured()) return 0;
  return db.exhibitionCenter.count({ where: missingEventsPageWhere });
}

/** Looks up the events pages of a few centers, so the list page can show a progress bar. */
export async function findEventsPageBatch(slug: string): Promise<EventsPageFillResult> {
  await requirePlatformAdmin(slug);
  if (!isEventsPageFinderConfigured()) return { filled: 0, notFound: 0, failed: 0, left: 0, stoppedBy: NO_KEY };
  const result = await fillMissingEventsPages({ budgetMs: 150_000, limit: 5 });
  revalidatePath(`/a/${slug}/centers`);
  return result;
}
