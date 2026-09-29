import { isoDate, today } from "@/lib/dates";
import { parseDirectoryRows } from "@/lib/directory-import";
import { type TradeShowInput, tradeShowSchema } from "@/lib/validation";

export type ShowStatus = "upcoming" | "running" | "finished";

export const STATUS_LABEL: Record<ShowStatus, string> = { upcoming: "Upcoming", running: "Running", finished: "Finished" };

/** A show's status follows from its dates, so nobody has to keep it up to date. */
export function showStatus(show: { startDate: Date; endDate: Date }, now = new Date()): ShowStatus {
  const day = isoDate(today(now));
  if (day < isoDate(show.startDate)) return "upcoming";
  if (day > isoDate(show.endDate)) return "finished";
  return "running";
}

/** Two shows are the same when name and start date match, ignoring case. */
export function tradeShowKey(s: { name: string; startDate: Date }): string {
  return `${s.name.trim().toLowerCase()}|${isoDate(s.startDate)}`;
}

/** Trade shows from the rows of an imported CSV file. */
export function parseTradeShowRows(rows: string[][]) {
  return parseDirectoryRows<TradeShowInput>(rows, {
    headers: {
      name: ["name", "tradeshowname", "tradeshow", "showname", "show", "eventname", "event"],
      startDate: ["startdate", "start", "from", "datefrom", "begins"],
      endDate: ["enddate", "end", "to", "dateto", "ends"],
      city: ["city", "location", "town"],
      country: ["country", "countrycode"],
      website: ["website", "officialwebsite", "web", "url", "homepage"],
      exhibitorDirectoryUrl: ["exhibitordirectoryurl", "exhibitordirectory", "exhibitorlist", "exhibitorlisturl", "exhibitorsurl", "exhibitorurl", "exhibitors"],
    },
    schema: tradeShowSchema,
    key: tradeShowKey,
    nameColumnHint: '"Name" (or "Trade show name")',
  });
}
