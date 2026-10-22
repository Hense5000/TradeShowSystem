import { describe, expect, it } from "vitest";
import { checkExport, exportDay, planOf } from "./export-limit";

describe("planOf", () => {
  it("is pro only on the pro price", () => {
    expect(planOf("price_pro", "price_pro")).toBe("pro");
    expect(planOf("price_basic", "price_pro")).toBe("basic");
    expect(planOf(null, "price_pro")).toBe("basic");
  });

  it("is basic while no pro price is set up", () => {
    expect(planOf(undefined, undefined)).toBe("basic");
    expect(planOf("price_basic", undefined)).toBe("basic");
  });
});

describe("exportDay", () => {
  it("is the date in Denmark", () => {
    // 23:30 UTC on 22 October is already 23 October in Copenhagen (summer time).
    expect(exportDay(new Date("2026-10-22T23:30:00Z"))).toBe("2026-10-23");
    expect(exportDay(new Date("2026-10-22T12:00:00Z"))).toBe("2026-10-22");
  });
});

describe("checkExport", () => {
  it("allows the first show of the day", () => {
    expect(checkExport(["a"], [], 1)).toEqual({ ok: true, newShows: ["a"] });
  });

  it("allows the same show again the same day for free", () => {
    expect(checkExport(["a", "a"], ["a"], 1)).toEqual({ ok: true, newShows: [] });
  });

  it("stops a second show on the basic plan", () => {
    expect(checkExport(["b"], ["a"], 1)).toEqual({ ok: false, limit: 1, used: ["a"], needed: ["b"] });
  });

  it("stops a file with more shows than are left", () => {
    expect(checkExport(["a", "b", "c"], [], 1)).toEqual({ ok: false, limit: 1, used: [], needed: ["a", "b", "c"] });
  });

  it("allows up to five shows on the pro plan", () => {
    expect(checkExport(["d", "e"], ["a", "b", "c"], 5)).toEqual({ ok: true, newShows: ["d", "e"] });
    expect(checkExport(["f"], ["a", "b", "c", "d", "e"], 5).ok).toBe(false);
  });

  it("allows an empty file", () => {
    expect(checkExport([], ["a"], 1)).toEqual({ ok: true, newShows: [] });
  });
});
