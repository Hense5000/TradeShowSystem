import { createHash, randomInt } from "node:crypto";

// Pure rules for the code emailed when someone logs in from a new device.
// Kept free of database access so they are easy to test.

export const LOGIN_CODE_MINUTES = 10;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;
export const TRUSTED_DEVICE_DAYS = 30;
/** How long the one-time ticket from an accepted code can be exchanged for a session. */
export const TICKET_SECONDS = 120;

/** A random 6-digit code, e.g. "042917". */
export function createLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** The stored hash of a code. The id salts it, so equal codes hash differently. */
export function loginCodeHash(loginCodeId: string, code: string): string {
  return createHash("sha256").update(`${loginCodeId}:${code}`).digest("hex");
}

/** Spaces and dashes people type or paste are ignored. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, "");
}

export type CodeCheck = "ok" | "wrong" | "expired" | "used" | "too-many";

export function checkLoginCode(
  record: { id: string; codeHash: string | null; attempts: number; expiresAt: Date; usedAt: Date | null },
  input: string,
  now = new Date(),
): CodeCheck {
  if (record.usedAt) return "used";
  if (record.expiresAt <= now) return "expired";
  if (record.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return "too-many";
  if (!record.codeHash || loginCodeHash(record.id, normalizeCode(input)) !== record.codeHash) return "wrong";
  return "ok";
}

/** "h***@example.com", so the page can say where the code went without showing the whole address. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 1)}***@${domain}`;
}
