import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { isoDate, today } from "@/lib/dates";
import { checkFoundShows, type FoundShow, foundNote, isDue, newShows, pageToText, runSummary } from "@/lib/show-finder";

// The AI trade show finder. For each chosen exhibition center it downloads the
// center's events page, asks Claude which trade shows are listed there, and
// saves the ones we don't have yet as suggestions for a platform admin to
// approve. It never adds to the trade show list by itself.

/** Which Claude model reads the pages. Can be changed with SHOW_FINDER_MODEL. */
const MODEL = process.env.SHOW_FINDER_MODEL || "claude-opus-5-5";

/** Stop starting new centers after this long, so the run ends within Vercel's time limit. */
const TIME_BUDGET_MS = 150_000;
const PARALLEL = 4;
const FETCH_TIMEOUT_MS = 20_000;
/** Each AI call is cut off after this long, so one slow page can't stall the run. */
const AI_TIMEOUT_MS = 120_000;

export function isShowFinderConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const foundSchema = z.object({
  shows: z.array(
    z.object({
      name: z.string().describe("The show's name, without the year"),
      startDate: z.string().describe("First day, YYYY-MM-DD"),
      endDate: z.string().describe("Last day, YYYY-MM-DD; same as startDate for one-day shows"),
      website: z.string().nullable().describe("Link to the show's own page, or null"),
    }),
  ),
});

const SYSTEM = `You read the events page of an exhibition center and list the trade shows held there.

Count as a trade show: trade fairs, B2B exhibitions and consumer fairs or expos where companies exhibit.
Leave out concerts, sports, theatre, comedy, parties, markets for private sellers, job fairs for single employers, private or corporate events, and conferences or congresses that have no exhibition.

Only list events whose exact start date is written on the page (or in its structured data). If only a month or season is given, leave the event out. Never guess a date.
Write dates as YYYY-MM-DD. When the year is not written, use the next occurrence on or after today's date.
Give the name as the organizer writes it, without the year or edition number.
For website, use the link that belongs to that event (its own website, or its page on the center's site). Use null if there is none.
If the page lists no trade shows, return an empty list.`;

// Many sites turn away requests that don't look like a browser, so ask like one.
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,da;q=0.8,de;q=0.7",
};

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`The events page answered with error ${res.status}.`);
  return res.text();
}

const READER_SYSTEM = `You collect the event listings of an exhibition center from its website, for another step that picks out the trade shows.

Fetch the events page you are given. If the events are not on it (for example because they load with JavaScript, sit on a separate list page, or are split over several pages or months), follow links on the same site that lead to the event listings, such as the full list, the next page or the next months. Do not leave the center's website.

Then write out every upcoming event you found as plain text, one per line: name, dates exactly as written (with the year), and the link to the event if there is one. Write nothing else. If you found no events, write: NO EVENTS FOUND`;

/**
 * Lets Claude read the page with Anthropic's own web fetcher and follow links
 * on the site. Used when our own download is turned away or shows no events.
 */
async function readWithClaude(client: Anthropic, url: string): Promise<string> {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const tools: Anthropic.ToolUnion[] = [{ type: "web_fetch_20260209", name: "web_fetch", allowed_domains: [host], max_uses: 6 }];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Events page: ${url}\nToday's date: ${isoDate(today())}` }];
  for (let round = 0; round < 3; round++) {
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 16000, system: READER_SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout: AI_TIMEOUT_MS },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to read this page.");
    if (response.stop_reason === "pause_turn") {
      // The fetching loop paused; send the turn back so it carries on.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text.includes("NO EVENTS FOUND") && text.length < 40 ? "" : text;
  }
  return "";
}

async function askClaude(client: Anthropic, centerName: string, url: string, pageText: string): Promise<FoundShow[]> {
  const response = await client.messages.parse(
    {
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(foundSchema) },
      messages: [
        {
          role: "user",
          content: `Today's date: ${isoDate(today())}\nExhibition center: ${centerName}\nEvents page: ${url}\n\n<page>\n${pageText}\n</page>`,
        },
      ],
    },
    { timeout: AI_TIMEOUT_MS },
  );
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this page.");
  if (response.stop_reason === "max_tokens") throw new Error("The page lists too many events to read in one go.");
  if (!response.parsed_output) throw new Error("The AI's answer could not be read.");
  return response.parsed_output.shows;
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The AI key (ANTHROPIC_API_KEY) is not valid.";
  if (error instanceof Anthropic.RateLimitError) return "The AI service is busy or the credit is used up. Try again later.";
  if (error instanceof Anthropic.APIError) return `The AI service failed (error ${error.status}).`;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "The events page took too long to answer.";
  if (error instanceof Error && error.message) return error.message.slice(0, 300);
  return "Something went wrong.";
}

type Center = { id: string; name: string; eventsUrl: string | null };

type CheckResult = { fresh: number; note: string };

/** Downloads the page ourselves, then lets Claude read the site if that fails or shows no shows. */
async function findOnPage(client: Anthropic, center: Center & { eventsUrl: string }): Promise<{ found: FoundShow[]; via: string }> {
  let ownError: unknown = null;
  try {
    const { text } = pageToText(await fetchPage(center.eventsUrl), center.eventsUrl);
    if (text.length >= 40) {
      const found = await askClaude(client, center.name, center.eventsUrl, text);
      if (found.length > 0) return { found, via: "page" };
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) throw error;
    ownError = error;
  }

  const listing = await readWithClaude(client, center.eventsUrl);
  if (!listing) {
    if (ownError) throw ownError;
    return { found: [], via: "site" };
  }
  return { found: await askClaude(client, center.name, center.eventsUrl, listing), via: "site" };
}

/** Checks one center and saves what is new, with a note on what was found. */
async function checkCenter(client: Anthropic, center: Center): Promise<CheckResult> {
  if (!center.eventsUrl) throw new Error("The center has no Local events URL.");
  const { found: listed } = await findOnPage(client, { ...center, eventsUrl: center.eventsUrl });
  if (listed.length === 0) {
    return {
      fresh: 0,
      note: "No trade shows with exact dates were found on the events page. Check that the Local events URL is the page that lists the events.",
    };
  }
  const found = checkFoundShows(listed);
  if (found.length === 0) return { fresh: 0, note: foundNote({ listed: listed.length, usable: 0, fresh: 0 }) };

  // Compare with every show and suggestion around those dates, rejected ones
  // included, so nothing is suggested twice.
  const from = new Date(Math.min(...found.map((f) => f.startDate.getTime())) - 30 * 86_400_000);
  const [shows, suggestions] = await Promise.all([
    db.tradeShow.findMany({ where: { startDate: { gte: from } }, select: { name: true, startDate: true } }),
    db.suggestedShow.findMany({ where: { startDate: { gte: from } }, select: { name: true, startDate: true } }),
  ]);
  const fresh = newShows(found, [...shows, ...suggestions]);
  if (fresh.length > 0) {
    await db.suggestedShow.createMany({
      data: fresh.map((f) => ({ ...f, centerId: center.id, sourceUrl: center.eventsUrl! })),
    });
  }
  return { fresh: fresh.length, note: foundNote({ listed: listed.length, usable: found.length, fresh: fresh.length }) };
}

/**
 * Checks the chosen centers, oldest check first. The monthly run only checks
 * centers that are due; "Check now" checks all of them. Centers not reached
 * within the time budget are first in line next time.
 */
export async function runShowFinder({ onlyDue }: { onlyDue: boolean }): Promise<string> {
  if (!isShowFinderConfigured()) return "Add ANTHROPIC_API_KEY in Vercel before the finder can run.";

  const started = Date.now();
  const chosen = await db.exhibitionCenter.findMany({
    where: { findShows: true, eventsUrl: { not: null } },
    orderBy: [{ showsCheckedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: { id: true, name: true, eventsUrl: true, showsCheckedAt: true },
  });
  const queue = onlyDue ? chosen.filter((c) => isDue(c.showsCheckedAt)) : chosen;
  // The daily run usually has nothing to do; keep the last real summary then.
  if (onlyDue && queue.length === 0) return "No centers were due for a check.";

  const client = new Anthropic();
  const totals = { checked: 0, found: 0, failed: 0, left: 0 };
  let next = 0;
  async function worker() {
    while (next < queue.length && Date.now() - started < TIME_BUDGET_MS) {
      const center = queue[next++];
      try {
        const { fresh, note } = await checkCenter(client, center);
        totals.found += fresh;
        await db.exhibitionCenter.update({
          where: { id: center.id },
          data: { showsCheckedAt: new Date(), showsCheckError: null, showsCheckNote: note, showsFoundLast: fresh },
        });
      } catch (error) {
        totals.failed++;
        await db.exhibitionCenter.update({
          where: { id: center.id },
          data: { showsCheckedAt: new Date(), showsCheckError: describeError(error), showsCheckNote: null, showsFoundLast: null },
        });
      }
      totals.checked++;
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  totals.left = queue.length - totals.checked;

  const summary = chosen.length === 0 ? "No centers are chosen yet." : runSummary(totals);
  await db.showFinderSettings.upsert({
    where: { id: 1 },
    create: { id: 1, lastRunAt: new Date(), lastRunSummary: summary },
    update: { lastRunAt: new Date(), lastRunSummary: summary },
  });
  return summary;
}
