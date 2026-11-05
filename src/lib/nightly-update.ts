import { MAX_PAGES, morePages } from "@/lib/exhibitor-fetch";

// The update runs once a week, starting Sunday at 03:00 Danish time. Vercel's
// clock runs on UTC and a daily cron may start any time within its hour, so
// the cron is called every hour from 01 to 04 UTC and only works when it is
// between 03:00 and 06:59 in Copenhagen: three or four rounds a night (winter
// or summer time), each up to five minutes. Work not done on Sunday night is
// carried on the following nights until the week's update is finished.

export const NIGHT_FROM_HOUR = 3;
export const NIGHT_UNTIL_HOUR = 7;
/** The day the weekly update starts: 0 = Sunday. */
export const START_WEEKDAY = 0;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The date, hour and weekday on the clock in Denmark. */
function copenhagen(now: Date): { year: number; month: number; day: number; hour: number; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
      timeZone: "Europe/Copenhagen",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, weekday: WEEKDAYS.indexOf(parts.weekday) };
}

/** The hour (0-23) on the clock in Denmark. */
export function copenhagenHour(now = new Date()): number {
  return copenhagen(now).hour;
}

/** Whether it is night in Denmark, between 03:00 and 06:59, when the update runs. */
export function isNightlyHour(now = new Date()): boolean {
  const hour = copenhagenHour(now);
  return hour >= NIGHT_FROM_HOUR && hour < NIGHT_UNTIL_HOUR;
}

/** Whether this is the night the weekly update starts (Sunday, Danish time). */
export function isStartNight(now = new Date()): boolean {
  return copenhagen(now).weekday === START_WEEKDAY;
}

/** When this week's update started: the latest Sunday 03:00 Danish time, at or before now. */
export function weekStart(now = new Date()): Date {
  const c = copenhagen(now);
  let back = (c.weekday - START_WEEKDAY + 7) % 7;
  if (back === 0 && c.hour < NIGHT_FROM_HOUR) back = 7;
  // 03:00 that day in UTC, moved by Denmark's offset from UTC on that day (1 or 2 hours).
  const asUtc = Date.UTC(c.year, c.month - 1, c.day - back, NIGHT_FROM_HOUR);
  const offset = copenhagen(new Date(asUtc)).hour - NIGHT_FROM_HOUR;
  return new Date(asUtc - offset * 3_600_000);
}

/**
 * Whether a round should work now: on Sunday night, and on the nights after
 * while the week's update has started but is not finished.
 */
export function shouldRun(s: { lastRunAt: Date | null; weekDoneAt: Date | null } | null, now = new Date()): boolean {
  if (!isNightlyHour(now)) return false;
  const start = weekStart(now);
  if (s?.weekDoneAt && s.weekDoneAt >= start) return false;
  return isStartNight(now) || Boolean(s?.lastRunAt && s.lastRunAt >= start);
}

/** Where the update is in a show's exhibitor list, saved between rounds. */
export type ListProgress = {
  /** Pages still to read. */
  queue: string[];
  /** Every page read or waiting, so none is read twice. */
  known: string[];
  pages: number;
  failedPages: number;
  added: number;
  firstError?: string;
};

/** A fresh start on the list, or the progress saved by an earlier round. */
export function listProgress(saved: unknown, directoryUrl: string): ListProgress {
  const s = saved as Partial<ListProgress> | null | undefined;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);
  const queue = strings(s?.queue);
  const known = strings(s?.known);
  if (!s || !queue || !known) return { queue: [directoryUrl], known: [directoryUrl], pages: 0, failedPages: 0, added: 0 };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    queue,
    known,
    pages: num(s.pages),
    failedPages: num(s.failedPages),
    added: num(s.added),
    ...(typeof s.firstError === "string" && { firstError: s.firstError }),
  };
}

/** Whether the list has pages left to read within the page limit. */
export function hasPagesLeft(p: ListProgress): boolean {
  return p.queue.length > 0 && p.pages + p.failedPages < MAX_PAGES;
}

/** Notes one page as read and queues the list's other pages it linked to. */
export function pageRead(p: ListProgress, directoryUrl: string, r: { added: number; otherPages: string[] }): ListProgress {
  const next = morePages(r.otherPages, directoryUrl, p.known);
  return { ...p, pages: p.pages + 1, added: p.added + r.added, queue: [...p.queue, ...next], known: [...p.known, ...next] };
}

/** Notes one page as failed. */
export function pageFailed(p: ListProgress, error: string): ListProgress {
  return { ...p, failedPages: p.failedPages + 1, firstError: p.firstError ?? error };
}

/** The first page waiting, and the progress without it. */
export function takePage(p: ListProgress): [string, ListProgress] {
  return [p.queue[0], { ...p, queue: p.queue.slice(1) }];
}

export type NightlyTotals = {
  /** What the trade show finder said, or null when it had nothing to do. */
  finder: string | null;
  /** Shows that got exhibitors this round. */
  filled: number;
  /** Exhibitors added in all. */
  added: number;
  /** Exhibitor directory URLs AI found and saved. */
  urlsFound: number;
  /** Shows where AI found no exhibitor list on the web. */
  noDirectory: number;
  /** Shows whose list was read but had no exhibitors yet. */
  empty: number;
  /** Shows that failed and are tried again next night. */
  failed: number;
  /** Shows not reached, or only partly read, this round. */
  left: number;
  stoppedBy?: string;
  /** Everything for this week is done. */
  done?: boolean;
};

const shows = (n: number) => `${n} ${n === 1 ? "show" : "shows"}`;

/** A short text on what one round of the update did, for the Feature control page. */
export function nightlySummary(t: NightlyTotals): string {
  const parts: string[] = [];
  if (t.finder) parts.push(`Trade show finder: ${t.finder}`);
  parts.push(`Exhibitors: ${t.added} added to ${shows(t.filled)}.`);
  if (t.urlsFound) parts.push(`Found the exhibitor list of ${shows(t.urlsFound)}.`);
  if (t.noDirectory) parts.push(`${shows(t.noDirectory)} had no exhibitor list to find.`);
  if (t.empty) parts.push(`${shows(t.empty)} had no exhibitors on the list yet.`);
  if (t.failed) parts.push(`${shows(t.failed)} failed and will be tried again.`);
  if (t.stoppedBy) parts.push(`Stopped: ${t.stoppedBy}`);
  if (t.left) parts.push(`${shows(t.left)} still to go in the next round.`);
  if (t.done) parts.push("This week's update is done.");
  return parts.join(" ");
}
