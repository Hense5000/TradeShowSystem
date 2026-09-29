import { findCountryCode } from "@/lib/countries";
import { type CenterInput, centerSchema, firstError } from "@/lib/validation";

type Column = keyof CenterInput;

// Header names we recognise in an imported file, written without spaces or
// punctuation. Base44 and Excel exports use slightly different names.
const HEADERS: Record<Column, string[]> = {
  name: ["name", "centername", "exhibitioncentername", "exhibitioncenter", "center", "venue", "venuename"],
  city: ["city", "location", "town"],
  country: ["country", "countrycode"],
  website: ["website", "officialwebsite", "web", "url", "homepage"],
  eventsUrl: ["localeventsurl", "eventsurl", "eventurl", "events", "localevents", "eventcalendar", "calendar"],
};

const normalise = (header: string) => header.toLowerCase().replace(/[^a-z]/g, "");

/** Two centers are the same when name and city match, ignoring case. */
export function centerKey(c: { name: string; city: string | null }): string {
  return `${c.name.trim().toLowerCase()}|${(c.city ?? "").trim().toLowerCase()}`;
}

export type ParsedCenters = { centers: CenterInput[]; problems: string[]; error?: string };

/**
 * Turns the rows of an imported CSV file (first row = headers) into centers.
 * Rows that can't be used are left out and explained in `problems`; an
 * unknown country is dropped from the row rather than rejecting it.
 */
export function parseCenterRows(rows: string[][]): ParsedCenters {
  const [header, ...data] = rows;
  if (!header) return { centers: [], problems: [], error: "The file is empty." };

  const index = {} as Record<Column, number>;
  for (const col of Object.keys(HEADERS) as Column[]) {
    index[col] = header.findIndex((h) => HEADERS[col].includes(normalise(h)));
  }
  if (index.name < 0) {
    return { centers: [], problems: [], error: "The file needs a column called \"Name\" (or \"Exhibition Center name\")." };
  }

  const centers: CenterInput[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  data.forEach((cells, i) => {
    const rowNo = i + 2; // row 1 is the header
    const cell = (col: Column) => (index[col] >= 0 ? (cells[index[col]] ?? "").trim() : "");
    const rawCountry = cell("country");
    const country = findCountryCode(rawCountry);
    if (rawCountry && !country) problems.push(`Row ${rowNo}: unknown country "${rawCountry}", saved without a country.`);

    const parsed = centerSchema.safeParse({
      name: cell("name"),
      city: cell("city"),
      country: country ?? "",
      website: cell("website"),
      eventsUrl: cell("eventsUrl"),
    });
    if (!parsed.success) {
      problems.push(`Row ${rowNo}: ${firstError(parsed.error)}`);
      return;
    }
    const key = centerKey(parsed.data);
    if (seen.has(key)) {
      problems.push(`Row ${rowNo}: "${parsed.data.name}" appears twice in the file, skipped.`);
      return;
    }
    seen.add(key);
    centers.push(parsed.data);
  });

  return { centers, problems };
}
