"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { ImportState } from "@/components/import-form";
import type { SaveState } from "@/components/save-form";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { withPhoneCountry } from "@/lib/phone-country";
import { checkFoundExhibitors } from "@/lib/exhibitor-fetch";
import { describeFetchError, isExhibitorFetchConfigured, isServiceDown, readDirectoryPage } from "@/lib/exhibitor-fetch-run";
import { exhibitorKey } from "@/lib/exhibitors";
import { requirePlatformAdmin } from "@/lib/tenant";
import { parseTradeShowRows, tradeShowKey } from "@/lib/trade-shows";
import { firstError, type TradeShowInput, tradeShowSchema } from "@/lib/validation";

const MAX_IMPORT_BYTES = 2_000_000;

/** The id of another show with the same name and start date, if there is one. */
async function findDuplicate(input: TradeShowInput, exceptId?: string) {
  const match = await db.tradeShow.findFirst({
    where: {
      id: exceptId ? { not: exceptId } : undefined,
      name: { equals: input.name, mode: "insensitive" },
      startDate: input.startDate,
    },
    select: { id: true },
  });
  return match?.id;
}

/** The fields to save, with the center checked against the list. */
async function toData({ centerName: _unused, ...data }: TradeShowInput) {
  if (data.centerId && !(await db.exhibitionCenter.findUnique({ where: { id: data.centerId }, select: { id: true } }))) {
    data.centerId = null;
  }
  return data;
}

export async function createTradeShow(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = tradeShowSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await findDuplicate(parsed.data)) return { error: `${parsed.data.name} on that start date is already in the list.` };

  await db.tradeShow.create({ data: await toData(parsed.data) });
  revalidatePath(`/a/${slug}/trade-shows`);
  redirect(`/a/${slug}/trade-shows`);
}

export async function updateTradeShow(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = tradeShowSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await findDuplicate(parsed.data, id)) return { error: `Another ${parsed.data.name} on that start date is already in the list.` };

  const { count } = await db.tradeShow.updateMany({ where: { id }, data: await toData(parsed.data) });
  if (count === 0) return { error: "This trade show no longer exists." };
  revalidatePath(`/a/${slug}/trade-shows`);
  return { saved: true };
}

export async function deleteTradeShow(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.tradeShow.deleteMany({ where: { id } });
  revalidatePath(`/a/${slug}/trade-shows`);
  redirect(`/a/${slug}/trade-shows`);
}

export async function importTradeShows(slug: string, _prev: ImportState, formData: FormData): Promise<ImportState> {
  await requirePlatformAdmin(slug);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "The file is too large. Split it into files under 2 MB." };

  const { items, problems, error } = parseTradeShowRows(parseCsv(await file.text()));
  if (error) return { error };

  // Leave out shows that are already in the list, so importing the same file
  // twice does not create copies.
  const existing = await db.tradeShow.findMany({ select: { name: true, startDate: true } });
  const known = new Set(existing.map(tradeShowKey));
  const fresh = items.filter((s) => !known.has(tradeShowKey(s)));

  // Find each show's center by name in the centers list.
  const centers = await db.exhibitionCenter.findMany({ select: { id: true, name: true } });
  const centerIds = new Map<string, string>();
  for (const c of centers) if (!centerIds.has(c.name.toLowerCase())) centerIds.set(c.name.toLowerCase(), c.id);
  const unknownCenters = new Set<string>();
  const data = fresh.map(({ centerName, ...show }) => {
    const centerId = centerName ? centerIds.get(centerName.toLowerCase()) : undefined;
    if (centerName && !centerId) unknownCenters.add(centerName);
    return { ...show, centerId: centerId ?? null };
  });
  for (const name of unknownCenters) {
    problems.push(`"${name}" is not in the exhibition centers list, so shows there were saved without a center.`);
  }

  if (data.length > 0) await db.tradeShow.createMany({ data });
  revalidatePath(`/a/${slug}/trade-shows`);
  return { imported: fresh.length, alreadyThere: items.length - fresh.length, problems };
}

export type FetchPageResult = {
  error?: string;
  /** The AI service itself failed (bad key, no credit), so reading more pages would fail too. */
  stop?: boolean;
  found: number;
  added: number;
  /** Links to the directory's other pages, as the AI found them. */
  otherPages: string[];
};

const sameSite = (a: string, b: string) => new URL(a).hostname.replace(/^www\./, "") === new URL(b).hostname.replace(/^www\./, "");

/**
 * Reads one page of the trade show's exhibitor directory with AI and adds the
 * exhibitors it lists to the show. Companies already listed at the show are
 * skipped, so fetching again only adds the new ones. The trade show page
 * calls this once per page of the directory, so it can show progress.
 */
export async function fetchExhibitorPage(slug: string, tradeShowId: string, pageUrl: string): Promise<FetchPageResult> {
  await requirePlatformAdmin(slug);
  const none = { found: 0, added: 0, otherPages: [] };
  if (!isExhibitorFetchConfigured()) return { ...none, stop: true, error: "Add ANTHROPIC_API_KEY in Vercel before exhibitors can be fetched." };
  const show = await db.tradeShow.findUnique({ where: { id: tradeShowId }, select: { name: true, exhibitorDirectoryUrl: true } });
  if (!show?.exhibitorDirectoryUrl) return { ...none, stop: true, error: "The trade show has no Exhibitor directory URL." };
  // Only pages on the directory's own site are read.
  try {
    if (!/^https?:/i.test(pageUrl) || !sameSite(pageUrl, show.exhibitorDirectoryUrl)) throw new Error();
  } catch {
    return { ...none, error: "That page is not part of the exhibitor directory." };
  }

  try {
    const page = await readDirectoryPage(show.name, pageUrl);
    const found = checkFoundExhibitors(page.exhibitors, show.exhibitorDirectoryUrl);
    const existing = await db.exhibitor.findMany({ where: { tradeShowId }, select: { name: true } });
    const known = new Set(existing.map(exhibitorKey));
    const fresh = found.filter((e) => !known.has(exhibitorKey(e)));
    if (fresh.length > 0) await db.exhibitor.createMany({ data: fresh.map((e) => ({ ...withPhoneCountry(e), tradeShowId })) });
    revalidatePath(`/a/${slug}/exhibitors`);
    return { found: found.length, added: fresh.length, otherPages: page.otherPages };
  } catch (error) {
    return { ...none, stop: isServiceDown(error), error: describeFetchError(error) };
  }
}
