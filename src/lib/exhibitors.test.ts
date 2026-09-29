import { describe, expect, it } from "vitest";
import { exhibitorKey, parseExhibitorRows } from "./exhibitors";

describe("parseExhibitorRows", () => {
  it("maps the Base44 exhibitor columns", () => {
    const result = parseExhibitorRows([
      ["Company Name", "Contact Person", "Contact Position", "Email", "Phone", "Website", "Country", "Industry", "Booth No.", "Stand Location URL", "AI Company Profile"],
      ["Acme Corporation", "John Smith", "Sales Manager", "Contact@Company.com", "+1 555 123 4567", "company.com", "Denmark", "Technology", "A-123", "floorplan.com/booth/123", "Makes things."],
    ]);
    expect(result.problems).toEqual([]);
    expect(result.items).toEqual([
      {
        name: "Acme Corporation",
        contactName: "John Smith",
        contactTitle: "Sales Manager",
        email: "contact@company.com",
        phone: "+1 555 123 4567",
        website: "https://company.com",
        country: "DK",
        industry: "Technology",
        boothNumber: "A-123",
        standLocationUrl: "https://floorplan.com/booth/123",
        companyProfile: "Makes things.",
      },
    ]);
  });

  it("needs a company name and a valid email", () => {
    const result = parseExhibitorRows([
      ["Company", "Email"],
      ["", "a@b.com"],
      ["Beta", ""],
      ["Gamma", "not-an-email"],
      ["Delta", "d@delta.com"],
      ["delta", "d2@delta.com"],
    ]);
    expect(result.items.map((e) => e.name)).toEqual(["Delta"]);
    expect(result.problems).toEqual([
      "Row 2: Enter the company name.",
      "Row 3: Enter the exhibitor's email.",
      "Row 4: Enter a valid email address.",
      'Row 6: "delta" appears twice in the file, skipped.',
    ]);
  });
});

describe("exhibitorKey", () => {
  it("ignores case", () => {
    expect(exhibitorKey({ name: "ACME " })).toBe(exhibitorKey({ name: "acme" }));
  });
});
