import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { cleanProfile, type FillResult, MAX_PROFILE_WORDS, MAX_SITE_CHARS, NO_INFORMATION } from "@/lib/company-profile";
import { db } from "@/lib/db";
import { pageToText } from "@/lib/show-finder";
import { BROWSER_HEADERS } from "@/lib/show-finder-run";

// Writes an exhibitor's company profile with Claude from the company's
// website: once from the "Generate with AI" button on the exhibitor form, and
// for every imported exhibitor that has a website but no profile.

/** Which Claude model writes the profiles. Can be changed with COMPANY_PROFILE_MODEL. */
const MODEL = process.env.COMPANY_PROFILE_MODEL || "claude-opus-5-5";

const FETCH_TIMEOUT_MS = 15_000;
const AI_TIMEOUT_MS = 60_000;
const PARALLEL = 5;

export function isCompanyProfileConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You write the company profile of a trade show exhibitor for a directory of exhibitors, from the company's own website.

Write in English, in the third person, in a plain and factual tone. Say what the company does: its products or services, who its customers are, its markets or industries, and where it is based, if the website says so. Leave out slogans, marketing superlatives, contact details, opening hours and anything about cookies or the website itself.
Use at most ${MAX_PROFILE_WORDS} words, in one to three short paragraphs of plain text, with no headings, lists or markdown.
Only use what the website says; never guess or add facts from elsewhere.
If the website does not say what the company does (for example it is empty, parked, for sale or only a login page), answer exactly: ${NO_INFORMATION}`;

type Company = { name: string; website: string };

async function fetchSite(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`The website answered with error ${res.status}.`);
  return pageToText(await res.text(), url).text.slice(0, MAX_SITE_CHARS);
}

function answerText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Writes the profile from the homepage text we downloaded ourselves. */
async function writeFromText(client: Anthropic, company: Company, siteText: string): Promise<string | null> {
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: `Company: ${company.name}\nWebsite: ${company.website}\n\n<website>\n${siteText}\n</website>` }],
    },
    { timeout: AI_TIMEOUT_MS },
  );
  if (response.stop_reason === "refusal") throw new Error("The AI declined to write about this website.");
  return cleanProfile(answerText(response));
}

/**
 * Lets Claude read the website with Anthropic's own web fetcher, and follow
 * links such as "About us" on the same site. Used when our own download is
 * turned away or the homepage says too little.
 */
async function writeWithFetch(client: Anthropic, company: Company): Promise<string | null> {
  const host = new URL(company.website).hostname.replace(/^www\./, "");
  const tools: Anthropic.ToolUnion[] = [{ type: "web_fetch_20260209", name: "web_fetch", allowed_domains: [host], max_uses: 3 }];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Company: ${company.name}\nWebsite: ${company.website}\n\nRead the website (the homepage, and an "About us" page if the homepage says too little), then write the profile. Answer with the profile only.`,
    },
  ];
  for (let round = 0; round < 2; round++) {
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 8000, system: SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout: AI_TIMEOUT_MS },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to write about this website.");
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    return cleanProfile(answerText(response));
  }
  return null;
}

/**
 * Writes a company profile of at most 300 words from the company's website.
 * Returns null when the website does not say what the company does.
 */
export async function writeCompanyProfile(company: Company, client = new Anthropic()): Promise<string | null> {
  try {
    const text = await fetchSite(company.website);
    if (text.length >= 300) {
      const profile = await writeFromText(client, company, text);
      if (profile) return profile;
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) throw error;
    // Our own download failed; let Claude try the site instead.
  }
  return writeWithFetch(client, company);
}

export function describeProfileError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The AI key (ANTHROPIC_API_KEY) is not valid.";
  if (error instanceof Anthropic.RateLimitError) return "The AI service is busy or the credit is used up. Try again later.";
  if (error instanceof Anthropic.APIError) return `The AI service failed (error ${error.status}).`;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "The website took too long to answer.";
  if (error instanceof Error && error.message) return error.message.slice(0, 300);
  return "Something went wrong.";
}

/** Exhibitors the AI has not tried yet that have a website but no profile. */
export function missingProfileWhere(tradeShowId?: string): Prisma.ExhibitorWhereInput {
  return { ...(tradeShowId && { tradeShowId }), website: { not: null }, companyProfile: null, profileTriedAt: null };
}

/**
 * Writes the missing company profiles, a few at a time, until they are all
 * done or the time budget is used up. Each exhibitor is tried once, so a
 * website that says nothing is not tried again on the next run.
 */
export async function fillMissingProfiles({ tradeShowId, budgetMs }: { tradeShowId?: string; budgetMs: number }): Promise<FillResult> {
  const started = Date.now();
  const totals: FillResult = { written: 0, noInfo: 0, failed: 0, left: 0 };
  if (!isCompanyProfileConfigured()) {
    totals.left = await db.exhibitor.count({ where: missingProfileWhere(tradeShowId) });
    return totals;
  }

  const queue = await db.exhibitor.findMany({
    where: missingProfileWhere(tradeShowId),
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: { id: true, name: true, website: true },
    take: 500,
  });
  const client = new Anthropic();
  let next = 0;
  let stopped = false;
  async function worker() {
    while (!stopped && next < queue.length && Date.now() - started < budgetMs) {
      const e = queue[next++];
      let profile: string | null = null;
      try {
        profile = await writeCompanyProfile({ name: e.name, website: e.website! }, client);
        if (profile) totals.written++;
        else totals.noInfo++;
      } catch (error) {
        // A busy or broken AI service fails every row; stop and leave them for the next run.
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.RateLimitError) {
          stopped = true;
          totals.stoppedBy = describeProfileError(error);
          return;
        }
        totals.failed++;
      }
      // Only fill a profile that is still empty, in case someone typed one meanwhile.
      await db.exhibitor.updateMany({ where: { id: e.id }, data: { profileTriedAt: new Date() } });
      if (profile) await db.exhibitor.updateMany({ where: { id: e.id, companyProfile: null }, data: { companyProfile: profile } });
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  totals.left = await db.exhibitor.count({ where: missingProfileWhere(tradeShowId) });
  return totals;
}
