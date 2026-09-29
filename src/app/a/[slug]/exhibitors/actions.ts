"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { ImportState } from "@/components/import-form";
import type { SaveState } from "@/components/save-form";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { exhibitorKey, parseExhibitorRows } from "@/lib/exhibitors";
import { requirePlatformAdmin } from "@/lib/tenant";
import { exhibitorSchema, firstError } from "@/lib/validation";

const MAX_IMPORT_BYTES = 4_000_000;

const showExists = async (id: string) => Boolean(await db.tradeShow.findUnique({ where: { id }, select: { id: true } }));

/** The id of another exhibitor with the same company name at the same show, if there is one. */
async function findDuplicate(tradeShowId: string, name: string, exceptId?: string) {
  const match = await db.exhibitor.findFirst({
    where: { id: exceptId ? { not: exceptId } : undefined, tradeShowId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return match?.id;
}

export async function createExhibitor(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = exhibitorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await showExists(parsed.data.tradeShowId))) return { error: "Choose the trade show." };
  if (await findDuplicate(parsed.data.tradeShowId, parsed.data.name)) {
    return { error: `${parsed.data.name} is already an exhibitor at that trade show.` };
  }

  await db.exhibitor.create({ data: parsed.data });
  revalidatePath(`/a/${slug}/exhibitors`);
  redirect(`/a/${slug}/exhibitors?show=${parsed.data.tradeShowId}`);
}

export async function updateExhibitor(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = exhibitorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await showExists(parsed.data.tradeShowId))) return { error: "Choose the trade show." };
  if (await findDuplicate(parsed.data.tradeShowId, parsed.data.name, id)) {
    return { error: `Another ${parsed.data.name} is already an exhibitor at that trade show.` };
  }

  const { count } = await db.exhibitor.updateMany({ where: { id }, data: parsed.data });
  if (count === 0) return { error: "This exhibitor no longer exists." };
  revalidatePath(`/a/${slug}/exhibitors`);
  return { saved: true };
}

export async function deleteExhibitor(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.exhibitor.deleteMany({ where: { id } });
  revalidatePath(`/a/${slug}/exhibitors`);
  redirect(`/a/${slug}/exhibitors`);
}

export async function importExhibitors(slug: string, _prev: ImportState, formData: FormData): Promise<ImportState> {
  await requirePlatformAdmin(slug);
  const tradeShowId = String(formData.get("tradeShowId") ?? "");
  if (!tradeShowId || !(await showExists(tradeShowId))) return { error: "Choose the trade show these exhibitors are at." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "The file is too large. Split it into files under 4 MB." };

  const { items, problems, error } = parseExhibitorRows(parseCsv(await file.text()));
  if (error) return { error };

  // Leave out companies already listed at this show, so importing the same
  // file twice does not create copies.
  const existing = await db.exhibitor.findMany({ where: { tradeShowId }, select: { name: true } });
  const known = new Set(existing.map(exhibitorKey));
  const fresh = items.filter((e) => !known.has(exhibitorKey(e)));

  if (fresh.length > 0) await db.exhibitor.createMany({ data: fresh.map((e) => ({ ...e, tradeShowId })) });
  revalidatePath(`/a/${slug}/exhibitors`);
  return { imported: fresh.length, alreadyThere: items.length - fresh.length, problems };
}
