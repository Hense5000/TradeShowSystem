import { describe, expect, it } from "vitest";
import { checkLeadNote, favoriteFilters, favoriteQuery, favoriteWhere, parseLeadStatus } from "./leads";

describe("lead status", () => {
  it("accepts only the known statuses", () => {
    expect(parseLeadStatus("MEETING")).toBe("MEETING");
    expect(parseLeadStatus("meeting")).toBeUndefined();
    expect(parseLeadStatus(undefined)).toBeUndefined();
  });
});

describe("lead notes", () => {
  it("trims the note and stores an empty one as nothing", () => {
    expect(checkLeadNote("  Call back in May ")).toEqual({ note: "Call back in May" });
    expect(checkLeadNote("   ")).toEqual({ note: null });
    expect(checkLeadNote(null)).toEqual({ note: null });
  });

  it("refuses a note that is too long", () => {
    expect(checkLeadNote("x".repeat(2001))).toHaveProperty("error");
  });
});

describe("favorite filters", () => {
  it("reads the filters and drops an unknown status", () => {
    expect(favoriteFilters({ q: " acme ", show: "s1", status: "WON" })).toEqual({ q: "acme", show: "s1", status: "WON" });
    expect(favoriteFilters(new URLSearchParams("status=nope"))).toEqual({ q: "", show: "", status: "" });
  });

  it("filters the list's items by status, trade show and search", () => {
    expect(favoriteWhere("l1", { q: "", show: "", status: "" })).toEqual({ listId: "l1" });
    const where = favoriteWhere("l1", { q: "acme", show: "s1", status: "NEW" });
    expect(where).toMatchObject({ listId: "l1", leadStatus: "NEW", exhibitor: { tradeShowId: "s1" } });
    expect(where.exhibitor).toHaveProperty("OR");
  });

  it("builds the query string", () => {
    expect(favoriteQuery({ q: "", show: "", status: "" })).toBe("");
    expect(favoriteQuery({ q: "a b", show: "", status: "WON" }, { page: "2" })).toBe("?q=a+b&status=WON&page=2");
  });
});
