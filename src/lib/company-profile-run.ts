import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { cleanProfile, MAX_PROFILE_CHARS, MAX_SITE_CHARS, NO_INFORMATION, profileLine } from "@/lib/company-profile";
import { countryName } from "@/lib/countries";
import { db } from "@/lib/db";
import { answerLine } from "@/lib/events-page";
import { seenUrls } from "@/lib/events-page-run";
import { directoryCandidate } from "@/lib/exhibitor-fetch";
import { pageToText } from "@/lib/show-finder";
import { BROWSER_HEADERS } from "@/lib/show-finder-run";

// Writes an exhibitor's company profile with Claude from the company's
// website, only when someone asks for it: the "Generate with AI" button on
// the exhibitor form, or "Write company profile with AI" on a company's page.
// Profiles are not written automatically on import or at night, to keep the
// AI cost down.

/** Which Claude model writes the profiles. Can be changed with COMPANY_PROFILE_MODEL. */
const MODEL = process.env.COMPANY_PROFILE_MODEL || "claude-opus-5-5";

const FETCH_TIMEOUT_MS = 15_000;
const AI_TIMEOUT_MS = 60_000;

export function isCompanyProfileConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You write the company profile of a trade show exhibitor for a directory of exhibitors, from the company's own website.

Write in English, in the third person, in a plain and factual tone. Say what the company does: its products or services, who its customers are, its markets or industries, and where it is based, if the website says so. Leave out slogans, marketing superlatives, contact details, opening hours and anything about cookies or the website itself.
Use at most ${MAX_PROFILE_CHARS} characters including spaces (about two sentences), in one paragraph of plain text, with no headings, lists or markdown.
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
 * Writes a company profile of at most 300 characters from the company's website.
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

/** Whether the Anthropic account has no credit left; every call then fails with error 400. */
function isOutOfCredit(error: unknown): boolean {
  return error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message);
}

/** An error that fails every exhibitor alike (bad key, busy service, no credit), so a run should stop rather than go on. */
export function stopsEveryRow(error: unknown): boolean {
  return error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.RateLimitError || isOutOfCredit(error);
}

export function describeProfileError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The AI key (ANTHROPIC_API_KEY) is not valid.";
  if (isOutOfCredit(error)) return "The Anthropic account behind ANTHROPIC_API_KEY has no credit left. Top it up under Billing at console.anthropic.com.";
  if (error instanceof Anthropic.RateLimitError) return "The AI service is busy or the credit is used up. Try again later.";
  if (error instanceof Anthropic.APIError) return `The AI service failed (error ${error.status}): ${error.message.slice(0, 200)}`;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "The website took too long to answer.";
  if (error instanceof Error && error.message) return error.message.slice(0, 300);
  return "Something went wrong.";
}

const SEARCH_SYSTEM = `You write the company profile of a trade show exhibitor for a directory of exhibitors. You are given the company's name and the trade show it exhibits at, and sometimes its website.

Search the web for the company and find its own website (not a directory, a trade show page or social media). Read what the company does there.
Then write the profile in English, in the third person, in a plain and factual tone: what the company does, its products or services, its customers or industries, and where it is based. Leave out slogans, marketing superlatives and contact details. Use at most ${MAX_PROFILE_CHARS} characters including spaces (about two sentences), in one line of plain text.
Only use what you found about this very company; never guess. If you cannot find out what the company does, write ${NO_INFORMATION} as the profile.

End your answer with exactly these two lines:
WEBSITE: <the company's own website, or NONE>
PROFILE: <the profile, or ${NO_INFORMATION}>`;

type Exhibitor = { name: string; website: string | null; country: string | null; showName: string };

/**
 * Lets Claude search the web for the company and write the profile from what
 * it finds, for exhibitors without a website or whose website we could not
 * use. Also returns the company's website when the search really showed it.
 */
async function searchCompanyProfile(client: Anthropic, e: Exhibitor, deadline: number): Promise<{ profile: string | null; website: string | null }> {
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
  ];
  const lines = [
    `Company: ${e.name}`,
    `Exhibits at: ${e.showName}`,
    e.country && `Country: ${countryName(e.country)}`,
    e.website && `Website (could not be read): ${e.website}`,
  ];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: lines.filter(Boolean).join("\n") }];
  const seen: string[] = [];
  for (let round = 0; round < 3; round++) {
    const timeout = Math.min(120_000, deadline - Date.now());
    if (timeout < 20_000) throw new Error("There was not enough time left to search the web.");
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 8000, system: SEARCH_SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to look up this company.");
    seen.push(...seenUrls(response.content));
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = answerText(response);
    const site = answerLine(text, "WEBSITE");
    // Only an address the search really showed is kept, never a guessed one.
    return { profile: profileLine(text), website: site && directoryCandidate(site, seen) ? site.replace(/\/$/, "") : null };
  }
  return { profile: null, website: null };
}

const emptyProfile: Prisma.ExhibitorWhereInput = { OR: [{ companyProfile: null }, { companyProfile: "" }] };

export type CompanyProfileResult = { profile?: string; error?: string };

/**
 * Writes the profile of one company, when a user presses "Write company
 * profile with AI" on its page: from its website, or by searching the web
 * when it has none or the website says nothing. The profile is saved on
 * every exhibitor row of the company (one per trade show), so it is only
 * written once and everyone sees it; a website the search found is saved too.
 */
export async function writeProfileForCompany(companyKey: string): Promise<CompanyProfileResult> {
  const rows = await db.exhibitor.findMany({
    where: { companyKey },
    select: { id: true, name: true, website: true, country: true, companyProfile: true, tradeShow: { select: { name: true } } },
    orderBy: [{ tradeShow: { startDate: "desc" } }],
  });
  const done = rows.find((r) => r.companyProfile);
  if (done) return { profile: done.companyProfile! };
  const row = rows.find((r) => r.website) ?? rows[0];
  if (!row) return { error: "This company no longer exists." };

  const e: Exhibitor = { name: row.name, website: row.website, country: row.country, showName: row.tradeShow.name };
  const client = new Anthropic();
  const deadline = Date.now() + 200_000;
  let profile: string | null = null;
  let website: string | null = null;
  try {
    if (e.website) {
      try {
        profile = await writeCompanyProfile({ name: e.name, website: e.website }, client);
      } catch (error) {
        if (error instanceof Anthropic.APIError) throw error;
        console.warn(`Website of ${e.name} could not be used`, error);
      }
    }
    if (!profile) {
      const found = await searchCompanyProfile(client, e, deadline);
      profile = found.profile;
      if (!e.website) website = found.website;
    }
  } catch (error) {
    console.error(`Company profile for ${e.name} failed`, error);
    return { error: describeProfileError(error) };
  }
  if (!profile) return { error: "AI could not find out what this company does, so no profile was written." };

  // Only fill fields that are still empty, in case someone typed them meanwhile.
  await db.exhibitor.updateMany({ where: { companyKey, ...emptyProfile }, data: { companyProfile: profile, profileTriedAt: new Date() } });
  if (website) {
    // A new website can join the exhibitor to the same company at other shows.
    await db.exhibitor.updateMany({ where: { id: row.id, website: null }, data: { website, companyKey: null } });
  }
  return { profile };
}
