"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { SaveState } from "@/components/save-form";
import { centerKey, parseCenterRows } from "@/lib/centers";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { type CenterInput, centerSchema, firstError } from "@/lib/validation";

export type ImportState = { error?: string; imported?: number; alreadyThere?: number; problems?: string[] } | undefined;

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

  const { count } = await db.exhibitionCenter.updateMany({ where: { id }, data: parsed.data });
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

  const { centers, problems, error } = parseCenterRows(parseCsv(await file.text()));
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
