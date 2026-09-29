import { parseDirectoryRows } from "@/lib/directory-import";
import { type ExhibitorRow, exhibitorRowSchema } from "@/lib/validation";

/** Within one trade show, two exhibitors are the same when the company name matches, ignoring case. */
export function exhibitorKey(e: { name: string }): string {
  return e.name.trim().toLowerCase();
}

/** Exhibitors from the rows of an imported CSV file (all for the same trade show). */
export function parseExhibitorRows(rows: string[][]) {
  return parseDirectoryRows<ExhibitorRow>(rows, {
    headers: {
      name: ["name", "companyname", "company", "exhibitor", "exhibitorname"],
      contactName: ["contactperson", "contact", "contactname"],
      contactTitle: ["contactposition", "position", "jobtitle", "title", "contacttitle"],
      email: ["email", "emailaddress", "mail"],
      phone: ["phone", "phonenumber", "telephone", "tel"],
      website: ["website", "web", "url", "homepage"],
      country: ["country", "countrycode"],
      industry: ["industry", "sector", "category"],
      boothNumber: ["boothno", "booth", "boothnumber", "standno", "stand", "standnumber"],
      standLocationUrl: ["standlocationurl", "standlocation", "boothurl", "floorplanurl", "floorplan"],
      companyProfile: ["aicompanyprofile", "companyprofile", "profile", "description", "about"],
    },
    schema: exhibitorRowSchema,
    key: exhibitorKey,
    nameColumnHint: '"Company name"',
  });
}
