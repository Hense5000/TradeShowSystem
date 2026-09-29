import type { z } from "zod";
import { findCountryCode } from "@/lib/countries";
import { firstError } from "@/lib/validation";

export type ParsedRows<T> = { items: T[]; problems: string[]; error?: string };

const normalise = (header: string) => header.toLowerCase().replace(/[^a-z]/g, "");

/**
 * Turns the rows of an imported CSV file (first row = headers) into records
 * for one of the shared lists. `headers` lists the header names we recognise
 * for each field, written without spaces or punctuation, since Base44 and
 * Excel exports name columns slightly differently. Rows that can't be used
 * are left out and explained in `problems`; an unknown country is dropped
 * from the row rather than rejecting it. `key` spots rows that appear twice.
 */
export function parseDirectoryRows<T extends { name: string }>(
  rows: string[][],
  opts: {
    headers: Record<string, string[]>;
    schema: z.ZodType<T>;
    key: (item: T) => string;
    nameColumnHint: string;
  },
): ParsedRows<T> {
  const [header, ...data] = rows;
  if (!header) return { items: [], problems: [], error: "The file is empty." };

  const fields = Object.keys(opts.headers);
  const index: Record<string, number> = {};
  for (const field of fields) {
    index[field] = header.findIndex((h) => opts.headers[field].includes(normalise(h)));
  }
  if (index.name < 0) return { items: [], problems: [], error: `The file needs a column called ${opts.nameColumnHint}.` };

  const items: T[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  data.forEach((cells, i) => {
    const rowNo = i + 2; // row 1 is the header
    const values: Record<string, string> = {};
    for (const field of fields) values[field] = index[field] >= 0 ? (cells[index[field]] ?? "").trim() : "";

    if ("country" in values) {
      const code = findCountryCode(values.country);
      if (values.country && !code) problems.push(`Row ${rowNo}: unknown country "${values.country}", saved without a country.`);
      values.country = code ?? "";
    }

    const parsed = opts.schema.safeParse(values);
    if (!parsed.success) {
      problems.push(`Row ${rowNo}: ${firstError(parsed.error)}`);
      return;
    }
    const key = opts.key(parsed.data);
    if (seen.has(key)) {
      problems.push(`Row ${rowNo}: "${parsed.data.name}" appears twice in the file, skipped.`);
      return;
    }
    seen.add(key);
    items.push(parsed.data);
  });

  return { items, problems };
}
