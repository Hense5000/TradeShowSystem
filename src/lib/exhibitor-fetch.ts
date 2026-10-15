import { findCountryCode } from "@/lib/countries";
import { exhibitorKey } from "@/lib/exhibitors";

// Pure helpers for fetching a trade show's exhibitors from its exhibitor
// directory: splitting a long page into parts the AI can read, checking what
// it found and keeping track of the directory's other pages. The part that
// downloads pages and calls the AI is in exhibitor-fetch-run.ts.

/** A directory page's text is read in parts of about this size, so a long A-Z list fits in the AI's answer. */
export const PART_CHARS = 40_000;

/** At most this many pages of one directory are read in one go, so a huge site can't run forever. */
export const MAX_PAGES = 60;

/** A page's own text shorter than this has no real list in it; the list is probably built by the page's scripts. */
export const MIN_LIST_CHARS = 2_000;

/** Total size of the text read from one page, the data it loaded included. */
export const MAX_READ_CHARS = 200_000;

const SKIPPED_KEY = /image|logo|img|photo|thumb|banner|video|avatar|icon|color|colour|style|html|token|tracking/i;

/**
 * Shrinks loaded JSON to what can name an exhibitor: long texts (company
 * descriptions), pictures and styling are dropped, so more companies fit.
 * Text that is not JSON is returned as it is.
 */
export function compactJson(body: string): string {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return body;
  }
  const shrink = (v: unknown): unknown => {
    if (typeof v === "string") return v.length > 300 ? undefined : v;
    if (Array.isArray(v)) return v.map(shrink).filter((x) => x !== undefined && x !== null && x !== "");
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        if (SKIPPED_KEY.test(k)) continue;
        const y = shrink(x);
        if (y !== undefined && y !== null && y !== "" && !(Array.isArray(y) && y.length === 0)) out[k] = y;
      }
      return Object.keys(out).length > 0 ? out : undefined;
    }
    return v;
  };
  return JSON.stringify(shrink(value) ?? null);
}

/**
 * Adds the JSON a page loaded in the background to its text, largest first
 * (the full list is usually the biggest), as far as there is room.
 */
export function withLoadedData(text: string, data: string[], max = MAX_READ_CHARS): string {
  let result = text;
  const sorted = [...new Set(data.map(compactJson))].filter((d) => d.length > 200).sort((a, b) => b.length - a.length);
  let first = true;
  for (const blob of sorted) {
    const room = max - result.length - 40;
    if (room < 500) break;
    if (first) result += "\n\nData the page loaded:";
    first = false;
    result += `\n${blob.length > room ? blob.slice(0, room) : blob}`;
  }
  return result;
}

/** Splits a page's text into parts of at most `size` characters, cutting between lines. */
export function splitText(text: string, size = PART_CHARS): string[] {
  const parts: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current && current.length + line.length + 1 > size) {
      parts.push(current);
      current = "";
    }
    // A single line longer than a part is cut, so no part grows past the size.
    for (let rest = line; rest; rest = rest.slice(size)) {
      const piece = rest.slice(0, size);
      if (current && current.length + piece.length + 1 > size) {
        parts.push(current);
        current = "";
      }
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** An exhibitor the AI reported, before it is checked. */
export type FoundExhibitor = {
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  industry: string | null;
  boothNumber: string | null;
};

/** A found exhibitor that passed the checks, ready to save. */
export type CheckedExhibitor = FoundExhibitor;

const text = (value: string | null, max: number) => {
  const v = value?.replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
};

/** A full http(s) address, or null; "example.com" becomes "https://example.com". */
export function cleanWebsite(value: string | null): string | null {
  const v = value?.trim();
  if (!v || /\s/.test(v) || /^(mailto|tel|javascript):/i.test(v)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function cleanEmail(value: string | null): string | null {
  const v = value?.trim().toLowerCase().replace(/^mailto:/, "");
  return v && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(v) ? v : null;
}

function cleanPhone(value: string | null): string | null {
  const v = value?.trim();
  return v && /^\+?[\d\s().-]{5,30}$/.test(v) ? v : null;
}

/**
 * Tidies the exhibitors the AI found, drops entries without a name and keeps
 * each company once. A company's website is left out when it is a page on
 * the directory's own site, since that is not the company's homepage.
 */
export function checkFoundExhibitors(found: FoundExhibitor[], directoryUrl: string): CheckedExhibitor[] {
  let directoryHost = "";
  try {
    directoryHost = new URL(directoryUrl).hostname.replace(/^www\./, "");
  } catch {
    // Not a valid address; every website is then kept.
  }
  const seen = new Set<string>();
  const result: CheckedExhibitor[] = [];
  for (const f of found) {
    const name = text(f.name, 150);
    if (!name) continue;
    const key = exhibitorKey({ name });
    if (seen.has(key)) continue;
    seen.add(key);
    let website = cleanWebsite(f.website);
    if (website && directoryHost && new URL(website).hostname.replace(/^www\./, "") === directoryHost) website = null;
    result.push({
      name,
      website,
      email: cleanEmail(f.email),
      phone: cleanPhone(f.phone),
      country: f.country ? findCountryCode(f.country) : null,
      industry: text(f.industry, 100),
      boothNumber: text(f.boothNumber, 50),
    });
  }
  return result;
}

/** A page address without its #fragment, for telling pages apart. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * The other pages of the directory worth reading: full http(s) addresses on
 * the same site as the directory, not read yet and not already waiting.
 */
export function morePages(links: string[], directoryUrl: string, known: Iterable<string>): string[] {
  const host = new URL(directoryUrl).hostname.replace(/^www\./, "");
  const seen = new Set([...known].map(pageKey));
  const result: string[] = [];
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link.trim(), directoryUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || url.hostname.replace(/^www\./, "") !== host) continue;
    const key = pageKey(url.toString());
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

/** What a fetch did, e.g. "Read 4 pages of the exhibitor list. Found 212 exhibitors: 198 added, 14 already listed." */
export function fetchSummary(r: { pages: number; found: number; added: number; failedPages: number; morePagesLeft: number }): string {
  const parts = [`Read ${r.pages} ${r.pages === 1 ? "page" : "pages"} of the exhibitor list.`];
  if (r.found === 0) parts.push("No exhibitors were found.");
  else {
    const known = r.found - r.added;
    parts.push(`Found ${r.found} ${r.found === 1 ? "exhibitor" : "exhibitors"}: ${r.added} added${known > 0 ? `, ${known} already listed` : ""}.`);
  }
  if (r.failedPages > 0) parts.push(`${r.failedPages} ${r.failedPages === 1 ? "page" : "pages"} could not be read.`);
  if (r.morePagesLeft > 0) parts.push(`The list has more pages; only the first ${MAX_PAGES} were read.`);
  return parts.join(" ");
}
