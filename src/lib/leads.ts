import type { LeadStatus, Prisma } from "@prisma/client";

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

export type FavoriteFilters = { q: string; show: string; status: LeadStatus | "" };

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

/** The search, trade show and status filters of the Favorites page, read from its URL. */
export function favoriteFilters(params: Params): FavoriteFilters {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return typeof value === "string" ? value : "";
  };
  return { q: get("q").trim(), show: get("show"), status: parseLeadStatus(get("status")) ?? "" };
}

/** The Favorites list items those filters show, so the page and its export list the same exhibitors. */
export function favoriteWhere(listId: string, { q, show, status }: FavoriteFilters): Prisma.SavedListItemWhereInput {
  return {
    listId,
    ...(status && { leadStatus: status }),
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
export function favoriteQuery({ q, show, status }: FavoriteFilters, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams({ ...(q && { q }), ...(show && { show }), ...(status && { status }), ...extra });
  return qs.size ? `?${qs}` : "";
}
