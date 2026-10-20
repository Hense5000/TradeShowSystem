import "server-only";
import type { Role } from "@prisma/client";
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
const signedInUser = cache(async () => {
  const session = await auth();
  return session?.user?.id ? db.user.findUnique({ where: { id: session.user.id } }) : null;
});

const membershipOf = cache((userId: string, slug: string) =>
  db.membership.findFirst({ where: { userId, organization: { slug } }, include: { organization: true } }),
);

/** The account's subscriptions, read once per request. */
export const subscriptionsOf = cache((organizationId: string) => db.subscription.findMany({ where: { organizationId } }));

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
  const user = await requireUser(`/a/${slug}`);
  const membership = await membershipOf(user.id, slug);
  if (!membership) notFound();
  if (!hasRole(membership.role, minRole)) notFound();
  // Accounts without a paid subscription only reach Billing, Users and
  // Company profile (the pages that pass allowUnpaid).
  if (!allowUnpaid && !(await accountHasAccess(membership.organizationId, user.email))) {
    redirect(`/a/${slug}/billing`);
  }
  return { user, membership, organization: membership.organization };
}

/**
 * Whether the account may use the app. Always true while payments aren't set
 * up, and for platform admins, so they can look into any account.
 */
export async function accountHasAccess(organizationId: string, email: string): Promise<boolean> {
  if (!billingConfigured() || isPlatformAdmin(email)) return true;
  const subscriptions = await subscriptionsOf(organizationId);
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
