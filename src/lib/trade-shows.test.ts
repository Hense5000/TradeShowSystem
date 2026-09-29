import { describe, expect, it } from "vitest";
import { parseTradeShowRows, showStatus, tradeShowKey } from "./trade-shows";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("showStatus", () => {
  const show = { startDate: d("2026-09-22"), endDate: d("2026-09-25") };
  it("follows the dates", () => {
    expect(showStatus(show, new Date("2026-09-21T23:59:00Z"))).toBe("upcoming");
    expect(showStatus(show, new Date("2026-09-22T00:00:00Z"))).toBe("running");
    expect(showStatus(show, new Date("2026-09-25T20:00:00Z"))).toBe("running");
    expect(showStatus(show, new Date("2026-09-26T00:00:00Z"))).toBe("finished");
  });
});

describe("parseTradeShowRows", () => {
  it("reads Base44-style columns and European dates", () => {
    const result = parseTradeShowRows([
      ["Trade show name", "Start date", "End date", "City", "Country", "Website", "Status", "Exhibitor directory URL", "Exhibition center"],
      ["InnoTrans", "22.09.2026", "25.09.2026", "Berlin", "Germany", "innotrans.de", "finished", "innotrans.de/exhibitors", "Messe Berlin"],
    ]);
    expect(result.problems).toEqual([]);
    expect(result.items).toEqual([
      {
        name: "InnoTrans",
        startDate: d("2026-09-22"),
        endDate: d("2026-09-25"),
        city: "Berlin",
        country: "DE",
        website: "https://innotrans.de",
        exhibitorDirectoryUrl: "https://innotrans.de/exhibitors",
        centerId: null,
        centerName: "Messe Berlin",
      },
    ]);
  });

  it("explains bad dates and duplicates", () => {
    const result = parseTradeShowRows([
      ["Name", "Start", "End"],
      ["A", "2026-10-02", "2026-10-01"],
      ["B", "soon", "2026-10-01"],
      ["C", "", ""],
      ["D", "2026-10-01", "2026-10-03"],
      ["d", "1.10.2026", "3.10.2026"],
    ]);
    expect(result.items.map((s) => s.name)).toEqual(["D"]);
    expect(result.problems).toEqual([
      "Row 2: The end date can't be before the start date.",
      'Row 3: Start date: "soon" is not a date. Use a date like 2026-09-22.',
      "Row 4: Enter the start date.",
      'Row 6: "d" appears twice in the file, skipped.',
    ]);
  });
});

describe("tradeShowKey", () => {
  it("uses name and start date", () => {
    expect(tradeShowKey({ name: "IFA ", startDate: d("2026-09-04") })).toBe(tradeShowKey({ name: "ifa", startDate: d("2026-09-04") }));
    expect(tradeShowKey({ name: "IFA", startDate: d("2027-09-03") })).not.toBe(tradeShowKey({ name: "IFA", startDate: d("2026-09-04") }));
  });
});
