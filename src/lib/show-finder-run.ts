import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { isoDate, today } from "@/lib/dates";
import { checkFoundShows, type FoundShow, isDue, newShows, pageToText, runSummary } from "@/lib/show-finder";

// The AI trade show finder. For each chosen exhibition center it downloads the
// center's events page, asks Claude which trade shows are listed there, and
// saves the ones we don't have yet as suggestions for a platform admin to
// approve. It never adds to the trade show list by itself.

/** Which Claude model reads the pages. Can be changed with SHOW_FINDER_MODEL. */
const MODEL = process.env.SHOW_FINDER_MODEL || "claude-opus-5-5";

/** Stop starting new centers after this long, so the run ends within Vercel's time limit. */
const TIME_BUDGET_MS = 200_000;
const PARALLEL = 4;
const FETCH_TIMEOUT_MS = 20_000;

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

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TradeShowSystem/1.0; +https://trade-show-system.vercel.app)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en,da;q=0.8,de;q=0.6",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`The events page answered with error ${res.status}.`);
  return res.text();
}

async function askClaude(client: Anthropic, centerName: string, url: string, pageText: string): Promise<FoundShow[]> {
  const response = await client.messages.parse({
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
  });
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

/** Checks one center and saves what is new. Returns how many new shows were found. */
async function checkCenter(client: Anthropic, center: Center): Promise<number> {
  if (!center.eventsUrl) throw new Error("The center has no Local events URL.");
  const { text } = pageToText(await fetchPage(center.eventsUrl), center.eventsUrl);
  if (text.length < 40) throw new Error("The events page has no readable text. It may only show its events with JavaScript.");

  const found = checkFoundShows(await askClaude(client, center.name, center.eventsUrl, text));
  if (found.length === 0) return 0;

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
  return fresh.length;
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
        const count = await checkCenter(client, center);
        totals.found += count;
        await db.exhibitionCenter.update({
          where: { id: center.id },
          data: { showsCheckedAt: new Date(), showsCheckError: null, showsFoundLast: count },
        });
      } catch (error) {
        totals.failed++;
        await db.exhibitionCenter.update({
          where: { id: center.id },
          data: { showsCheckedAt: new Date(), showsCheckError: describeError(error), showsFoundLast: null },
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
