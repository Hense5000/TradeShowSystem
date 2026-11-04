"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import type { SaveState } from "@/components/save-form";
import { db } from "@/lib/db";
import { hunterAccount } from "@/lib/hunter-run";
import { keyHint, looksLikeHunterKey } from "@/lib/own-contacts";
import { sealSecret } from "@/lib/secret-box";
import { requireMembership } from "@/lib/tenant";
import { contactSchema, emailIntroSchema, firstError, profileSchema } from "@/lib/validation";

export async function updateProfile(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug, "ADMIN", { allowUnpaid: true });
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  await db.organization.update({ where: { id: organization.id }, data: parsed.data });
  revalidatePath(`/a/${slug}`, "layout");
  return { saved: true };
}

export async function updatePrimaryContact(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug, "ADMIN", { allowUnpaid: true });
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

export async function updateEmailIntro(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug, "ADMIN", { allowUnpaid: true });
  const parsed = emailIntroSchema.safeParse({
    emailOffer: formData.get("emailOffer") ?? "",
    emailBenefits: formData.getAll("emailBenefit").map(String),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  // Empty benefits are dropped so the email's bullet list has no gaps.
  const { emailOffer, emailBenefits } = parsed.data;
  await db.organization.update({ where: { id: organization.id }, data: { emailOffer, emailBenefits: emailBenefits.filter(Boolean) } });
  revalidatePath(`/a/${slug}`, "layout");
  return { saved: true };
}

/**
 * Connects the account's own Hunter.io account with its personal API key, so
 * its users look up contacts with its own Hunter credits. The key is checked
 * with Hunter first (free), then stored encrypted and never shown again.
 */
export async function connectHunter(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { user, organization } = await requireMembership(slug, "ADMIN", { allowUnpaid: true });
  const key = String(formData.get("hunterKey") ?? "").trim();
  if (!key) return { error: "Paste your Hunter.io API key." };
  if (!looksLikeHunterKey(key)) return { error: "That does not look like a Hunter.io API key. Copy it from hunter.io → API." };
  let account;
  try {
    account = await hunterAccount(key);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Hunter.io could not be reached. Try again in a moment." };
  }
  if (!account) return { error: "Hunter.io does not accept this key. Check that you copied the whole key from hunter.io → API." };
  const data = { keyCipher: sealSecret(key), keyHint: keyHint(key), connectedById: user.id, connectedAt: new Date() };
  await db.hunterConnection.upsert({ where: { organizationId: organization.id }, create: { organizationId: organization.id, ...data }, update: data });
  revalidatePath(`/a/${slug}`, "layout");
  return { saved: true };
}

/** Removes the account's Hunter.io key. The contacts already found stay with the account. */
export async function disconnectHunter(slug: string): Promise<ActionState> {
  const { organization } = await requireMembership(slug, "ADMIN", { allowUnpaid: true });
  await db.hunterConnection.deleteMany({ where: { organizationId: organization.id } });
  revalidatePath(`/a/${slug}`, "layout");
  return undefined;
}
