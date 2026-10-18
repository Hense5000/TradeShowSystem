import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { parseAiFilters } from "@/lib/exhibitor-ai-search";
import type { ExhibitorFilters } from "@/lib/exhibitor-list";

// Turns a sentence like "Danish medical exhibitors at trade shows in Germany in
// spring" into the Exhibitors page's filters with Claude. Only filters come
// back; the exhibitors themselves are always found in the database.

/** Which Claude model reads the question. Uses the same setting as the company profiles. */
const MODEL = process.env.COMPANY_PROFILE_MODEL || "claude-opus-5-5";
const AI_TIMEOUT_MS = 45_000;
// How many of the most used industry names the AI is shown, so it picks words that are really in the data.
const INDUSTRIES_SHOWN = 150;

const SYSTEM = `You turn a user's question about trade show exhibitors into search filters for a database. The question may be in any language, for example Danish.

The database has exhibitors. Each exhibitor has a company name, contact person, its own country (ISO 3166-1 alpha-2 code), an industry (free text, mostly in English) and a short company profile in English, and exhibits at one trade show. Each trade show has a country (ISO code), a city, a start date and an end date.

Answer with one JSON object and nothing else, with these keys (use null or leave a key out when the question does not ask for it):
- "country": the exhibitors' own country as an ISO code, e.g. "danske udstillere" -> "DK".
- "industry": a list of 1 to 8 short English words or word stems that would appear in the industry or company profile of matching companies. Include common synonyms and stems, e.g. for "medico" -> ["medical", "medtech", "medico", "health", "hospital", "surgical", "diagnostic"]. Prefer words from the list of industries in the data when they fit.
- "showCountry": the country where the trade show takes place, as an ISO code, e.g. "messer i Tyskland" -> "DE".
- "showCity": the trade show's city in English, only if the question names one.
- "from" and "to": the date range (YYYY-MM-DD) the trade show must overlap. Work out seasons, months, quarters and words like "next year" from today's date; when it is ambiguous, pick the next one still to come. Spring is 1 March to 31 May, summer 1 June to 31 August, autumn 1 September to 30 November, winter 1 December to the end of February.
- "q": a company or contact person's name, only if the question names one.

Never invent exhibitors or data. Only fill the keys the question asks for.`;

/** The filters the question asks for. Throws when the AI cannot be reached or gives no usable answer. */
export async function askAiForFilters(question: string, client = new Anthropic()): Promise<ExhibitorFilters> {
  const industries = await db.exhibitor.groupBy({
    by: ["industry"],
    where: { industry: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { industry: "desc" } },
    take: INDUSTRIES_SHOWN,
  });
  const today = new Date().toISOString().slice(0, 10);
  const prompt =
    `Today's date: ${today}\n\n` +
    `<industries_in_the_data>\n${industries.map((i) => i.industry).join("\n")}\n</industries_in_the_data>\n\n` +
    `<question>\n${question}\n</question>`;

  const response = await client.messages.create(
    { model: MODEL, max_tokens: 2000, system: SYSTEM, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] },
    { timeout: AI_TIMEOUT_MS },
  );
  if (response.stop_reason === "refusal") throw new Error("The AI declined to answer this question.");
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const filters = parseAiFilters(text, question);
  if (!filters) throw new Error("The AI did not understand the question. Try writing it another way.");
  return filters;
}
