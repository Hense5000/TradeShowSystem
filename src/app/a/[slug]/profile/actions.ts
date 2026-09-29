"use server";

import { revalidatePath } from "next/cache";
import type { SaveState } from "@/components/save-form";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { contactSchema, firstError, profileSchema } from "@/lib/validation";


export async function updateProfile(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug, "ADMIN");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await db.organization.update({ where: { id: organization.id }, data: parsed.data });
  revalidatePath(`/a/${slug}`, "layout");
  return { saved: true };
}

export async function updatePrimaryContact(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug, "ADMIN");
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  // There is at most one primary contact per account (unique index in the
  // database), so update it when it exists and create it otherwise.
  const existing = await db.contact.findFirst({
    where: { organizationId: organization.id, isPrimary: true },
    select: { id: true },
  });
  if (existing) {
    await db.contact.update({ where: { id: existing.id }, data: parsed.data });
  } else {
    await db.contact.create({ data: { ...parsed.data, organizationId: organization.id, isPrimary: true } });
  }
  revalidatePath(`/a/${slug}`, "layout");
  return { saved: true };
}
