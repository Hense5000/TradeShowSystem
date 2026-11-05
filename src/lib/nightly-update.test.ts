import { describe, expect, it } from "vitest";
import { copenhagenHour, hasPagesLeft, isNightlyHour, listProgress, nightlySummary, pageFailed, pageRead, takePage } from "./nightly-update";

describe("isNightlyHour", () => {
  it("runs at 03:00 Danish time in winter (02:00 UTC) but not at 01:00 UTC", () => {
    expect(copenhagenHour(new Date("2026-11-05T02:10:00Z"))).toBe(3);
    expect(isNightlyHour(new Date("2026-11-05T02:10:00Z"))).toBe(true);
    expect(isNightlyHour(new Date("2026-11-05T01:10:00Z"))).toBe(false);
  });

  it("runs at 03:00 Danish time in summer (01:00 UTC)", () => {
    expect(copenhagenHour(new Date("2026-07-01T01:30:00Z"))).toBe(3);
    expect(isNightlyHour(new Date("2026-07-01T01:30:00Z"))).toBe(true);
  });

  it("stops at 07:00 Danish time", () => {
    expect(isNightlyHour(new Date("2026-11-05T05:59:00Z"))).toBe(true);
    expect(isNightlyHour(new Date("2026-11-05T06:00:00Z"))).toBe(false);
  });
});

describe("list progress", () => {
  const dir = "https://show.example/exhibitors";

  it("starts at the directory page", () => {
    expect(listProgress(null, dir)).toEqual({ queue: [dir], known: [dir], pages: 0, failedPages: 0, added: 0 });
    expect(listProgress({ queue: "bad" }, dir).queue).toEqual([dir]);
  });

  it("carries on from a saved place and queues new pages once", () => {
    const saved = listProgress({ queue: [`${dir}?page=2`], known: [dir, `${dir}?page=2`], pages: 1, failedPages: 0, added: 40 }, dir);
    const [page, rest] = takePage(saved);
    expect(page).toBe(`${dir}?page=2`);
    const after = pageRead(rest, dir, { added: 10, otherPages: [`${dir}?page=2`, `${dir}?page=3`, "https://other.example/x"] });
    expect(after.queue).toEqual([`${dir}?page=3`]);
    expect(after.pages).toBe(2);
    expect(after.added).toBe(50);
    expect(hasPagesLeft(after)).toBe(true);
  });

  it("keeps the first error and stops at the page limit", () => {
    let p = pageFailed(listProgress(null, dir), "first");
    p = pageFailed(p, "second");
    expect(p.firstError).toBe("first");
    expect(hasPagesLeft({ ...p, pages: 58, failedPages: 2 })).toBe(false);
  });
});

describe("nightlySummary", () => {
  it("says what the round did", () => {
    expect(
      nightlySummary({ finder: "Checked 3 centers. Added 2 new trade shows.", filled: 2, added: 120, urlsFound: 1, noDirectory: 1, empty: 0, failed: 0, left: 4 }),
    ).toBe(
      "Trade show finder: Checked 3 centers. Added 2 new trade shows. Exhibitors: 120 added to 2 shows. Found the exhibitor list of 1 show. 1 show had no exhibitor list to find. 4 shows still to go in the next round.",
    );
  });
});
