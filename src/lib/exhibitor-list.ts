import { Prisma } from "@prisma/client";
import { isCountryCode } from "@/lib/countries";
import { parseDate } from "@/lib/dates";

export type ExhibitorFilters = {
  q: string;
  show: string;
  country: string; // the exhibitor's own country
  industry: string; // words for the industry, separated by commas; any of them may match
  showCountry: string; // where the trade show takes place
  showCity: string;
  from: string; // the trade show ends on or after this date (YYYY-MM-DD)
  to: string; // the trade show starts on or before this date (YYYY-MM-DD)
  ai: string; // the sentence the user asked the AI, shown above the filters it gave; not a filter itself
};

/** The filters in the order they appear in the URL. */
const KEYS = ["q", "show", "country", "industry", "showCountry", "showCity", "from", "to", "ai"] as const;

export const NO_FILTERS: ExhibitorFilters = { q: "", show: "", country: "", industry: "", showCountry: "", showCity: "", from: "", to: "", ai: "" };

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && parseDate(value) !== null;

/** The filters of the Exhibitors page, read from its URL. Unknown countries and bad dates are dropped. */
export function exhibitorFilters(params: Params): ExhibitorFilters {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const country = get("country");
  const showCountry = get("showCountry");
  const from = get("from");
  const to = get("to");
  return {
    q: get("q"),
    show: get("show"),
    country: isCountryCode(country) ? country : "",
    industry: industryTerms(get("industry")).join(", "),
    showCountry: isCountryCode(showCountry) ? showCountry : "",
    showCity: get("showCity"),
    from: isDate(from) ? from : "",
    to: isDate(to) ? to : "",
    ai: get("ai").slice(0, 300),
  };
}

/** The separate words of an industry filter, e.g. "medical, medtech" -> ["medical", "medtech"]. */
export function industryTerms(industry: string): string[] {
  return [...new Set(industry.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 12);
}

/** Whether any filter that narrows the list is set. */
export function isFiltered(f: ExhibitorFilters): boolean {
  return KEYS.some((k) => k !== "ai" && f[k]);
}

/** The exhibitors those filters show, so the page, its export and "Save all" always list the same companies. */
export function exhibitorWhere({ q, show, country, industry, showCountry, showCity, from, to }: ExhibitorFilters): Prisma.ExhibitorWhereInput {
  const and: Prisma.ExhibitorWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { industry: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const terms = industryTerms(industry);
  if (terms.length) {
    // Industry is often empty or worded differently, so the company profile counts too.
    and.push({
      OR: terms.flatMap((t) => [
        { industry: { contains: t, mode: "insensitive" as const } },
        { companyProfile: { contains: t, mode: "insensitive" as const } },
      ]),
    });
  }
  const tradeShow: Prisma.TradeShowWhereInput = {
    ...(showCountry && { country: showCountry }),
    ...(showCity && { city: { contains: showCity, mode: "insensitive" } }),
    ...(from && { endDate: { gte: new Date(from) } }),
    ...(to && { startDate: { lte: new Date(to) } }),
  };
  return {
    ...(show && { tradeShowId: show }),
    ...(country && { country }),
    ...(Object.keys(tradeShow).length && { tradeShow }),
    ...(and.length && { AND: and }),
  };
}

/** `contains` with any case, written as Prisma writes it (which leaves % and _ in the text as wildcards). */
const ilike = (column: Prisma.Sql, text: string) => Prisma.sql`${column} ILIKE ${`%${text}%`}`;

/**
 * The same filter as exhibitorWhere, as SQL on "Exhibitor" e joined with its
 * "TradeShow" t. The Exhibitors page groups and pages companies in the
 * database with it, so it never loads every company to show 50.
 */
export function exhibitorSql({ q, show, country, industry, showCountry, showCity, from, to }: ExhibitorFilters): Prisma.Sql {
  const and: Prisma.Sql[] = [];
  if (q) and.push(Prisma.sql`(${Prisma.join([ilike(Prisma.sql`e."name"`, q), ilike(Prisma.sql`e."contactName"`, q), ilike(Prisma.sql`e."industry"`, q)], " OR ")})`);
  const terms = industryTerms(industry);
  if (terms.length) {
    and.push(Prisma.sql`(${Prisma.join(terms.flatMap((t) => [ilike(Prisma.sql`e."industry"`, t), ilike(Prisma.sql`e."companyProfile"`, t)]), " OR ")})`);
  }
  if (show) and.push(Prisma.sql`e."tradeShowId" = ${show}`);
  if (country) and.push(Prisma.sql`e."country" = ${country}`);
  if (showCountry) and.push(Prisma.sql`t."country" = ${showCountry}`);
  if (showCity) and.push(ilike(Prisma.sql`t."city"`, showCity));
  if (from) and.push(Prisma.sql`t."endDate" >= ${new Date(from)}`);
  if (to) and.push(Prisma.sql`t."startDate" <= ${new Date(to)}`);
  return and.length ? Prisma.join(and, " AND ") : Prisma.sql`TRUE`;
}

/** The filters as a query string ("" when none are set), with any extra parameters added. */
export function exhibitorQuery(filters: ExhibitorFilters, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams();
  for (const k of KEYS) if (filters[k]) qs.set(k, filters[k]);
  for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  return qs.size ? `?${qs}` : "";
}
