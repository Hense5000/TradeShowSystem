import { describe, expect, it } from "vitest";
import { isoDate } from "./dates";
import { cleanupCutoff, oldTradeShowsWhere } from "./trade-show-cleanup";

describe("cleanupCutoff", () => {
  it("is the same day three years back", () => {
    expect(isoDate(cleanupCutoff(new Date("2026-10-14T05:00:00Z")))).toBe("2023-10-14");
  });

  it("moves Feb 29 to Feb 28", () => {
    expect(isoDate(cleanupCutoff(new Date("2028-02-29T12:00:00Z")))).toBe("2025-02-28");
  });

  it("keeps a show that ended exactly three years ago and deletes one a day older", () => {
    const cutoff = oldTradeShowsWhere(new Date("2026-10-14T05:00:00Z")).endDate.lt;
    expect(new Date("2023-10-14") < cutoff).toBe(false);
    expect(new Date("2023-10-13") < cutoff).toBe(true);
  });
});
