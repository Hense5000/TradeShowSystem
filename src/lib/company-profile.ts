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

export type FillResult = {
  written: number;
  noInfo: number;
  failed: number;
  left: number;
  /** Why the run stopped early, e.g. an invalid AI key. */
  stoppedBy?: string;
};

/** A short sentence on what a fill run did, for the page. */
export type ProfileRunResult = {
  written: number;
  noInfo: number;
  failed: number;
  /** Exhibitors without a website that got one from AI's web search. */
  websitesFound: number;
  /** The exhibitors that got no profile, and why, to show under the bar. */
  problems: { name: string; reason: string }[];
  /** Why the run stopped early, e.g. an invalid AI key. */
  stoppedBy?: string;
};

/** A short sentence on what a "Fill missing profiles" run did, for the page. */
export function profileRunSummary(r: ProfileRunResult, left: number): string {
  const parts = [`AI wrote ${r.written} company ${r.written === 1 ? "profile" : "profiles"}.`];
  if (r.websitesFound) parts.push(`${r.websitesFound} ${r.websitesFound === 1 ? "exhibitor" : "exhibitors"} also got a website.`);
  if (r.noInfo) parts.push(`For ${r.noInfo} ${r.noInfo === 1 ? "company" : "companies"} AI found nothing about what they do.`);
  if (r.failed) parts.push(`${r.failed} could not be looked up this time.`);
  if (r.stoppedBy) parts.push(`Stopped: ${r.stoppedBy}`);
  if (left) parts.push(`${left} still without a profile; press the button again to try them.`);
  return parts.join(" ");
}

export function fillSummary(r: FillResult): string {
  const parts = [`AI wrote ${r.written} company ${r.written === 1 ? "profile" : "profiles"}.`];
  if (r.noInfo) parts.push(`${r.noInfo} ${r.noInfo === 1 ? "website" : "websites"} did not say what the company does.`);
  if (r.failed) parts.push(`${r.failed} ${r.failed === 1 ? "website" : "websites"} could not be read.`);
  if (r.stoppedBy) parts.push(`Stopped: ${r.stoppedBy}`);
  if (r.left) parts.push(`${r.left} still to write; they are written automatically during the night, or press "Fill missing profiles" on the Exhibitors list.`);
  return parts.join(" ");
}
