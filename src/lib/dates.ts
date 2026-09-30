// Date-only values (trade show start and end). They are stored as midnight
// UTC and always read and written in UTC, so a date never shifts by a day.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function make(y: number, m: number, d: number): Date | null {
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

/**
 * Reads a date typed by a person or found in a spreadsheet: 2026-09-22,
 * 22.09.2026, 22/09/2026, 22-09-2026 (day first, as in Europe),
 * "Sep 22, 2026" or "22 September 2026". Returns null when it isn't a date.
 */
export function parseDate(value: string): Date | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return make(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m) return make(+m[3], +m[2], +m[1]);
  m = v.match(/^([a-z]+)\.? (\d{1,2}),? (\d{4})$/i);
  if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) return make(+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]);
  m = v.match(/^(\d{1,2})\.? ([a-z]+)\.?,? (\d{4})$/i);
  if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) return make(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]);
  return null;
}

/** "2026-09-22", for date inputs and comparisons. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's date as midnight UTC. */
export function today(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const fmt = (date: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(date);

/** "Sep 22 – 25, 2026", "Sep 29 – Oct 2, 2026" or "Dec 30, 2026 – Jan 2, 2027". */
export function formatDateRange(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  if (isoDate(start) === isoDate(end)) return fmt(start, { month: "short", day: "numeric", year: "numeric" });
  if (!sameYear) {
    return `${fmt(start, { month: "short", day: "numeric", year: "numeric" })} – ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const endPart = sameMonth ? fmt(end, { day: "numeric" }) : fmt(end, { month: "short", day: "numeric" });
  return `${fmt(start, { month: "short", day: "numeric" })} – ${endPart}, ${end.getUTCFullYear()}`;
}

/** The same day a number of months later; Jan 31 + 1 month is Feb 28 (or 29). */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}
