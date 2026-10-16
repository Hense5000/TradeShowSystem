import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { countryName } from "@/lib/countries";
import { answerLine, normalizeUrl, pickFromLinks, type SiteLink, siteLinks, withScheme } from "@/lib/events-page";
import { seenUrls } from "@/lib/events-page-run";
import { directoryCandidate, EXHIBITOR_WORDS } from "@/lib/exhibitor-fetch";
import { renderPage } from "@/lib/render-page";
import { BROWSER_HEADERS } from "@/lib/show-finder-run";

// Finds a trade show's exhibitor directory (the "Exhibitor directory URL"
// that "Fetch exhibitors" reads). AI first picks it from the links on the
// show's own website; when that finds nothing, Claude searches the web.
// Only an address that was really on a page or in the search results is
// kept (or, for a page on a website the search looked at, one that answers),
// never a guessed one. The directory may be on another site than the show's
// own, since many shows use an exhibitor platform for it.

/** Which Claude model looks for the directory. Can be changed with DIRECTORY_URL_MODEL. */
const MODEL = process.env.DIRECTORY_URL_MODEL || "claude-opus-5-5";

const FETCH_TIMEOUT_MS = 15_000;
/** All the AI calls for one show stop after this long, so the call ends well within the page's 300 seconds. */
const BUDGET_MS = 200_000;
/** A homepage with fewer links than this is probably built with JavaScript; open it in Chrome instead. */
const FEW_LINKS = 10;

export type ShowForSearch = { name: string; startDate: Date; city: string | null; country: string | null; website: string | null };

const pickSchema = z.object({
  directoryUrl: z.string().nullable().describe("The chosen link exactly as listed, or null if none of them is the exhibitor list"),
});

const PICK_SYSTEM = `You find a trade show's exhibitor list from the links on the show's website.

Pick the one link that leads to the list of companies exhibiting at the show, often called "Exhibitor list", "Exhibitor directory", "Exhibitors", "Ausstellerverzeichnis", "Liste des exposants" or similar. It may lead to an exhibitor platform on another website.
Do not pick a page for companies who want to book a stand ("Become an exhibitor", "Exhibit", "Book a stand"), exhibitor manuals or services, sponsors, speakers, news or tickets.
Only pick a link from the list, exactly as written. If none of them is the exhibitor list, return null.`;

const SEARCH_SYSTEM = `You find a trade show's exhibitor list: the page on the web that lists the companies exhibiting at the show (often called "Exhibitor list", "Exhibitor directory", "Exhibitors", "Ausstellerverzeichnis" or "Liste des exposants").

Search the web for the show and open its official website. Find the page listing this edition's exhibitors; it may be on the show's own website or on an exhibitor platform the show links to. If this edition's list is not out yet, the list of the previous edition on the same website is fine. Do not use a page for companies who want to book a stand, a press release, news sites, social media or another show's list.
Only give an address you actually saw in your search results or on fetched pages; never guess or build one. If the show has no public exhibitor list, say NONE.

End your answer with exactly this line:
DIRECTORY: <the exhibitor list's address, or NONE>`;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`The website answered with error ${res.status}.`);
  return res.text();
}

/** All links on the show's homepage, exhibitor-list-like ones first; a page built with JavaScript is opened in a headless Chrome. */
async function homepageLinks(website: string): Promise<SiteLink[]> {
  const read = (html: string) => siteLinks(html, website, undefined, { anyHost: true, words: EXHIBITOR_WORDS });
  let links: SiteLink[] = [];
  try {
    links = read(await fetchHtml(website));
  } catch {
    // Turned away or not answering; Chrome tries next.
  }
  if (links.length >= FEW_LINKS) return links;
  try {
    const rendered = read((await renderPage(website)).html);
    return rendered.length > links.length ? rendered : links;
  } catch {
    return links;
  }
}

async function pickLink(client: Anthropic, show: ShowForSearch, website: string, links: SiteLink[], timeout: number): Promise<string | null> {
  const list = links.map((l) => `${l.url}${l.label ? ` — ${l.label}` : ""}`).join("\n");
  const response = await client.messages.parse(
    {
      model: MODEL,
      max_tokens: 2000,
      system: PICK_SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(pickSchema) },
      messages: [{ role: "user", content: `Trade show: ${show.name}\nWebsite: ${website}\n\nLinks on the website's homepage:\n${list}` }],
    },
    { timeout },
  );
  if (response.stop_reason === "refusal") throw new Error("The AI declined to read this website.");
  return pickFromLinks(response.parsed_output?.directoryUrl ?? null, links);
}

/** Whether a page answers at all; a missing page (404, 410) does not count, a page that turns robots away does. */
async function pageExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    await res.body?.cancel();
    return res.status !== 404 && res.status !== 410;
  } catch {
    // Not reachable from here; the directory reader also tries other ways in.
    return true;
  }
}

async function searchForDirectory(client: Anthropic, show: ShowForSearch, deadline: number): Promise<string | null> {
  const where = [show.city, show.country && countryName(show.country)].filter(Boolean).join(", ");
  const tools: Anthropic.ToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 },
  ];
  const lines = [
    `Trade show: ${show.name}`,
    `Starts: ${show.startDate.toISOString().slice(0, 10)}`,
    where && `Location: ${where}`,
    show.website && `Show website: ${show.website}`,
  ];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: lines.filter(Boolean).join("\n") }];
  const seen: string[] = show.website ? [show.website] : [];
  for (let round = 0; round < 3; round++) {
    const timeout = deadline - Date.now();
    if (timeout < 20_000) return null;
    const response = await client.messages.create(
      { model: MODEL, max_tokens: 8000, system: SEARCH_SYSTEM, output_config: { effort: "low" }, tools, messages },
      { timeout },
    );
    if (response.stop_reason === "refusal") throw new Error("The AI declined to look up this trade show.");
    seen.push(...seenUrls(response.content));
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const url = answerLine(text, "DIRECTORY");
    const found = directoryCandidate(url, seen);
    if (!url || !found) return null;
    if (found === "sameHost" && !(await pageExists(url))) return null;
    return url;
  }
  return null;
}

/** The show's exhibitor directory address, or null when AI found none. */
export async function findDirectoryUrl(show: ShowForSearch, client = new Anthropic()): Promise<string | null> {
  const deadline = Date.now() + BUDGET_MS;
  const website = show.website ? normalizeUrl(withScheme(show.website)) : null;
  if (website) {
    const links = await homepageLinks(website);
    if (links.length > 0) {
      const picked = await pickLink(client, show, website, links, 90_000);
      if (picked) return picked;
    }
  }
  return searchForDirectory(client, { ...show, website }, deadline);
}
