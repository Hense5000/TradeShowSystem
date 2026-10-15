// Pure helpers for the AI-written company profile of an exhibitor. The part
// that reads the website and calls the AI is in company-profile-run.ts.

/** A company profile is at most this many words. */
export const MAX_PROFILE_WORDS = 300;

/** Homepage text longer than this is cut; what a company does is near the top. */
export const MAX_SITE_CHARS = 30_000;

/** What the AI answers when the website does not say what the company does. */
export const NO_INFORMATION = "NO INFORMATION";

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Tidies the AI's answer: plain paragraphs, at most MAX_PROFILE_WORDS words.
 * A text that is too long is cut after the last full sentence that fits.
 * Returns null when the AI found nothing to write.
 */
export function cleanProfile(answer: string, maxWords = MAX_PROFILE_WORDS): string | null {
  const text = answer
    .replace(/\r/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
  if (!text || (text.length < 40 && text.toUpperCase().includes(NO_INFORMATION))) return null;
  if (countWords(text) <= maxWords) return text;

  // Keep the first maxWords words, then step back to the end of a sentence.
  let seen = 0;
  const short = text.replace(/\S+/g, (word) => (++seen <= maxWords ? word : "")).trimEnd();
  const lastStop = Math.max(short.lastIndexOf(". "), short.lastIndexOf(".\n"), short.endsWith(".") ? short.length - 1 : -1);
  return (lastStop > short.length / 2 ? short.slice(0, lastStop + 1) : short).trim();
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
export function fillSummary(r: FillResult): string {
  const parts = [`AI wrote ${r.written} company ${r.written === 1 ? "profile" : "profiles"}.`];
  if (r.noInfo) parts.push(`${r.noInfo} ${r.noInfo === 1 ? "website" : "websites"} did not say what the company does.`);
  if (r.failed) parts.push(`${r.failed} ${r.failed === 1 ? "website" : "websites"} could not be read.`);
  if (r.stoppedBy) parts.push(`Stopped: ${r.stoppedBy}`);
  if (r.left) parts.push(`${r.left} still to write; they are written automatically during the night, or press "Write missing profiles" on the Exhibitors list.`);
  return parts.join(" ");
}
