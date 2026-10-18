import { describe, expect, it } from "vitest";
import { byBooth, checkFollowUp, checkLeadNote, favoriteFilters, favoriteQuery, favoriteWhere, followUpLabel, followUpState, parseLeadStatus } from "./leads";

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
    expect(favoriteFilters({ q: " acme ", show: "s1", status: "WON" })).toEqual({ q: "acme", show: "s1", status: "WON", followUp: "", owner: "" });
    expect(favoriteFilters(new URLSearchParams("status=nope"))).toEqual({ q: "", show: "", status: "", followUp: "", owner: "" });
    expect(favoriteFilters({ followup: "due" }).followUp).toBe("due");
    expect(favoriteFilters({ owner: "me" }).owner).toBe("me");
  });

  it("filters the list's items by status, trade show and search", () => {
    expect(favoriteWhere("l1", { q: "", show: "", status: "", followUp: "", owner: "" })).toEqual({ listId: "l1" });
    const where = favoriteWhere("l1", { q: "acme", show: "s1", status: "NEW", followUp: "", owner: "" });
    expect(where).toMatchObject({ listId: "l1", leadStatus: "NEW", exhibitor: { tradeShowId: "s1" } });
    expect(where.exhibitor).toHaveProperty("OR");
    const day = new Date("2026-10-18T00:00:00Z");
    expect(favoriteWhere("l1", { q: "", show: "", status: "", followUp: "due", owner: "" }, { today: day })).toEqual({ listId: "l1", followUpAt: { lte: day } });
    const empty = { q: "", show: "", status: "", followUp: "" } as const;
    expect(favoriteWhere("l1", { ...empty, owner: "me" }, { userId: "u1" })).toEqual({ listId: "l1", assigneeId: "u1" });
    expect(favoriteWhere("l1", { ...empty, owner: "none" }, { userId: "u1" })).toEqual({ listId: "l1", assigneeId: null });
    expect(favoriteWhere("l1", { ...empty, owner: "u2" }, { userId: "u1" })).toEqual({ listId: "l1", assigneeId: "u2" });
  });

  it("builds the query string", () => {
    expect(favoriteQuery({ q: "", show: "", status: "", followUp: "", owner: "" })).toBe("");
    expect(favoriteQuery({ q: "a b", show: "", status: "WON", followUp: "due", owner: "" }, { page: "2" })).toBe("?q=a+b&status=WON&followup=due&page=2");
    expect(favoriteQuery({ q: "", show: "", status: "", followUp: "", owner: "me" })).toBe("?owner=me");
  });
});

describe("follow-ups", () => {
  const day = new Date("2026-10-18T00:00:00Z");
  const d = (s: string) => new Date(`${s}T00:00:00Z`);

  it("reads the date and reminder, and clears both without a date", () => {
    expect(checkFollowUp("2026-11-05", "  Call   again ")).toEqual({ date: d("2026-11-05"), note: "Call again" });
    expect(checkFollowUp("", "Call again")).toEqual({ date: null, note: null });
    expect(checkFollowUp("2026-11-05", "")).toEqual({ date: d("2026-11-05"), note: null });
    expect(checkFollowUp("not a date", "")).toHaveProperty("error");
    expect(checkFollowUp("2026-11-05", "x".repeat(201))).toHaveProperty("error");
  });

  it("tells overdue, today, soon and later apart", () => {
    expect(followUpState(d("2026-10-17"), day)).toBe("overdue");
    expect(followUpState(d("2026-10-18"), day)).toBe("today");
    expect(followUpState(d("2026-10-25"), day)).toBe("soon");
    expect(followUpState(d("2026-10-26"), day)).toBe("later");
  });

  it("labels the date", () => {
    expect(followUpLabel(d("2026-10-15"), day)).toBe("Overdue · Oct 15");
    expect(followUpLabel(d("2026-10-18"), day)).toBe("Today");
    expect(followUpLabel(d("2026-10-19"), day)).toBe("Tomorrow");
    expect(followUpLabel(d("2026-10-21"), day)).toBe("Wed, Oct 21");
  });
});

describe("byBooth", () => {
  const e = (boothNumber: string | null, name = "X") => ({ boothNumber, name });

  it("sorts booth numbers the way they are walked", () => {
    const sorted = [e("A10"), e("B1"), e("A2"), e("10.120"), e("2.015")].sort(byBooth);
    expect(sorted.map((x) => x.boothNumber)).toEqual(["2.015", "10.120", "A2", "A10", "B1"]);
  });

  it("puts exhibitors without a booth last, by name", () => {
    const sorted = [e(null, "Beta"), e(" ", "Alpha"), e("C3", "Zed")].sort(byBooth);
    expect(sorted.map((x) => x.name)).toEqual(["Zed", "Alpha", "Beta"]);
  });

  it("sorts the same booth by name", () => {
    expect([e("A1", "b"), e("a1", "A")].sort(byBooth).map((x) => x.name)).toEqual(["A", "b"]);
  });
});
