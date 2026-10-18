import { findCountryCode } from "@/lib/countries";
import { answerLine } from "@/lib/events-page";

// Pure helpers for letting AI find who organizes a trade show: reading its
// answer and summing up a run. The part that calls the AI is in
// organizer-finder-run.ts.

/** The text on the AI's answer line "LABEL: …", or null for NONE or no such line. */
export function answerText(text: string, label: string): string | null {
  const m = text.match(new RegExp(`^\\s*\\**${label}\\**\\s*:\\**\\s*(.+?)\\s*$`, "im"));
  const value = m?.[1].replace(/^\*+|\*+$/g, "").trim();
  return value && !/^none\.?$/i.test(value) ? value.slice(0, 150) : null;
}

/** What the AI found, read from its last lines "ORGANIZER: …", "WEBSITE: …" and "COUNTRY: …". */
export function parseOrganizerAnswer(text: string): { name: string | null; website: string | null; country: string | null } {
  const country = answerText(text, "COUNTRY");
  return { name: answerText(text, "ORGANIZER"), website: answerLine(text, "WEBSITE"), country: country ? findCountryCode(country) : null };
}

export type OrganizerFillResult = {
  /** Shows that got their organizer filled in. */
  filled: number;
  /** Shows where AI found no organizer. */
  notFound: number;
  failed: number;
  left: number;
  /** Why the run stopped early, e.g. an invalid AI key. */
  stoppedBy?: string;
};

/** A short sentence on what a run did, for the page. */
export function organizerSummary(r: OrganizerFillResult): string {
  const parts = [`AI found the organizer of ${r.filled} trade ${r.filled === 1 ? "show" : "shows"}.`];
  if (r.notFound) parts.push(`For ${r.notFound} ${r.notFound === 1 ? "show" : "shows"} AI could not find one; add those by hand.`);
  if (r.failed) parts.push(`${r.failed} could not be looked up.`);
  if (r.stoppedBy) parts.push(`Stopped: ${r.stoppedBy}`);
  if (r.left) parts.push(`${r.left} still to look up; press the button again to go on.`);
  return parts.join(" ");
}
