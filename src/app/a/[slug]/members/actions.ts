"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { canAssignRole, checkRemoval, checkRoleChange } from "@/lib/permissions";
import { requireMembership } from "@/lib/tenant";
import { createToken, invitationExpiry } from "@/lib/tokens";
import { firstError, inviteSchema, roleSchema } from "@/lib/validation";

type State = { error?: string } | undefined;
export type InviteState = { error?: string; link?: string; email?: string } | undefined;

const ownerCount = (organizationId: string) => db.membership.count({ where: { organizationId, role: "OWNER" } });

export async function inviteMember(slug: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const { user, membership, organization } = await requireMembership(slug, "ADMIN");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error), email: String(formData.get("email") ?? "") };
  const { email, role } = parsed.data;
  if (!canAssignRole(membership.role, role)) return { error: "You cannot invite someone with that role.", email };

  const alreadyMember = await db.membership.findFirst({
    where: { organizationId: organization.id, user: { email } },
    select: { id: true },
  });
  if (alreadyMember) return { error: `${email} is already a user in this account.`, email };

  const { token, tokenHash } = createToken();
  await db.$transaction([
    // Only the newest invitation for an email stays usable.
    db.invitation.updateMany({
      where: { organizationId: organization.id, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.invitation.create({
      data: { organizationId: organization.id, email, role, tokenHash, invitedById: user.id, expiresAt: invitationExpiry() },
    }),
  ]);

  // Sending the link by email comes later; for now the admin copies it.
  revalidatePath(`/a/${slug}/members`);
  return { link: `${appUrl()}/invite/${token}`, email };
}

export async function revokeInvitation(slug: string, invitationId: string): Promise<State> {
  const { organization } = await requireMembership(slug, "ADMIN");
  await db.invitation.updateMany({
    where: { id: invitationId, organizationId: organization.id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/a/${slug}/members`);
  return undefined;
}

export async function changeRole(slug: string, membershipId: string, _prev: State, formData: FormData): Promise<State> {
  const { membership: actor, organization } = await requireMembership(slug);
  const next = roleSchema.safeParse(formData.get("role"));
  if (!next.success) return { error: "Pick a valid role." };

  const target = await db.membership.findFirst({ where: { id: membershipId, organizationId: organization.id } });
  if (!target) return { error: "That user is not in this account." };
  if (target.role === next.data) return;

  const check = checkRoleChange({
    actor: actor.role,
    target: target.role,
    next: next.data,
    ownerCount: await ownerCount(organization.id),
  });
  if (!check.ok) return { error: check.error };

  await db.membership.update({ where: { id: target.id }, data: { role: next.data } });
  revalidatePath(`/a/${slug}`, "layout");
}

export async function removeMember(slug: string, membershipId: string): Promise<State> {
  const { membership: actor, organization } = await requireMembership(slug);
  const target = await db.membership.findFirst({ where: { id: membershipId, organizationId: organization.id } });
  if (!target) return { error: "That user is not in this account." };

  const isSelf = target.id === actor.id;
  const check = checkRemoval({
    actor: actor.role,
    target: target.role,
    ownerCount: await ownerCount(organization.id),
    isSelf,
  });
  if (!check.ok) return { error: check.error };

  await db.membership.delete({ where: { id: target.id } });
  if (isSelf) redirect("/accounts");
  revalidatePath(`/a/${slug}`, "layout");
}
