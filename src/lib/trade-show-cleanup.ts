import { addMonths, today } from "./dates";

// Trade shows are kept for three years after they end, then deleted.

export const KEEP_YEARS = 3;

/**
 * The first end date that is kept: a trade show that ended before this day
 * ended more than three years ago. On 2026-10-14 it is 2023-10-14.
 */
export function cleanupCutoff(now = new Date()): Date {
  return addMonths(today(now), -12 * KEEP_YEARS);
}

/** Database filter for the trade shows the cleanup deletes. */
export function oldTradeShowsWhere(now = new Date()) {
  return { endDate: { lt: cleanupCutoff(now) } };
}
