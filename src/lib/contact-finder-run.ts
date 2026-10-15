import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { describeProfileError, isCompanyProfileConfigured } from "@/lib/company-profile-run";
import {
  cleanContact,
  type ContactFillResult,
  contactPageLinks,
  contactUpdate,
  type FoundContact,
  linkedContacts,
  MAX_CONTACT_PAGE_CHARS,
} from "@/lib/contact-finder";
import { db } from "@/lib/db";
import { pageToText } from "@/lib/show-finder";
import { BROWSER_HEADERS } from "@/lib/show-finder-run";

// Finds an exhibitor's contact person (name, position, email, phone) on the
// company's own website with Claude: the homepage plus its "Contact", "Team"
// or "About us" pages. Only what the website itself lists is used; nothing is
// bought from data providers and no email address is guessed.

/** Which Claude model reads the pages. Can be changed with CONTACT_FINDER_MODEL. */
const MODEL = process.env.CONTACT_FINDER_MODEL || "claude-opus-5-5";

const FETCH_TIMEOUT_MS = 15_000;
const AI_TIMEOUT_MS = 60_000;
const PARALLEL = 5;

/** The same AI key as the company profiles. */
export const isContactFinderConfigured = isCompanyProfileConfigured;

const contactSchema = z.object({
  contactName: z.string().nullable().describe("Full name of the person, as written, or null"),
  contactTitle: z.string().nullable().describe("That person's job title, as written, or null"),
  email: z.string().nullable().describe("Email address exactly as written on the pages, or null"),
  phone: z.string().nullable().describe("Phone number as written, or null"),
});

const SYSTEM = `You find the best contact at a company for a trade show business directory, from pages of the company's own website.

Pick one named person to contact about the company's products or trade show business. Prefer, in this order: sales, export or business development; marketing; the managing director, CEO or owner. Give their full name and job title as written.
For email, give that person's own email address if the pages show it; otherwise the company's general email address (for example sales@ or info@). For phone, give that person's direct number if shown; otherwise the company's main number.
Only use what is written on the pages. Never guess, never build an email address from a name, and never take details of another company (such as the web agency or a reseller). Use null for anything the pages do not show.`;

const READER_SYSTEM = `You collect contact details from a company's website for another step.

Fetch the homepage you are given, and its contact, team or about page if it has one. Then write out, as plain text, every named person with their job title, email and phone, and the company's general email addresses and phone numbers, exactly as written. Write nothing else. If the pages show none, write: NO CONTACTS FOUND`;

type Company = { name: string; website: string };

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`The website answered with error ${res.status}.`);
  return res.text();
}

/** One page as text the AI can read, with the emails and numbers only shown as links added at the end. */
function pageText(html: string, url: string): string {
  const linked = linkedContacts(html);
  const text = pageToText(html, url).text.slice(0, MAX_CONTACT_PAGE_CHARS);
  return linked.length > 0 ? `${text}\nEmail addresses and phone numbers linked on this page: ${linked.join(", ")}` : text;
}

/** The homepage and its contact, team or about pages, as one text. */
async function readSite(website: string): Promise<string> {
  const home = await fetchHtml(website);
  const pages = await Promise.all(
    contactPageLinks(home, website).map(async (url) => {
      try {
        return `<page url="${url}">\n${pageText(await fetchHtml(url), url)}\n</page>`;
      } catch {
        return "";
      }
    }),
  );
  return [`<page url="${website}">\n${pageText(home, website)}\n</page>`, ...pages].filter(Boolean).join("\n\n");
}

/** Lets Claude read the website with Anthropic's web fetcher, for sites that turn our own download away. */
async function readWithClaude(client: Anthropic, company: Company): Promise<string> {
  const host = new URL(company.website).hostname.replace(/^www\./, "");
  const tools: Anthropic.ToolUnion[] = [{ type: "web_fetch_20260209", name: "web_fetch", allowed_domains: [host], max_uses: 3 }];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Company: ${company.name}\nWebsite: ${company.website}` }];
  for (let round = 0; round < 2; round++) {
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 8000, system: READER_SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout: AI_TIMEOUT_MS },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to read this website.");
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text.includes("NO CONTACTS FOUND") && text.length < 40 ? "" : text;
  }
  return "";
}

async function pickContact(client: Anthropic, company: Company, siteText: string): Promise<FoundContact | null> {
  const response = await client.messages.parse(
    {
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(contactSchema) },
      messages: [{ role: "user", content: `Company: ${company.name}\nWebsite: ${company.website}\n\n${siteText}` }],
    },
    { timeout: AI_TIMEOUT_MS },
  );
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this website.");
  if (!response.parsed_output) throw new Error("The AI's answer could not be read.");
  return cleanContact(response.parsed_output, siteText);
}

/**
 * The company's contact person and details from its own website, or null
 * when the website lists none. Our own download is tried first; when it is
 * turned away or holds almost nothing (a site built with JavaScript), Claude
 * reads the website with Anthropic's web fetcher instead.
 */
export async function findContact(company: Company, client = new Anthropic()): Promise<FoundContact | null> {
  try {
    const text = await readSite(company.website);
    if (text.length >= 500) return await pickContact(client, company, text);
  } catch (error) {
    if (error instanceof Anthropic.APIError) throw error;
    // Our own download failed; let Claude try the site instead.
  }
  const text = await readWithClaude(client, company);
  return text ? pickContact(client, company, text) : null;
}

export const describeContactError = describeProfileError;

/** Exhibitors the AI has not tried yet that have a website but no contact person or no email. */
export function missingContactWhere(tradeShowId?: string): Prisma.ExhibitorWhereInput {
  return {
    ...(tradeShowId && { tradeShowId }),
    website: { not: null },
    contactTriedAt: null,
    OR: [{ contactName: null }, { email: null }],
  };
}

/**
 * Looks up the missing contacts, a few at a time, until they are all done or
 * the time budget is used up. Only empty fields are filled. Each exhibitor is
 * tried once, so a website that lists no one is not read again on the next run.
 */
export async function fillMissingContacts({
  tradeShowId,
  budgetMs,
  limit = 500,
}: {
  tradeShowId?: string;
  budgetMs: number;
  /** At most this many exhibitors, e.g. a small batch so the import page can show progress. */
  limit?: number;
}): Promise<ContactFillResult> {
  const started = Date.now();
  const totals: ContactFillResult = { filled: 0, noInfo: 0, failed: 0, left: 0 };
  if (!isContactFinderConfigured()) {
    totals.left = await db.exhibitor.count({ where: missingContactWhere(tradeShowId) });
    return totals;
  }

  const queue = await db.exhibitor.findMany({
    where: missingContactWhere(tradeShowId),
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: { id: true, name: true, website: true },
    take: limit,
  });
  const client = new Anthropic();
  let next = 0;
  let stopped = false;
  async function worker() {
    while (!stopped && next < queue.length && Date.now() - started < budgetMs) {
      const e = queue[next++];
      let found: FoundContact | null = null;
      let failed = false;
      try {
        found = await findContact({ name: e.name, website: e.website! }, client);
      } catch (error) {
        // A busy or broken AI service fails every row; stop and leave them for the next run.
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.RateLimitError) {
          stopped = true;
          totals.stoppedBy = describeContactError(error);
          return;
        }
        failed = true;
        totals.failed++;
      }
      await db.exhibitor.updateMany({ where: { id: e.id }, data: { contactTriedAt: new Date() } });
      if (!found) {
        if (!failed) totals.noInfo++;
        continue;
      }
      // Read the fields just before saving, in case someone typed them in meanwhile.
      const current = await db.exhibitor.findUnique({ where: { id: e.id }, select: { contactName: true, contactTitle: true, email: true, phone: true } });
      const data = current ? contactUpdate(current, found) : {};
      if (Object.keys(data).length > 0) {
        await db.exhibitor.updateMany({ where: { id: e.id }, data });
        totals.filled++;
      } else totals.noInfo++;
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  totals.left = await db.exhibitor.count({ where: missingContactWhere(tradeShowId) });
  return totals;
}
