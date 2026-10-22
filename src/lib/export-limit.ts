// Pure rules for how many trade shows a user may download exhibitors from per
// day. Kept free of Stripe and database access so they are easy to test; the
// checking and recording is in src/lib/export-limit-run.ts.
//
// Each Excel or CSV download counts the trade shows whose exhibitors are in
// the file. A show already downloaded today is free again the same day. A
// saved list or Favorites download of at most FREE_LIST_SIZE companies is
// hand-picked leads, not a show's whole list, so it doesn't count.

export type Plan = "basic" | "pro";

/** Trade shows per user per day on each plan. */
export const SHOWS_PER_DAY: Record<Plan, number> = { basic: 1, pro: 5 };

/** A saved list or Favorites download with at most this many companies doesn't count. */
export const FREE_LIST_SIZE = 25;

/** The plan of a subscription on this Stripe Price. */
export function planOf(priceId: string | null | undefined, proPriceId: string | undefined): Plan {
  return proPriceId && priceId === proPriceId ? "pro" : "basic";
}

/** Today's date in Denmark, e.g. "2026-10-22": the limit starts over at midnight there. */
export function exportDay(now = new Date()): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type ExportCheck =
  | { ok: true; newShows: string[] }
  // used: the shows already downloaded today; needed: the new shows this file would add.
  | { ok: false; limit: number; used: string[]; needed: string[] };

/**
 * Whether a file with exhibitors from these trade shows may be downloaded
 * today, given the shows the user already downloaded today.
 */
export function checkExport(showsInFile: Iterable<string>, usedToday: Iterable<string>, limit: number): ExportCheck {
  const used = [...new Set(usedToday)];
  const done = new Set(used);
  const newShows = [...new Set(showsInFile)].filter((id) => !done.has(id));
  if (used.length + newShows.length <= limit) return { ok: true, newShows };
  return { ok: false, limit, used, needed: newShows };
}
