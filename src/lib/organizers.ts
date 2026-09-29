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
