import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  createLoginCode,
  LOGIN_CODE_MINUTES,
  loginCodeHash,
  TICKET_SECONDS,
  TRUSTED_DEVICE_DAYS,
} from "@/lib/login-codes";
import { createToken, hashToken } from "@/lib/tokens";

// Makes it hard to share one login between several people (the subscription
// is paid per user):
// - A browser the user hasn't logged in from before needs a 6-digit code sent
//   to the user's email. The browser is then trusted for 30 days.
// - Every login starts a new session version, so the previous session of that
//   user is logged out (see the jwt callback in src/auth.ts).
// After the password (and code, if needed) is accepted, a one-time ticket is
// issued and Auth.js exchanges it for the session. Auth.js accepts nothing
// else, so the checks here can't be skipped by calling Auth.js directly.

const DEVICE_COOKIE = "tss_device";
const PENDING_COOKIE = "tss_login";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

/**
 * Whether new devices must confirm a code. Off when no email can be sent, and
 * can be switched off with LOGIN_DEVICE_CHECK=off if email ever stops working.
 */
export function deviceCheckEnabled(): boolean {
  return isEmailConfigured() && process.env.LOGIN_DEVICE_CHECK?.trim().toLowerCase() !== "off";
}

export async function isTrustedDevice(userId: string): Promise<boolean> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return false;
  const device = await db.trustedDevice.findFirst({
    where: { userId, tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return Boolean(device);
}

/** Remembers this browser for the user. Several users may share one browser. */
async function trustThisDevice(userId: string) {
  const { token, tokenHash } = createToken();
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);
  await db.trustedDevice.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
  await db.trustedDevice.create({ data: { userId, tokenHash, expiresAt } });
  // One cookie per browser: a second user logging in replaces it, and the
  // first one then needs a code again on that browser.
  (await cookies()).set(DEVICE_COOKIE, token, { ...cookieOptions, expires: expiresAt });
}

/** Emails a new code and remembers which login is waiting for it. */
export async function sendLoginCode(user: { id: string; email: string }) {
  await db.loginCode.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } });
  const code = createLoginCode();
  const expiresAt = new Date(Date.now() + LOGIN_CODE_MINUTES * 60 * 1000);
  const record = await db.loginCode.create({ data: { userId: user.id, expiresAt } });
  await db.loginCode.update({ where: { id: record.id }, data: { codeHash: loginCodeHash(record.id, code) } });

  await sendEmail({
    to: user.email,
    subject: `Your login code: ${code}`,
    text: `Your Trade Show System login code is ${code}\n\nIt works for ${LOGIN_CODE_MINUTES} minutes. If you did not try to log in, change your password.`,
    html: `<p>Your Trade Show System login code is</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>It works for ${LOGIN_CODE_MINUTES} minutes. If you did not try to log in, change your password.</p>`,
  });
  (await cookies()).set(PENDING_COOKIE, record.id, { ...cookieOptions, expires: expiresAt });
}

/** The login waiting for a code in this browser, if any. */
export async function pendingLogin() {
  const id = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!id) return null;
  return db.loginCode.findUnique({ where: { id }, include: { user: { select: { id: true, email: true } } } });
}

/** After a correct code: trust the browser and hand out the ticket for Auth.js. */
export async function completeCodeLogin(loginCodeId: string, userId: string): Promise<string> {
  const { token, tokenHash } = createToken();
  await db.loginCode.update({ where: { id: loginCodeId }, data: { usedAt: new Date(), ticketHash: tokenHash } });
  await trustThisDevice(userId);
  (await cookies()).delete(PENDING_COOKIE);
  return token;
}

/** A ticket for a login that needs no code (trusted device, or right after sign-up). */
export async function issueTicket(userId: string, { trustDevice = false } = {}): Promise<string> {
  const { token, tokenHash } = createToken();
  const now = new Date();
  await db.loginCode.create({ data: { userId, expiresAt: now, usedAt: now, ticketHash: tokenHash } });
  if (trustDevice) await trustThisDevice(userId);
  return token;
}

/**
 * Used by Auth.js: turns a ticket into a user, once, and starts a new session
 * version so the user's other sessions are logged out.
 */
export async function redeemTicket(ticket: string) {
  const earliest = new Date(Date.now() - TICKET_SECONDS * 1000);
  const record = await db.loginCode.findUnique({ where: { ticketHash: hashToken(ticket) } });
  if (!record?.usedAt || record.usedAt < earliest || record.ticketUsedAt) return null;
  const claimed = await db.loginCode.updateMany({
    where: { id: record.id, ticketUsedAt: null },
    data: { ticketUsedAt: new Date() },
  });
  if (claimed.count === 0) return null;
  return db.user.update({
    where: { id: record.userId },
    data: { sessionVersion: { increment: 1 } },
    select: { id: true, email: true, name: true, sessionVersion: true },
  });
}
