import { describe, expect, it } from "vitest";
import { exhibitorFilters, exhibitorQuery, exhibitorWhere } from "./exhibitor-list";

describe("exhibitor filters", () => {
  it("reads the page URL and drops an unknown country", () => {
    expect(exhibitorFilters({ q: "  acme ", show: "s1", country: "XX" })).toEqual({ q: "acme", show: "s1", country: "" });
    expect(exhibitorFilters(new URLSearchParams("country=DK&format=csv"))).toEqual({ q: "", show: "", country: "DK" });
  });

  it("builds the same query for the page and the export", () => {
    const f = { q: "a b", show: "s1", country: "DK" };
    expect(exhibitorQuery(f, { format: "csv" })).toBe("?q=a+b&show=s1&country=DK&format=csv");
    expect(exhibitorQuery({ q: "", show: "", country: "" })).toBe("");
    expect(exhibitorWhere({ q: "", show: "s1", country: "" })).toEqual({ tradeShowId: "s1" });
  });
});
