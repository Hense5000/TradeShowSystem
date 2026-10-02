import { addMonths, parseDate, today } from "@/lib/dates";

// Pure helpers for the AI trade show finder: turning an events page into text
// the AI can read, checking what it found, and spotting shows we already have.
// The part that fetches pages and calls the AI is in show-finder-run.ts.

/** A center is checked again when its last check is at least this old. */
export const RECHECK_AFTER_DAYS = 28;

/** Shows further ahead than this are left out; such dates are rarely final. */
export const MAX_YEARS_AHEAD = 4;

/** Pages longer than this are cut. Event lists are far shorter in practice. */
export const MAX_PAGE_CHARS = 200_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * The readable text of a web page, with links written as "text (url)" so the
 * AI can tell where each event leads. Structured event data that many sites
 * embed for search engines (JSON-LD) is kept, since it holds exact dates.
 */
export function pageToText(html: string, pageUrl: string): { text: string; cut: boolean } {
  const structured: string[] = [];
  let body = html.replace(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, (_, json: string) => {
    if (/event/i.test(json)) structured.push(json.trim());
    return " ";
  });
  body = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      let url: string;
      try {
        url = new URL(decodeEntities(href), pageUrl).toString();
      } catch {
        return ` ${label} `;
      }
      if (!/^https?:/i.test(url) || !label) return ` ${label} `;
      return ` ${label} (${url}) `;
    })
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article|\/td)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const lines = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/[ \t\r\f\v]+/g, " ").trim())
    .filter(Boolean);

  let text = lines.join("\n");
  if (structured.length > 0) text = `${text}\n\nStructured event data on the page:\n${structured.join("\n")}`;
  const cut = text.length > MAX_PAGE_CHARS;
  return { text: cut ? text.slice(0, MAX_PAGE_CHARS) : text, cut };
}

/** A show the AI reported, before it is checked. */
export type FoundShow = { name: string; startDate: string; endDate: string; website: string | null };

/** A found show that passed the checks. */
export type CheckedShow = { name: string; startDate: Date; endDate: Date; website: string | null };

function cleanUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the shows with real dates that have not ended yet and are not
 * absurdly far ahead, and tidies their fields.
 */
export function checkFoundShows(found: FoundShow[], now = new Date()): CheckedShow[] {
  const first = today(now);
  const last = addMonths(first, MAX_YEARS_AHEAD * 12);
  const result: CheckedShow[] = [];
  for (const f of found) {
    const name = f.name.replace(/\s+/g, " ").trim().slice(0, 150);
    const startDate = parseDate(f.startDate);
    const endDate = parseDate(f.endDate || f.startDate);
    if (!name || !startDate || !endDate) continue;
    if (endDate < startDate || endDate < first || startDate > last) continue;
    result.push({ name, startDate, endDate, website: cleanUrl(f.website) });
  }
  return result;
}

/** A show name reduced to letters and digits, without years, for comparing. */
export function showNameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

const DAY = 86_400_000;

/**
 * Whether two entries are the same show: the names match once years, case
 * and punctuation are ignored, and they start within two weeks of each
 * other. Next year's edition of a show starts much later, so it counts as new.
 */
export function isSameShow(a: { name: string; startDate: Date }, b: { name: string; startDate: Date }): boolean {
  const key = showNameKey(a.name);
  if (!key || key !== showNameKey(b.name)) return false;
  return Math.abs(a.startDate.getTime() - b.startDate.getTime()) <= 14 * DAY;
}

/** The shows that are not already known, without repeats among themselves. */
export function newShows<T extends { name: string; startDate: Date }>(found: T[], known: { name: string; startDate: Date }[]): T[] {
  const result: T[] = [];
  for (const show of found) {
    if (known.some((k) => isSameShow(show, k))) continue;
    if (result.some((r) => isSameShow(show, r))) continue;
    result.push(show);
  }
  return result;
}

/** Whether a center is due for a new check by the monthly run. */
export function isDue(checkedAt: Date | null, now = new Date()): boolean {
  return !checkedAt || now.getTime() - checkedAt.getTime() >= RECHECK_AFTER_DAYS * DAY;
}

/** The text shown after a run, e.g. "Checked 3 centers. Found 2 new shows. 1 page could not be read." */
export function runSummary(r: { checked: number; found: number; failed: number; left: number }): string {
  const parts = [
    `Checked ${r.checked} ${r.checked === 1 ? "center" : "centers"}.`,
    `Found ${r.found} new ${r.found === 1 ? "show" : "shows"}.`,
  ];
  if (r.failed > 0) parts.push(`${r.failed} ${r.failed === 1 ? "page" : "pages"} could not be read.`);
  if (r.left > 0) parts.push(`${r.left} ${r.left === 1 ? "center was" : "centers were"} not reached this time and will be checked next.`);
  return parts.join(" ");
}
