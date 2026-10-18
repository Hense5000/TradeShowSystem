import { describe, expect, it } from "vitest";
import { exhibitorFilters, exhibitorQuery, exhibitorWhere, isFiltered, NO_FILTERS } from "./exhibitor-list";

describe("exhibitor filters", () => {
  it("reads the page URL and drops an unknown country or a bad date", () => {
    expect(exhibitorFilters({ q: "  acme ", show: "s1", country: "XX" })).toEqual({ ...NO_FILTERS, q: "acme", show: "s1" });
    expect(exhibitorFilters(new URLSearchParams("country=DK&format=csv&from=2027-13-01&to=2027-05-31&showCountry=DE"))).toEqual({
      ...NO_FILTERS,
      country: "DK",
      showCountry: "DE",
      to: "2027-05-31",
    });
    expect(exhibitorFilters({ industry: " medical,, medtech ,medical" }).industry).toBe("medical, medtech");
  });

  it("builds the same query for the page and the export", () => {
    const f = { ...NO_FILTERS, q: "a b", show: "s1", country: "DK" };
    expect(exhibitorQuery(f, { format: "csv" })).toBe("?q=a+b&show=s1&country=DK&format=csv");
    expect(exhibitorQuery(NO_FILTERS)).toBe("");
    expect(exhibitorWhere({ ...NO_FILTERS, show: "s1" })).toEqual({ tradeShowId: "s1" });
  });

  it("filters on the trade show's place and dates and the industry words", () => {
    const where = exhibitorWhere({ ...NO_FILTERS, industry: "medical, medtech", showCountry: "DE", from: "2027-03-01", to: "2027-05-31" });
    expect(where.tradeShow).toEqual({ country: "DE", endDate: { gte: new Date("2027-03-01") }, startDate: { lte: new Date("2027-05-31") } });
    expect(where.AND).toHaveLength(1);
  });

  it("does not count the question alone as a filter", () => {
    expect(isFiltered({ ...NO_FILTERS, ai: "anything" })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, showCity: "Munich" })).toBe(true);
  });
});
