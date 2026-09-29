"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { ImportState } from "@/components/import-form";
import type { SaveState } from "@/components/save-form";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
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

export async function createTradeShow(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = tradeShowSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await findDuplicate(parsed.data)) return { error: `${parsed.data.name} on that start date is already in the list.` };

  await db.tradeShow.create({ data: parsed.data });
  revalidatePath(`/a/${slug}/trade-shows`);
  redirect(`/a/${slug}/trade-shows`);
}

export async function updateTradeShow(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = tradeShowSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await findDuplicate(parsed.data, id)) return { error: `Another ${parsed.data.name} on that start date is already in the list.` };

  const { count } = await db.tradeShow.updateMany({ where: { id }, data: parsed.data });
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

  if (fresh.length > 0) await db.tradeShow.createMany({ data: fresh });
  revalidatePath(`/a/${slug}/trade-shows`);
  return { imported: fresh.length, alreadyThere: items.length - fresh.length, problems };
}
