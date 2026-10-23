import { describe, expect, it } from "vitest";
import { CRM_HEADERS, crmTable, splitName } from "./crm-export";

describe("splitName", () => {
  it("splits first and last name", () => {
    expect(splitName("Anna Weber")).toEqual({ first: "Anna", last: "Weber" });
    expect(splitName("  Jan  van der  Berg ")).toEqual({ first: "Jan", last: "van der Berg" });
    expect(splitName("Weber, Anna")).toEqual({ first: "Anna", last: "Weber" });
  });

  it("leaves out titles and handles a single or no name", () => {
    expect(splitName("Dr. Klaus Richter")).toEqual({ first: "Klaus", last: "Richter" });
    expect(splitName("Madonna")).toEqual({ first: "Madonna", last: "" });
    expect(splitName(null)).toEqual({ first: "", last: "" });
  });
});

describe("crmTable", () => {
  it("names the value column with the currency", () => {
    expect(crmTable([], "Deal Value (GBP)").headers).toContain("Deal Value (GBP)");
  });

  it("writes one CRM row per lead", () => {
    const table = crmTable([
      {
        name: "Siemens Healthineers",
        contactName: "Anna Weber",
        contactTitle: "Head of Sales",
        email: "anna@siemens.com",
        phone: "+49 30 1234",
        website: "https://siemens-healthineers.com",
        country: "DE",
        industry: "Medical devices",
        boothNumber: "B10",
        companyProfile: null,
        tradeShow: { name: "MEDICA 2026" },
        savedIn: [
          {
            leadStatus: "MEETING",
            leadNote: "Demo booked",
            followUpAt: new Date("2026-11-02T00:00:00Z"),
            followUpNote: "Confirm time",
            projectValue: 25000,
            assignee: { name: "Henrik", email: "h@vivolead.com" },
          },
        ],
      },
    ]);
    const row = Object.fromEntries(CRM_HEADERS.map((h, i) => [h, table.rows[0][i]]));
    expect(row).toMatchObject({
      "First Name": "Anna",
      "Last Name": "Weber",
      "Company Name": "Siemens Healthineers",
      Country: "Germany",
      "Lead Status": "Meeting booked",
      "Lead Owner Email": "h@vivolead.com",
      "Follow-up Date": "2026-11-02",
      "Lead Source": "Trade show: MEDICA 2026",
      Booth: "B10",
      "Deal Value": "25000",
    });
  });
});
