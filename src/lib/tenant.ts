import "server-only";
import type { Role, Subscription } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { currentSubscription, hasPaidAccess } from "@/lib/billing";
import { hasRole } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { billingConfigured } from "@/lib/stripe";

// The lookups below are cached for one request: the account layout and the
// page under it both check the user, and every database round trip is felt.
const sessionUserId = cache(async () => (await auth())?.user?.id ?? null);

const signedInUser = cache(async () => {
  const id = await sessionUserId();
  return id ? db.user.findUnique({ where: { id } }) : null;
});

/** The user with their membership in the account with this slug, its account and subscriptions, in one query. */
const userInAccount = cache((userId: string, slug: string) =>
  db.user.findUnique({
    where: { id: userId },
    include: { memberships: { where: { organization: { slug } }, include: { organization: { include: { subscriptions: true } } } } },
  }),
);

/** The signed-in user, or a redirect to the login page. */
export async function requireUser(callbackUrl?: string) {
  const user = await signedInUser();
  if (!user) {
    redirect(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
  }
  return user;
}

/**
 * The signed-in user's membership in the account with this slug. Every page
 * and action inside /a/[slug] goes through here, which is what keeps one
 * customer's data invisible to another. Non-members get a 404 so account
 * slugs can't be probed.
 */
export async function requireMembership(slug: string, minRole: Role = "MEMBER", { allowUnpaid = false } = {}) {
  const userId = await sessionUserId();
  const found = userId ? await userInAccount(userId, slug) : null;
  if (!found) redirect(`/login?callbackUrl=${encodeURIComponent(`/a/${slug}`)}`);
  const { memberships, ...user } = found;
  const membership = memberships[0];
  if (!membership) notFound();
  if (!hasRole(membership.role, minRole)) notFound();
  // Accounts without a paid subscription only reach Billing, Users and
  // Company profile (the pages that pass allowUnpaid).
  if (!allowUnpaid && !accountHasAccess(membership.organization.subscriptions, user.email)) {
    redirect(`/a/${slug}/billing`);
  }
  return { user, membership, organization: membership.organization };
}

/**
 * Whether the account with these subscriptions may use the app. Always true
 * while payments aren't set up, and for platform admins, so they can look
 * into any account.
 */
export function accountHasAccess(subscriptions: Subscription[], email: string): boolean {
  if (!billingConfigured() || isPlatformAdmin(email)) return true;
  return hasPaidAccess(currentSubscription(subscriptions));
}

/**
 * Like requireMembership, but only for platform admins, who maintain the
 * shared directory. Everyone else gets a 404.
 */
export async function requirePlatformAdmin(slug: string) {
  const result = await requireMembership(slug);
  if (!isPlatformAdmin(result.user.email)) notFound();
  return result;
}
