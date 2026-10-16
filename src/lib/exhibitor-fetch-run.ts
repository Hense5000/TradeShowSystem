import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { today } from "@/lib/dates";
import { type FoundExhibitor, MIN_LIST_CHARS, splitText, withLoadedData } from "@/lib/exhibitor-fetch";
import { renderPage } from "@/lib/render-page";
import { pageToText } from "@/lib/show-finder";
import { BROWSER_HEADERS } from "@/lib/show-finder-run";

// Reads one page of a trade show's exhibitor directory with Claude: which
// exhibitors are listed there, and which other pages of the list to read
// next (page 2, the letters A-Z and so on). The page is downloaded by us
// first; when that is turned away or shows no exhibitors, Claude reads the
// page with Anthropic's own web fetcher instead.

/** Which Claude model reads the directory. Can be changed with EXHIBITOR_FETCH_MODEL. */
const MODEL = process.env.EXHIBITOR_FETCH_MODEL || "claude-opus-5-5";

const FETCH_TIMEOUT_MS = 20_000;
const AI_TIMEOUT_MS = 120_000;
/** Parts of one long page read side by side; a page is at most 5 parts (MAX_PAGE_CHARS / PART_CHARS). */
const PARALLEL = 5;

export function isExhibitorFetchConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Shows "Fetch exhibitors for all" goes through: not over yet, no exhibitors, and not tried by it before. */
export function withoutExhibitorsWhere(day = today()): Prisma.TradeShowWhereInput {
  return { endDate: { gte: day }, exhibitorsTriedAt: null, exhibitors: { none: {} } };
}

const foundSchema = z.object({
  exhibitors: z.array(
    z.object({
      name: z.string().describe("Company name as written"),
      website: z.string().nullable().describe("The company's own website, or null"),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      country: z.string().nullable().describe("Country name in English, or null"),
      industry: z.string().nullable().describe("Product group or category given in the list, or null"),
      boothNumber: z.string().nullable().describe("Booth or stand number, e.g. 'Hall B, B123', or null"),
    }),
  ),
  otherPages: z.array(z.string()).describe("Links to further pages of this same exhibitor list"),
});

const SYSTEM = `You read one page of a trade show's exhibitor directory (the list of companies exhibiting at the show) and list the exhibitors on it.

For each exhibitor give the company name as written, and, only when the page shows it for that company: its own website, email, phone, country, industry or product group, and booth or stand number. Use null for anything the page does not show. Never guess.
A link to the exhibitor's profile page on the show's own website is not the company's website; leave website null then.
Leave out sponsors' adverts, the organizer itself, menu items, filters and anything that is not an exhibiting company.

In otherPages, give the links (full addresses, as written on the page) to further pages of this same exhibitor list: the next page, numbered pages, letter pages (A, B, C ...) or a "show all" page. Leave out links to single exhibitors' profiles, filters by country or category, and other parts of the website.
The page may be only part of a longer page; list what is in this part. If it lists no exhibitors, return empty lists.`;

const READER_SYSTEM = `You collect a trade show's exhibitor list from its website, for another step that picks out the exhibitors.

Fetch the page you are given. Then write out every exhibiting company on it as plain text, one per line, with whatever the page shows for it (website, email, phone, country, product group, booth or stand number). After that, write the links to further pages of the same exhibitor list (next page, numbered pages, letter pages A-Z) as full addresses, one per line. Write nothing else. If the page lists no exhibitors, write: NO EXHIBITORS FOUND`;

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`The exhibitor list answered with error ${res.status}.`);
  return res.text();
}

/** Lets Claude read the page with Anthropic's web fetcher, for pages that turn our own download away. */
async function readWithClaude(client: Anthropic, url: string): Promise<string> {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const tools: Anthropic.ToolUnion[] = [{ type: "web_fetch_20260209", name: "web_fetch", allowed_domains: [host], max_uses: 2 }];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Exhibitor list page: ${url}` }];
  for (let round = 0; round < 3; round++) {
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 32000, system: READER_SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout: AI_TIMEOUT_MS },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to read this page.");
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text.includes("NO EXHIBITORS FOUND") && text.length < 40 ? "" : text;
  }
  return "";
}

type PageResult = { exhibitors: FoundExhibitor[]; otherPages: string[] };

async function askClaude(client: Anthropic, showName: string, url: string, part: string, partNo: number, parts: number): Promise<PageResult> {
  const response = await client.messages.parse(
    {
      model: MODEL,
      max_tokens: 32000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(foundSchema) },
      messages: [
        {
          role: "user",
          content: `Trade show: ${showName}\nPage: ${url}${parts > 1 ? `\nThis is part ${partNo} of ${parts} of the page.` : ""}\n\n<page>\n${part}\n</page>`,
        },
      ],
    },
    { timeout: AI_TIMEOUT_MS },
  );
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this page.");
  if (response.stop_reason === "max_tokens") throw new Error("The page lists too many exhibitors to read in one go.");
  if (!response.parsed_output) throw new Error("The AI's answer could not be read.");
  return response.parsed_output;
}

/** Reads the text in parts, a few side by side, and puts the answers together. */
async function readText(client: Anthropic, showName: string, url: string, text: string): Promise<PageResult> {
  const parts = splitText(text);
  const answers: PageResult[] = new Array(parts.length);
  let next = 0;
  async function worker() {
    while (next < parts.length) {
      const i = next++;
      answers[i] = await askClaude(client, showName, url, parts[i], i + 1, parts.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, parts.length) }, worker));
  return { exhibitors: answers.flatMap((a) => a.exhibitors), otherPages: answers.flatMap((a) => a.otherPages) };
}

/**
 * The exhibitors on one page of the directory, and links to its other pages.
 * First the page as it is downloaded; if that holds no list (many
 * directories fill the list in with JavaScript), the page opened in a real
 * browser, together with the data it loads; and if the browser can't open
 * it, Anthropic's web fetcher.
 */
export async function readDirectoryPage(showName: string, url: string, client = new Anthropic()): Promise<PageResult> {
  let lastError: unknown = null;
  try {
    const { text } = pageToText(await fetchPage(url), url);
    if (text.length >= MIN_LIST_CHARS) {
      const result = await readText(client, showName, url, text);
      if (result.exhibitors.length > 0) return result;
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) throw error;
    lastError = error;
  }

  try {
    const rendered = await renderPage(url);
    const text = withLoadedData(pageToText(rendered.html, url).text, rendered.data);
    return text.length >= 200 ? await readText(client, showName, url, text) : { exhibitors: [], otherPages: [] };
  } catch (error) {
    if (error instanceof Anthropic.APIError) throw error;
    console.error("Opening the exhibitor list in a browser failed", url, error);
    lastError ??= error;
  }

  const listing = await readWithClaude(client, url);
  if (!listing) {
    if (lastError) throw lastError;
    return { exhibitors: [], otherPages: [] };
  }
  return readText(client, showName, url, listing);
}

/** Whether the AI service itself turned the call away (bad key, no credit), so every further page would fail too. */
export function isServiceDown(error: unknown): boolean {
  return error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.RateLimitError;
}

export function describeFetchError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The AI key (ANTHROPIC_API_KEY) is not valid.";
  if (error instanceof Anthropic.RateLimitError) return "The AI service is busy or the credit is used up. Try again later.";
  if (error instanceof Anthropic.APIError) return `The AI service failed (error ${error.status}).`;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "The exhibitor list took too long to answer.";
  if (error instanceof Error && error.message) return error.message.slice(0, 300);
  return "Something went wrong.";
}
