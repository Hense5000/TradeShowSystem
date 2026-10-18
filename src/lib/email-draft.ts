// Pure helpers for the AI-written first email to a favorite exhibitor. The
// part that calls the AI is in email-draft-run.ts.

/** The languages a draft can be written in. */
export const DRAFT_LANGUAGES = {
  en: "English",
  da: "Danish",
  sv: "Swedish",
  no: "Norwegian",
  de: "German",
  nl: "Dutch",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  pl: "Polish",
} as const;
export type DraftLanguage = keyof typeof DRAFT_LANGUAGES;

// Countries where the exhibitor most likely prefers its own language over English.
const COUNTRY_LANGUAGE: Record<string, DraftLanguage> = {
  DK: "da",
  SE: "sv",
  NO: "no",
  DE: "de",
  AT: "de",
  NL: "nl",
  FR: "fr",
  ES: "es",
  MX: "es",
  AR: "es",
  IT: "it",
  PT: "pt",
  BR: "pt",
  PL: "pl",
};

/** The language to write in when the user has not picked one: the exhibitor's own, else English. */
export function defaultDraftLanguage(country: string | null): DraftLanguage {
  return (country && COUNTRY_LANGUAGE[country]) || "en";
}

export function parseDraftLanguage(value: unknown): DraftLanguage {
  return typeof value === "string" && value in DRAFT_LANGUAGES ? (value as DraftLanguage) : "en";
}

export const MAX_DRAFT_GOAL = 300;

/**
 * Reads the AI's answer: a line "SUBJECT: …" and then the email body.
 * Without a subject line the whole answer is the body.
 */
export function parseDraft(answer: string): { subject: string; body: string } {
  const text = answer.replace(/\r\n/g, "\n").trim();
  const m = text.match(/^\s*\**subject\**\s*:\s*(.+)\n+([\s\S]*)$/i);
  const subject = m ? m[1].replace(/\*\*/g, "").trim() : "";
  const body = (m ? m[2] : text).replace(/\n{3,}/g, "\n\n").trim();
  return { subject, body };
}

/** A mailto: link that opens the user's own mail program with the draft filled in. */
export function mailtoHref(to: string | null, subject: string, body: string): string {
  const qs = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join("&");
  return `mailto:${to ? encodeURIComponent(to).replace(/%40/g, "@") : ""}${qs ? `?${qs}` : ""}`;
}
