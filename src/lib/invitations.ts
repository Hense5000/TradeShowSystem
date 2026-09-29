import "server-only";
import type { Invitation, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashToken, invitationState } from "@/lib/tokens";

/** Looks up an invitation from the raw token in an invite link. */
export async function findInvitation(token: string) {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { name: true, slug: true } } },
  });
  if (!invitation) return null;
  return { invitation, state: invitationState(invitation) };
}

/** Adds the user to the invitation's account and marks the invitation used. */
export async function acceptInvitation(tx: Prisma.TransactionClient, invitation: Invitation, userId: string) {
  // Mark it accepted only if it is still open, so a link can't be used twice.
  const claimed = await tx.invitation.updateMany({
    where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count === 0) throw new Error("This invitation is no longer valid.");

  // If they're already a member, keep their current role.
  await tx.membership.upsert({
    where: { userId_organizationId: { userId, organizationId: invitation.organizationId } },
    create: { userId, organizationId: invitation.organizationId, role: invitation.role },
    update: {},
  });
}
