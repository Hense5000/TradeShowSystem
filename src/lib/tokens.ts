import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_DAYS = 7;

/** A random, URL-safe token. Only its hash is stored in the database. */
export function createToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationExpiry(from = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type InvitationState = "pending" | "accepted" | "revoked" | "expired";

export function invitationState(
  inv: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): InvitationState {
  if (inv.acceptedAt) return "accepted";
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt <= now) return "expired";
  return "pending";
}
