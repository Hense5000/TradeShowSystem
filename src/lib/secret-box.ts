import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Encrypts secrets a customer gives us, such as their own Hunter.io API key,
// before they are stored. AES-256-GCM with a key derived from SECRETS_KEY, or
// from AUTH_SECRET (already set in Vercel) when that is not set. If the secret
// changes, stored values can no longer be read and must be entered again.

const VERSION = "v1";

function key(secret = process.env.SECRETS_KEY || process.env.AUTH_SECRET): Buffer {
  if (!secret) throw new Error("AUTH_SECRET is not set, so secrets cannot be stored.");
  return createHash("sha256").update(`tradeshowsystem secret box:${secret}`).digest();
}

/** The text encrypted, as "v1.<iv>.<tag>.<data>" in base64url. */
export function sealSecret(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** The text sealSecret encrypted, or null when it cannot be read (e.g. the secret changed). */
export function openSecret(sealed: string, secret?: string): string | null {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
