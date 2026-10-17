import type { Prisma } from "@prisma/client";
import { isCountryCode } from "@/lib/countries";

export type ExhibitorFilters = { q: string; show: string; country: string };

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

/** The search, trade show and country filters of the Exhibitors page, read from its URL. */
export function exhibitorFilters(params: Params): ExhibitorFilters {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return typeof value === "string" ? value : "";
  };
  const country = get("country");
  return { q: get("q").trim(), show: get("show"), country: isCountryCode(country) ? country : "" };
}

/** The exhibitors those filters show, so the page and its export always list the same companies. */
export function exhibitorWhere({ q, show, country }: ExhibitorFilters): Prisma.ExhibitorWhereInput {
  return {
    ...(show && { tradeShowId: show }),
    ...(country && { country }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { industry: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
}

/** The filters as a query string ("" when none are set), with any extra parameters added. */
export function exhibitorQuery({ q, show, country }: ExhibitorFilters, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams({ ...(q && { q }), ...(show && { show }), ...(country && { country }), ...extra });
  return qs.size ? `?${qs}` : "";
}
