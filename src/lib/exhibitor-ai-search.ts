// Pure helpers for "Ask AI" on the Exhibitors page: the AI turns a sentence
// into the page's ordinary filters, which then run against the database, so
// the AI never makes up exhibitors. The part that calls the AI is in
// exhibitor-ai-search-run.ts.

import { z } from "zod";
import { type ExhibitorFilters, exhibitorFilters } from "@/lib/exhibitor-list";

export const MAX_QUESTION = 300;

const answerSchema = z.object({
  country: z.string().nullish(),
  industry: z.array(z.string()).nullish(),
  showCountry: z.string().nullish(),
  showCity: z.string().nullish(),
  from: z.string().nullish(),
  to: z.string().nullish(),
  q: z.string().nullish(),
});

/**
 * Reads the AI's JSON answer into filters (with the question kept for display).
 * Unknown countries and bad dates are dropped by the same rules as the page URL.
 * Returns null when the answer holds no JSON object.
 */
export function parseAiFilters(answer: string, question: string): ExhibitorFilters | null {
  const json = answer.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const a = parsed.data;
  const upper = (v: string | null | undefined) => (v ?? "").trim().toUpperCase();
  return exhibitorFilters({
    country: upper(a.country),
    industry: (a.industry ?? []).join(", "),
    showCountry: upper(a.showCountry),
    showCity: a.showCity ?? "",
    from: a.from ?? "",
    to: a.to ?? "",
    q: a.q ?? "",
    ai: question.trim().slice(0, MAX_QUESTION),
  });
}
