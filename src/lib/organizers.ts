import { parseDirectoryRows } from "@/lib/directory-import";
import { type OrganizerInput, organizerSchema } from "@/lib/validation";

/** Two organizers are the same when the company name matches, ignoring case. */
export function organizerKey(o: { name: string }): string {
  return o.name.trim().toLowerCase();
}

/** Organizers from the rows of an imported CSV file. */
export function parseOrganizerRows(rows: string[][]) {
  return parseDirectoryRows<OrganizerInput>(rows, {
    headers: {
      name: ["name", "organizercompany", "organisercompany", "organizer", "organiser", "organizername", "organisername", "company", "companyname"],
      website: ["website", "officialwebsite", "web", "url", "homepage"],
      country: ["country", "countrycode"],
    },
    schema: organizerSchema,
    key: organizerKey,
    nameColumnHint: '"Name" (or "Organizer company")',
  });
}

// Company forms left out when comparing organizer names, so "Messe Frankfurt
// GmbH" and "Messe Frankfurt" are the same organizer.
const COMPANY_FORMS =
  /\b(gmbh|ag|kg|co|kgaa|se|ltd|limited|plc|llc|inc|incorporated|corp|corporation|company|sa|sas|sarl|srl|spa|bv|nv|a\/?s|aps|ab|as|oy|oyj|pty|pvt|pte|the)\b\.?/g;

/** An organizer name reduced to letters and digits, without accents and company forms, for comparing. */
export function organizerNameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(COMPANY_FORMS, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * The organizer in the list with this name. Names match once case, accents,
 * punctuation and company forms are ignored, or when one name holds the other
 * ("Messe Frankfurt" and "Messe Frankfurt Exhibition"), as long as the shorter
 * one is not so short that it could be part of many names. With several
 * matches, the closest name wins.
 */
export function findOrganizer<T extends { name: string }>(name: string, organizers: T[]): T | undefined {
  const key = organizerNameKey(name);
  if (!key) return undefined;
  let best: { item: T; diff: number } | undefined;
  for (const o of organizers) {
    const other = organizerNameKey(o.name);
    if (!other) continue;
    if (other === key) return o;
    const [short, long] = key.length < other.length ? [key, other] : [other, key];
    if (short.length < 8 || !long.includes(short)) continue;
    const diff = long.length - short.length;
    if (!best || diff < best.diff) best = { item: o, diff };
  }
  return best?.item;
}
