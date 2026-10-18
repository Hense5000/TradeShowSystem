import type { LeadStatus, Prisma } from "@prisma/client";
import { isoDate, parseDate, today as todayUtc } from "@/lib/dates";

// Lead work on the Favorites page: each favorite exhibitor has a status and
// notes, shared by everyone in the account.

export const LEAD_STATUSES = ["NEW", "CONTACTED", "MEETING", "WON", "LOST"] as const satisfies readonly LeadStatus[];

export const LEAD_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  MEETING: "Meeting booked",
  WON: "Won",
  LOST: "Lost",
};

export const LEAD_PILL: Record<LeadStatus, string> = {
  NEW: "pill-neutral",
  CONTACTED: "pill-soft",
  MEETING: "pill-warn",
  WON: "pill-ok",
  LOST: "bg-bad-soft text-bad",
};

/** Leads still being worked on; the dashboard counts these. */
export const ACTIVE_LEAD_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "MEETING"];

export const MAX_LEAD_NOTE = 2000;

export function parseLeadStatus(value: unknown): LeadStatus | undefined {
  return LEAD_STATUSES.find((s) => s === value);
}

/** The trimmed note (null when empty), or an error message when it is too long. */
export function checkLeadNote(value: unknown): { note: string | null; error?: undefined } | { error: string } {
  const note = typeof value === "string" ? value.trim() : "";
  if (note.length > MAX_LEAD_NOTE) return { error: `Keep the note under ${MAX_LEAD_NOTE} characters.` };
  return { note: note || null };
}

export const MAX_FOLLOW_UP_NOTE = 200;
// The dashboard shows follow-ups due within this many days.
export const FOLLOW_UP_SOON_DAYS = 7;

/** The follow-up date and text from the form; no date clears the follow-up. */
export function checkFollowUp(date: unknown, note: unknown): { date: Date | null; note: string | null; error?: undefined } | { error: string } {
  const text = typeof note === "string" ? note.trim().replace(/\s+/g, " ") : "";
  if (text.length > MAX_FOLLOW_UP_NOTE) return { error: `Keep the reminder under ${MAX_FOLLOW_UP_NOTE} characters.` };
  const raw = typeof date === "string" ? date.trim() : "";
  if (!raw) return { date: null, note: null };
  const parsed = parseDate(raw);
  if (!parsed) return { error: "Pick a date." };
  return { date: parsed, note: text || null };
}

export type FollowUpState = "overdue" | "today" | "soon" | "later";

/** Whether a follow-up is overdue, due today, due within a week or later. */
export function followUpState(date: Date, today: Date): FollowUpState {
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return days <= FOLLOW_UP_SOON_DAYS ? "soon" : "later";
}

export const FOLLOW_UP_PILL: Record<FollowUpState, string> = {
  overdue: "bg-bad-soft text-bad",
  today: "pill-warn",
  soon: "pill-soft",
  later: "pill-neutral",
};

/** "Overdue · Oct 15", "Today", "Tomorrow" or "Mon, Oct 21". */
export function followUpLabel(date: Date, today: Date): string {
  const state = followUpState(date, today);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(date);
  if (state === "overdue") return `Overdue · ${day}`;
  if (state === "today") return "Today";
  if (isoDate(date) === isoDate(new Date(today.getTime() + 86_400_000))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(date);
}

// "due": overdue or due today. "set": has a follow-up date.
const FOLLOW_UP_FILTERS = ["due", "set"] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

// Whose leads: "me" (the signed-in user), "none" (unassigned) or a user id.
export type FavoriteFilters = { q: string; show: string; status: LeadStatus | ""; followUp: FollowUpFilter | ""; owner: string };

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

/** The search, trade show and status filters of the Favorites page, read from its URL. */
export function favoriteFilters(params: Params): FavoriteFilters {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return typeof value === "string" ? value : "";
  };
  const followUp = FOLLOW_UP_FILTERS.find((f) => f === get("followup")) ?? "";
  return { q: get("q").trim(), show: get("show"), status: parseLeadStatus(get("status")) ?? "", followUp, owner: get("owner") };
}

/** The Favorites list items those filters show, so the page and its export list the same exhibitors. */
export function favoriteWhere(
  listId: string,
  { q, show, status, followUp, owner }: FavoriteFilters,
  { today = todayUtc(), userId }: { today?: Date; userId?: string } = {},
): Prisma.SavedListItemWhereInput {
  return {
    listId,
    ...(owner && { assigneeId: owner === "none" ? null : owner === "me" ? (userId ?? null) : owner }),
    ...(status && { leadStatus: status }),
    ...(followUp === "due" && { followUpAt: { lte: today } }),
    ...(followUp === "set" && { followUpAt: { not: null } }),
    ...((show || q) && {
      exhibitor: {
        ...(show && { tradeShowId: show }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { industry: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
    }),
  };
}

/** The filters as a query string ("" when none are set), with any extra parameters added. */
export function favoriteQuery({ q, show, status, followUp, owner }: FavoriteFilters, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams({
    ...(q && { q }),
    ...(show && { show }),
    ...(status && { status }),
    ...(followUp && { followup: followUp }),
    ...(owner && { owner }),
    ...extra,
  });
  return qs.size ? `?${qs}` : "";
}

/** The leads one user looks after: their own and the ones no one is responsible for. */
export function mineOrUnassigned(userId: string): Prisma.SavedListItemWhereInput {
  return { OR: [{ assigneeId: userId }, { assigneeId: null }] };
}

const booths = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Orders exhibitors as you walk a show: by booth number ("A2" before "A10", hall 2 before hall 10), those without a booth last, then by name. */
export function byBooth(a: { boothNumber: string | null; name: string }, b: { boothNumber: string | null; name: string }): number {
  const aBooth = a.boothNumber?.trim() ?? "";
  const bBooth = b.boothNumber?.trim() ?? "";
  if (!aBooth !== !bBooth) return aBooth ? -1 : 1;
  return booths.compare(aBooth, bBooth) || booths.compare(a.name, b.name);
}
