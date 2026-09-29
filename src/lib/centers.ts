import { parseDirectoryRows } from "@/lib/directory-import";
import { type CenterInput, centerSchema } from "@/lib/validation";

/** Two centers are the same when name and city match, ignoring case. */
export function centerKey(c: { name: string; city: string | null }): string {
  return `${c.name.trim().toLowerCase()}|${(c.city ?? "").trim().toLowerCase()}`;
}

/** Centers from the rows of an imported CSV file. */
export function parseCenterRows(rows: string[][]) {
  return parseDirectoryRows<CenterInput>(rows, {
    headers: {
      name: ["name", "centername", "exhibitioncentername", "exhibitioncenter", "center", "venue", "venuename"],
      city: ["city", "location", "town"],
      country: ["country", "countrycode"],
      website: ["website", "officialwebsite", "web", "url", "homepage"],
      eventsUrl: ["localeventsurl", "eventsurl", "eventurl", "events", "localevents", "eventcalendar", "calendar"],
    },
    schema: centerSchema,
    key: centerKey,
    nameColumnHint: '"Name" (or "Exhibition Center name")',
  });
}
