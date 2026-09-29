"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { ImportState } from "@/components/import-form";
import type { SaveState } from "@/components/save-form";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { organizerKey, parseOrganizerRows } from "@/lib/organizers";
import { requirePlatformAdmin } from "@/lib/tenant";
import { firstError, organizerSchema } from "@/lib/validation";

const MAX_IMPORT_BYTES = 2_000_000;

/** The id of another organizer with the same company name, if there is one. */
async function findDuplicate(name: string, exceptId?: string) {
  const match = await db.exhibitionOrganizer.findFirst({
    where: { id: exceptId ? { not: exceptId } : undefined, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return match?.id;
}

export async function createOrganizer(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = organizerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await findDuplicate(parsed.data.name)) return { error: `${parsed.data.name} is already in the list.` };

  await db.exhibitionOrganizer.create({ data: parsed.data });
  revalidatePath(`/a/${slug}/organizers`);
  redirect(`/a/${slug}/organizers`);
}

export async function updateOrganizer(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = organizerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (await findDuplicate(parsed.data.name, id)) return { error: `Another ${parsed.data.name} is already in the list.` };

  const { count } = await db.exhibitionOrganizer.updateMany({ where: { id }, data: parsed.data });
  if (count === 0) return { error: "This organizer no longer exists." };
  revalidatePath(`/a/${slug}/organizers`);
  return { saved: true };
}

export async function deleteOrganizer(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.exhibitionOrganizer.deleteMany({ where: { id } });
  revalidatePath(`/a/${slug}/organizers`);
  redirect(`/a/${slug}/organizers`);
}

export async function importOrganizers(slug: string, _prev: ImportState, formData: FormData): Promise<ImportState> {
  await requirePlatformAdmin(slug);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "The file is too large. Split it into files under 2 MB." };

  const { items, problems, error } = parseOrganizerRows(parseCsv(await file.text()));
  if (error) return { error };

  // Leave out organizers that are already in the list, so importing the same
  // file twice does not create copies.
  const existing = await db.exhibitionOrganizer.findMany({ select: { name: true } });
  const known = new Set(existing.map(organizerKey));
  const fresh = items.filter((o) => !known.has(organizerKey(o)));

  if (fresh.length > 0) await db.exhibitionOrganizer.createMany({ data: fresh });
  revalidatePath(`/a/${slug}/organizers`);
  return { imported: fresh.length, alreadyThere: items.length - fresh.length, problems };
}
