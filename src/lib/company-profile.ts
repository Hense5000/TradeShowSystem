// Pure helpers for the AI-written company profile of an exhibitor. The part
// that reads the website and calls the AI is in company-profile-run.ts.

/** A company profile is at most this many characters, as Henrik asked: a short description in English. */
export const MAX_PROFILE_CHARS = 300;

/** Homepage text longer than this is cut; what a company does is near the top. */
export const MAX_SITE_CHARS = 30_000;

/** What the AI answers when the website does not say what the company does. */
export const NO_INFORMATION = "NO INFORMATION";

/**
 * Tidies the AI's answer: one plain paragraph of at most MAX_PROFILE_CHARS
 * characters. A text that is too long is cut after the last full sentence
 * that fits, or else after the last whole word with "…".
 * Returns null when the AI found nothing to write.
 */
export function cleanProfile(answer: string, maxChars = MAX_PROFILE_CHARS): string | null {
  const text = answer
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || (text.length < 40 && text.toUpperCase().includes(NO_INFORMATION))) return null;
  if (text.length <= maxChars) return text;

  const short = text.slice(0, maxChars);
  const lastStop = Math.max(short.lastIndexOf(". "), short.lastIndexOf("! "), short.endsWith(".") ? short.length - 1 : -1);
  if (lastStop > maxChars / 2) return short.slice(0, lastStop + 1);
  const words = text.slice(0, maxChars - 1);
  const lastSpace = words.lastIndexOf(" ");
  return `${(lastSpace > 0 ? words.slice(0, lastSpace) : words).replace(/[\s,;:–-]+$/, "")}…`;
}

/** The profile from the AI's web search answer, read from its line "PROFILE: …". */
export function profileLine(text: string): string | null {
  const m = text.match(/^\s*\**PROFILE\**\s*:\**\s*(.+)$/im);
  return m ? cleanProfile(m[1]) : null;
}
