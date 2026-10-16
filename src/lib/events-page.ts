import { decodeEntities } from "@/lib/show-finder";

// Pure helpers for finding an exhibition center's own events page (its
// "Local events URL"): the links on its homepage, and checking what the AI
// picked. The part that downloads pages and calls the AI is in
// events-page-run.ts.

/** At most this many homepage links are shown to the AI. */
export const MAX_LINKS = 200;

// Words in a link's address or text that point to a list of events, in the languages centers use.
const EVENT_WORDS =
  /event|calendar|kalender|calendrier|calendario|agenda|program|what'?s[- ]on|exhibitions?|trade[- ]?(fairs?|shows?)|fairs?\b|messen|messe|veranstaltung|arrangement|begivenhed|evenement|événement|evento|eventi|fiere|ferias?|salons?|tentoonstelling|beurs|targi|wydarzen|выставк|展示会|イベント|展会|活动|전시/i;

export type SiteLink = { url: string; label: string };

const host = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");

/** Whether two addresses are on the same website, counting subdomains such as events.messe.de. */
export function sameSite(a: string, b: string): boolean {
  try {
    const x = host(new URL(a));
    const y = host(new URL(b));
    return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
  } catch {
    return false;
  }
}

/** An address in one form, so the same page written two ways compares equal. */
export function normalizeUrl(value: string): string | null {
  try {
    const u = new URL(value.trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return null;
  }
}

/** Adds https:// to an address typed without it, e.g. "messe-berlin.de". */
export function withScheme(value: string): string {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * The links on a homepage that stay on the center's own website, with the
 * text they show. Links that look like an events list come first, so they
 * are kept when a page has more links than the AI is shown.
 */
export function siteLinks(html: string, pageUrl: string, max = MAX_LINKS): SiteLink[] {
  const found = new Map<string, SiteLink & { rank: number }>();
  for (const [, href, inner] of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(decodeEntities(href), pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || !sameSite(url.toString(), pageUrl)) continue;
    if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|ics)$/i.test(url.pathname)) continue;
    const key = normalizeUrl(url.toString());
    if (!key || key === normalizeUrl(pageUrl)) continue;
    const label = decodeEntities(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 80);
    let path = url.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      // Keep the path as written.
    }
    const rank = EVENT_WORDS.test(`${path} ${label}`) ? 0 : 1;
    const known = found.get(key);
    if (!known) found.set(key, { url: key, label, rank });
    else if (rank < known.rank || (!known.label && label)) found.set(key, { url: key, label: label || known.label, rank: Math.min(rank, known.rank) });
  }
  return [...found.values()]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, max)
    .map(({ url, label }) => ({ url, label }));
}

/** The AI's pick, if it is one of the links it was shown; otherwise null, so an invented address is never saved. */
export function pickFromLinks(picked: string | null, links: SiteLink[]): string | null {
  const key = picked && normalizeUrl(picked);
  if (!key) return null;
  return links.find((l) => l.url === key)?.url ?? null;
}

/** What the AI's web search found, read from its last lines "WEBSITE: …" and "EVENTS: …". */
export function parseSearchAnswer(text: string): { website: string | null; eventsUrl: string | null } {
  const line = (label: string) => {
    const m = text.match(new RegExp(`^\\s*\\**${label}\\**\\s*:\\s*<?(\\S+?)>?\\s*$`, "im"));
    return m && !/^none$/i.test(m[1]) ? normalizeUrl(m[1]) : null;
  };
  return { website: line("WEBSITE"), eventsUrl: line("EVENTS") };
}

/**
 * Keeps an address from the web search only when the search or fetch really
 * returned it (so it was not made up) and, when the center has a website,
 * it is on that website.
 */
export function checkSearchedUrl(url: string | null, seen: string[], website: string | null): string | null {
  if (!url) return null;
  const known = new Set(seen.map(normalizeUrl).filter(Boolean));
  if (!known.has(url)) return null;
  if (website && !sameSite(url, website)) return null;
  return url;
}

export type EventsPageFillResult = {
  /** Centers that got their events page filled in. */
  filled: number;
  /** Centers where no events page was found. */
  notFound: number;
  failed: number;
  left: number;
  /** Why the run stopped early, e.g. an invalid AI key. */
  stoppedBy?: string;
};

/** A short sentence on what a run did, for the page. */
export function eventsPageSummary(r: EventsPageFillResult): string {
  const parts = [`AI found the events page of ${r.filled} ${r.filled === 1 ? "center" : "centers"}.`];
  if (r.notFound) parts.push(`${r.notFound} ${r.notFound === 1 ? "center has" : "centers have"} no events page AI could find; add those by hand.`);
  if (r.failed) parts.push(`${r.failed} ${r.failed === 1 ? "website" : "websites"} could not be read.`);
  if (r.stoppedBy) parts.push(`Stopped: ${r.stoppedBy}`);
  if (r.left) parts.push(`${r.left} still to look up; press the button again to go on.`);
  return parts.join(" ");
}
