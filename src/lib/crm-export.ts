import type { LeadStatus } from "@prisma/client";
import { countryName } from "@/lib/countries";
import { LEAD_LABEL } from "@/lib/leads";
import type { Table } from "@/lib/spreadsheet";

// The "Export for CRM" download of the Favorites list: columns named the way
// HubSpot, Pipedrive and Salesforce expect them, so a file imports without
// matching columns by hand.

const TITLES = /^(mr|mrs|ms|miss|dr|prof|herr|frau|hr|fr)\.?$/i;

/**
 * Splits a contact person into first and last name: "Anna Weber" is Anna and
 * Weber, "Weber, Anna" too. Titles such as "Dr." are left out. A single name
 * is a first name only.
 */
export function splitName(name: string | null): { first: string; last: string } {
  const value = (name ?? "").replace(/\s+/g, " ").trim();
  if (!value) return { first: "", last: "" };
  const comma = value.match(/^([^,]+),\s*(.+)$/);
  if (comma) return splitName(`${comma[2]} ${comma[1]}`);
  const words = value.split(" ").filter((w, i, all) => !(TITLES.test(w) && i < all.length - 1));
  return { first: words[0] ?? "", last: words.slice(1).join(" ") };
}

export const CRM_HEADERS = [
  "First Name",
  "Last Name",
  "Job Title",
  "Email",
  "Phone",
  "Company Name",
  "Website",
  "Country",
  "Industry",
  "Lead Status",
  "Lead Owner",
  "Lead Owner Email",
  "Notes",
  "Follow-up Date",
  "Follow-up Task",
  "Deal Value",
  "Lead Source",
  "Trade Show",
  "Booth",
  "Company Description",
];

type Lead = {
  name: string;
  contactName: string | null;
  contactTitle: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  industry: string | null;
  boothNumber: string | null;
  companyProfile: string | null;
  tradeShow: { name: string };
  savedIn: {
    leadStatus: LeadStatus;
    leadNote: string | null;
    followUpAt: Date | null;
    followUpNote: string | null;
    projectValue: number | null;
    assignee: { name: string | null; email: string } | null;
  }[];
};

/**
 * One row per favorite exhibitor, with the person split into first and last name.
 * valueHeader names the project value column with the account's currency, e.g. "Deal Value (EUR)".
 */
export function crmTable(leads: Lead[], valueHeader = "Deal Value"): Table {
  return {
    headers: CRM_HEADERS.map((h) => (h === "Deal Value" ? valueHeader : h)),
    rows: leads.map((e) => {
      const lead = e.savedIn[0];
      const { first, last } = splitName(e.contactName);
      return [
        first,
        last,
        e.contactTitle,
        e.email,
        e.phone,
        e.name,
        e.website,
        e.country && countryName(e.country),
        e.industry,
        lead && LEAD_LABEL[lead.leadStatus],
        lead?.assignee && (lead.assignee.name ?? lead.assignee.email),
        lead?.assignee?.email,
        lead?.leadNote,
        lead?.followUpAt && lead.followUpAt.toISOString().slice(0, 10),
        lead?.followUpNote,
        lead?.projectValue?.toString(),
        `Trade show: ${e.tradeShow.name}`,
        e.tradeShow.name,
        e.boothNumber,
        e.companyProfile,
      ];
    }),
  };
}
