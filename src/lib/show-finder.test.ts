import { describe, expect, it } from "vitest";
import { checkDate, checkFoundShows, foundNote, isDue, isSameShow, newShows, pageToText, runSummary, showNameKey } from "./show-finder";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const now = new Date("2026-10-02T08:00:00Z");

describe("pageToText", () => {
  it("keeps text and links, drops scripts and styles", () => {
    const html = `<html><head><title>x</title><style>.a{}</style></head><body>
      <script>var x = 1;</script>
      <h2>Upcoming</h2><ul><li><a href="/events/foodfair">Food&amp;Drink Fair</a> 12.&nbsp;March 2027</li>
      <li><a href="javascript:void(0)">Menu</a></li></ul></body></html>`;
    const { text, cut } = pageToText(html, "https://center.example/calendar");
    expect(cut).toBe(false);
    expect(text).toContain("Upcoming");
    expect(text).toContain("Food&Drink Fair (https://center.example/events/foodfair) 12. March 2027");
    expect(text).toContain("Menu");
    expect(text).not.toContain("var x");
    expect(text).not.toContain(".a{}");
  });

  it("keeps embedded event data", () => {
    const html = `<script type="application/ld+json">{"@type":"Event","name":"Agromek","startDate":"2027-11-30"}</script><p>Hi</p>`;
    expect(pageToText(html, "https://x.example").text).toContain('"startDate":"2027-11-30"');
  });
});

describe("checkFoundShows", () => {
  it("keeps future shows with real dates", () => {
    const result = checkFoundShows(
      [
        { name: "  Agromek ", startDate: "2027-11-30", endDate: "2027-12-03", website: "https://agromek.dk" },
        { name: "Running now", startDate: "2026-09-30", endDate: "2026-10-03", website: null },
        { name: "One day", startDate: "2027-01-05", endDate: "", website: "not a url" },
        { name: "Over", startDate: "2026-09-01", endDate: "2026-09-03", website: null },
        { name: "Backwards", startDate: "2027-05-05", endDate: "2027-05-01", website: null },
        { name: "No date", startDate: "spring 2027", endDate: "", website: null },
        { name: "Far away", startDate: "2032-01-01", endDate: "2032-01-02", website: null },
      ],
      now,
    );
    expect(result).toEqual([
      { name: "Agromek", startDate: d("2027-11-30"), endDate: d("2027-12-03"), website: "https://agromek.dk/" },
      { name: "Running now", startDate: d("2026-09-30"), endDate: d("2026-10-03"), website: null },
      { name: "One day", startDate: d("2027-01-05"), endDate: d("2027-01-05"), website: null },
    ]);
  });
});

describe("isSameShow", () => {
  it("ignores years, case and punctuation", () => {
    expect(showNameKey("Formland – Autumn 2027")).toBe("formlandautumn");
    expect(isSameShow({ name: "FOODEXPO 2027", startDate: d("2027-03-14") }, { name: "Foodexpo", startDate: d("2027-03-15") })).toBe(true);
  });

  it("treats next year's edition as a new show", () => {
    expect(isSameShow({ name: "Foodexpo", startDate: d("2028-03-12") }, { name: "Foodexpo", startDate: d("2027-03-14") })).toBe(false);
  });

  it("does not match different names", () => {
    expect(isSameShow({ name: "Foodexpo", startDate: d("2027-03-14") }, { name: "Boatshow", startDate: d("2027-03-14") })).toBe(false);
  });
});

describe("newShows", () => {
  it("leaves out known shows and repeats", () => {
    const found = [
      { name: "Agromek", startDate: d("2027-11-30") },
      { name: "Agromek 2027", startDate: d("2027-11-30") },
      { name: "Foodexpo", startDate: d("2027-03-14") },
    ];
    expect(newShows(found, [{ name: "foodexpo", startDate: d("2027-03-14") }])).toEqual([found[0]]);
  });
});

describe("isDue", () => {
  it("without a check day, is due when never checked or checked four weeks ago", () => {
    expect(isDue({ checkedAt: null, checkDay: null }, now)).toBe(true);
    expect(isDue({ checkedAt: new Date("2026-09-04T08:00:00Z"), checkDay: null }, now)).toBe(true);
    expect(isDue({ checkedAt: new Date("2026-09-20T08:00:00Z"), checkDay: null }, now)).toBe(false);
  });

  it("with a check day, is due from that day until it has been checked", () => {
    const tenth = { checkDay: 10 };
    expect(isDue({ ...tenth, checkedAt: new Date("2026-09-10T05:00:00Z") }, new Date("2026-10-09T05:00:00Z"))).toBe(false);
    expect(isDue({ ...tenth, checkedAt: new Date("2026-09-10T05:00:00Z") }, new Date("2026-10-10T05:00:00Z"))).toBe(true);
    expect(isDue({ ...tenth, checkedAt: new Date("2026-10-10T05:01:00Z") }, new Date("2026-10-10T05:30:00Z"))).toBe(false);
    // Missed on the 10th (too many centers that day): caught up the next day.
    expect(isDue({ ...tenth, checkedAt: new Date("2026-09-10T05:00:00Z") }, new Date("2026-10-11T05:00:00Z"))).toBe(true);
    expect(isDue({ ...tenth, checkedAt: null }, new Date("2026-10-11T05:00:00Z"))).toBe(true);
  });

  it("uses the last day of short months", () => {
    expect(checkDate(31, new Date("2026-11-15T05:00:00Z"))).toEqual(new Date("2026-11-30T00:00:00Z"));
    expect(isDue({ checkDay: 31, checkedAt: new Date("2026-10-31T05:00:00Z") }, new Date("2026-11-30T05:00:00Z"))).toBe(true);
  });
});

describe("runSummary", () => {
  it("reads naturally", () => {
    expect(runSummary({ checked: 1, found: 0, failed: 0, left: 0 })).toBe("Checked 1 center. Found 0 new shows.");
    expect(runSummary({ checked: 3, found: 1, failed: 2, left: 4 })).toBe(
      "Checked 3 centers. Found 1 new show. 2 pages could not be read. 4 centers were not reached this time and will be checked next.",
    );
  });
});

describe("foundNote", () => {
  it("explains what happened to each show", () => {
    expect(foundNote({ listed: 1, usable: 1, fresh: 1 })).toBe("Found 1 trade show on the page: 1 new.");
    expect(foundNote({ listed: 12, usable: 11, fresh: 2 })).toBe(
      "Found 12 trade shows on the page: 2 new, 9 already known, 1 in the past or without exact dates.",
    );
  });
});
