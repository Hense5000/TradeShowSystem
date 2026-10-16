import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { describeProfileError, isCompanyProfileConfigured } from "@/lib/company-profile-run";
import { countryName } from "@/lib/countries";
import { db } from "@/lib/db";
import {
  checkSearchedUrl,
  type EventsPageFillResult,
  normalizeUrl,
  parseSearchAnswer,
  pickFromLinks,
  type SiteLink,
  siteLinks,
  withScheme,
} from "@/lib/events-page";
import { renderPage } from "@/lib/render-page";
import { BROWSER_HEADERS } from "@/lib/show-finder-run";

// Finds an exhibition center's own page listing its upcoming events (the
// "Local events URL" the AI trade show finder reads). AI picks the page from
// the links on the center's homepage; when the homepage can't be read, or the
// center has no website, it searches the web for the center's official site.
// Only addresses that really exist on the site are kept, never a guessed one.

/** Which Claude model picks the page. Can be changed with EVENTS_PAGE_MODEL. */
const MODEL = process.env.EVENTS_PAGE_MODEL || "claude-opus-5-5";

const FETCH_TIMEOUT_MS = 15_000;
const AI_TIMEOUT_MS = 90_000;
const PARALLEL = 5;
/** A homepage with fewer links than this is probably built with JavaScript; open it in Chrome instead. */
const FEW_LINKS = 10;

/** The same AI key as the company profiles. */
export const isEventsPageFinderConfigured = isCompanyProfileConfigured;
export const describeEventsPageError = describeProfileError;

export type Center = { name: string; city: string | null; country: string | null; website: string | null };
export type FoundEventsPage = { eventsUrl: string; website: string | null };

const pickSchema = z.object({
  eventsUrl: z.string().nullable().describe("The chosen link exactly as listed, or null if none of them is the events list"),
});

const PICK_SYSTEM = `You find an exhibition center's own page that lists its upcoming events, from the links on the center's homepage.

Pick the one link that leads to the list or calendar of upcoming events held at the venue: trade fairs, exhibitions, congresses and other events. Words such as "Events", "Calendar", "What's on", "Trade fairs", "Veranstaltungen", "Messen", "Kalender" or "Agenda" usually point to it.
If there are several, prefer the full list of all upcoming events over one category, one single event, past events, news or a page for organizers who want to rent the venue. Prefer the page in English when the same list exists in several languages.
Only pick a link from the list, exactly as written. If none of them is the list of events, return null.`;

const SEARCH_SYSTEM = `You find an exhibition center's official website and the page on it that lists the upcoming events held at the venue (its event calendar), for a trade show directory.

Search the web for the center and open its official website. Find the page listing upcoming trade fairs, exhibitions and other events at the venue; prefer the full list of all upcoming events, in English when there is one. Do not use ticket shops, event directories, news sites or social media, only the center's own website (or its operator's website, if the operator's site holds the venue's calendar).
Only give addresses you actually saw in your search results or on fetched pages; never guess or build one.

End your answer with exactly these two lines:
WEBSITE: <the official website's address, or NONE>
EVENTS: <the events page's address, or NONE>`;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`The website answered with error ${res.status}.`);
  return res.text();
}

/** The links on the homepage; a page built with JavaScript is opened in a headless Chrome. */
async function homepageLinks(website: string): Promise<SiteLink[]> {
  let links: SiteLink[] = [];
  try {
    links = siteLinks(await fetchHtml(website), website);
  } catch {
    // Turned away or not answering; the web search tries next.
    return [];
  }
  if (links.length >= FEW_LINKS) return links;
  try {
    const rendered = siteLinks((await renderPage(website)).html, website);
    return rendered.length > links.length ? rendered : links;
  } catch {
    return links;
  }
}

async function pickLink(client: Anthropic, center: Center, website: string, links: SiteLink[]): Promise<string | null> {
  const list = links.map((l) => `${l.url}${l.label ? ` — ${l.label}` : ""}`).join("\n");
  const response = await client.messages.parse(
    {
      model: MODEL,
      max_tokens: 2000,
      system: PICK_SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(pickSchema) },
      messages: [{ role: "user", content: `Exhibition center: ${center.name}\nHomepage: ${website}\n\nLinks on the homepage:\n${list}` }],
    },
    { timeout: AI_TIMEOUT_MS },
  );
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this website.");
  return pickFromLinks(response.parsed_output?.eventsUrl ?? null, links);
}

/** Every address the web search and the web fetcher returned, so the answer can be checked against them. */
function seenUrls(content: Anthropic.ContentBlock[]): string[] {
  const urls: string[] = [];
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) urls.push(r.url);
    } else if (block.type === "web_fetch_tool_result" && block.content.type === "web_fetch_result") {
      urls.push(block.content.url);
      // Links on the fetched page count as seen too.
      const doc = block.content.content;
      if (doc.source.type === "text") {
        for (const [href] of doc.source.data.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) urls.push(href);
      }
    } else if (block.type === "text") {
      for (const c of block.citations ?? []) if ("url" in c && c.url) urls.push(c.url);
    }
  }
  return urls;
}

/** Lets Claude search the web and read the center's site, for centers whose homepage we can't read or don't know. */
async function searchForPage(client: Anthropic, center: Center): Promise<FoundEventsPage | null> {
  const where = [center.city, center.country && countryName(center.country)].filter(Boolean).join(", ");
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 },
  ];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Exhibition center: ${center.name}${where ? `\nLocation: ${where}` : ""}${center.website ? `\nWebsite: ${center.website} (only use this website)` : ""}`,
    },
  ];
  const seen: string[] = [];
  for (let round = 0; round < 3; round++) {
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 8000, system: SEARCH_SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout: AI_TIMEOUT_MS },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to look up this center.");
    seen.push(...seenUrls(response.content));
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const answer = parseSearchAnswer(text);
    const website = center.website ?? checkSearchedUrl(answer.website, seen, null);
    const eventsUrl = checkSearchedUrl(answer.eventsUrl, seen, website);
    if (!eventsUrl) return null;
    return { eventsUrl, website: center.website ? null : website };
  }
  return null;
}

/**
 * The center's events page (and its website, when that was empty and the web
 * search found it), or null when AI found no events page. The homepage's own
 * links are tried first; the web search is the fallback.
 */
export async function findEventsPage(center: Center, client = new Anthropic()): Promise<FoundEventsPage | null> {
  const website = center.website ? normalizeUrl(withScheme(center.website)) : null;
  if (website) {
    const links = await homepageLinks(website);
    if (links.length > 0) {
      const picked = await pickLink(client, center, website, links);
      if (picked) return { eventsUrl: picked, website: null };
    }
  }
  return searchForPage(client, { ...center, website });
}

/** Centers with no events page that AI has not tried yet. */
export const missingEventsPageWhere: Prisma.ExhibitionCenterWhereInput = { eventsUrl: null, eventsUrlTriedAt: null };

/**
 * Looks up the missing events pages, a few at a time, until they are all done
 * or the time budget is used up. Only empty fields are filled. Each center is
 * tried once, so one without an events page is not searched again and again.
 */
export async function fillMissingEventsPages({ budgetMs, limit = 500 }: { budgetMs: number; limit?: number }): Promise<EventsPageFillResult> {
  const started = Date.now();
  const totals: EventsPageFillResult = { filled: 0, notFound: 0, failed: 0, left: 0 };
  if (!isEventsPageFinderConfigured()) {
    totals.left = await db.exhibitionCenter.count({ where: missingEventsPageWhere });
    return totals;
  }

  const queue = await db.exhibitionCenter.findMany({
    where: missingEventsPageWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, country: true, website: true },
    take: limit,
  });
  const client = new Anthropic();
  let next = 0;
  let stopped = false;
  async function worker() {
    while (!stopped && next < queue.length && Date.now() - started < budgetMs) {
      const c = queue[next++];
      let found: FoundEventsPage | null = null;
      try {
        found = await findEventsPage(c, client);
      } catch (error) {
        // A busy or broken AI service fails every center; stop and leave them for the next run.
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.RateLimitError) {
          stopped = true;
          totals.stoppedBy = describeEventsPageError(error);
          return;
        }
        totals.failed++;
        await db.exhibitionCenter.updateMany({ where: { id: c.id }, data: { eventsUrlTriedAt: new Date() } });
        continue;
      }
      // Only fill what is still empty, in case someone typed it in meanwhile.
      const saved = found
        ? await db.exhibitionCenter.updateMany({ where: { id: c.id, eventsUrl: null }, data: { eventsUrl: found.eventsUrl, eventsUrlTriedAt: new Date() } })
        : { count: 0 };
      if (found?.website) await db.exhibitionCenter.updateMany({ where: { id: c.id, website: null }, data: { website: found.website } });
      if (saved.count > 0) totals.filled++;
      else {
        totals.notFound++;
        await db.exhibitionCenter.updateMany({ where: { id: c.id }, data: { eventsUrlTriedAt: new Date() } });
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  totals.left = await db.exhibitionCenter.count({ where: missingEventsPageWhere });
  return totals;
}
