"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { SaveState } from "@/components/save-form";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { billingConfigured, removeUnknownBillingData, stripeTestMode } from "@/lib/stripe";
import { featureSchema } from "@/lib/features";
import { slugify, uniqueSlug } from "@/lib/slug";
import { requirePlatformAdmin } from "@/lib/tenant";
import { firstError } from "@/lib/validation";

function parse(formData: FormData) {
  const parsed = featureSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    rollout: formData.get("rollout") ?? "",
  });
  const accountIds = formData.getAll("accounts").filter((v): v is string => typeof v === "string");
  return { parsed, accountIds };
}

/** Replaces the accounts that get the feature while it is on for selected accounts. */
async function setAccess(featureId: string, accountIds: string[]) {
  const existing = await db.organization.findMany({ where: { id: { in: accountIds } }, select: { id: true } });
  await db.$transaction([
    db.featureAccess.deleteMany({ where: { featureId } }),
    db.featureAccess.createMany({ data: existing.map((o) => ({ featureId, organizationId: o.id })) }),
  ]);
}

function refresh(slug: string) {
  // The menu and the customers' Features page depend on this, in every account.
  revalidatePath("/a/[slug]", "layout");
  revalidatePath(`/a/${slug}/admin`);
}

export async function createFeature(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const { parsed, accountIds } = parse(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const duplicate = await db.feature.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
  if (duplicate) return { error: `${parsed.data.name} is already in the list.` };

  const key = await uniqueSlug(slugify(parsed.data.name), async (k) => (await db.feature.count({ where: { key: k } })) > 0);
  const feature = await db.feature.create({ data: { ...parsed.data, key } });
  await setAccess(feature.id, accountIds);
  refresh(slug);
  redirect(`/a/${slug}/admin`);
}

export async function updateFeature(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const { parsed, accountIds } = parse(formData);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const duplicate = await db.feature.findFirst({
    where: { id: { not: id }, name: { equals: parsed.data.name, mode: "insensitive" } },
  });
  if (duplicate) return { error: `Another feature is already called ${parsed.data.name}.` };

  const { count } = await db.feature.updateMany({ where: { id }, data: parsed.data });
  if (count === 0) return { error: "This feature no longer exists." };
  await setAccess(id, accountIds);
  refresh(slug);
  return { saved: true };
}

export async function deleteFeature(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.feature.deleteMany({ where: { id } });
  refresh(slug);
  redirect(`/a/${slug}/admin`);
}

/** Switches the daily cleanup of trade shows older than three years on or off. */
export async function setCleanupEnabled(slug: string, enabled: boolean): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.tradeShowCleanupSettings.upsert({ where: { id: 1 }, create: { id: 1, enabled }, update: { enabled } });
  revalidatePath(`/a/${slug}/admin`);
  return undefined;
}

export type TestEmailState = { sent?: string; error?: string } | undefined;

/** Sends a test email to the admin, the same way login codes are sent, and shows what Resend answered. */
export async function sendTestEmail(slug: string): Promise<TestEmailState> {
  const { user } = await requirePlatformAdmin(slug);
  if (!isEmailConfigured()) return { error: "RESEND_API_KEY or EMAIL_FROM is missing in Vercel." };
  try {
    await sendEmail({
      to: user.email,
      subject: "Test email from Trade Show System",
      text: "This is a test. Login codes are sent the same way, so they work too.",
      html: "<p>This is a test. Login codes are sent the same way, so they work too.</p>",
    });
    return { sent: `Sent to ${user.email}. Check the inbox (and spam).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export type CleanupBillingState = { done?: string; error?: string } | undefined;

/** Removes test-mode subscriptions, invoices and customers after switching Stripe to live keys. */
export async function removeTestBillingData(slug: string): Promise<CleanupBillingState> {
  await requirePlatformAdmin(slug);
  if (!billingConfigured()) return { error: "Stripe is not set up." };
  if (stripeTestMode()) return { error: "Stripe still uses a test key (sk_test_...). Put the live key in Vercel first." };
  try {
    const removed = await removeUnknownBillingData();
    revalidatePath("/a/[slug]", "layout");
    return {
      done: `Removed ${removed.subscriptions} test subscriptions, ${removed.invoices} test invoices and ${removed.customers} test customers.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
