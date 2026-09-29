import "server-only";
import type { Role } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/platform-admin";

/** The signed-in user, or a redirect to the login page. */
export async function requireUser(callbackUrl?: string) {
  const session = await auth();
  const user = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id } }) : null;
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
export async function requireMembership(slug: string, minRole: Role = "MEMBER") {
  const user = await requireUser(`/a/${slug}`);
  const membership = await db.membership.findFirst({
    where: { userId: user.id, organization: { slug } },
    include: { organization: true },
  });
  if (!membership) notFound();
  if (!hasRole(membership.role, minRole)) notFound();
  return { user, membership, organization: membership.organization };
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
