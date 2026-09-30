import { describe, expect, it } from "vitest";
import { addMonths, formatDateRange, isoDate, parseDate, today } from "./dates";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("parseDate", () => {
  it("reads the common ways of writing a date", () => {
    for (const v of ["2026-09-22", "22.09.2026", "22/09/2026", "22-09-2026", "22.9.26", "Sep 22, 2026", "September 22 2026", "22 Sep 2026", "22. september 2026", "2026-09-22T10:00:00Z"]) {
      expect(parseDate(v) && isoDate(parseDate(v)!), v).toBe("2026-09-22");
    }
  });

  it("rejects things that are not dates", () => {
    for (const v of ["", "soon", "2026-02-30", "31.04.2026", "Foo 1, 2026"]) expect(parseDate(v), v).toBeNull();
  });
});

describe("today", () => {
  it("is midnight UTC", () => {
    expect(today(new Date("2026-09-29T23:30:00Z")).toISOString()).toBe("2026-09-29T00:00:00.000Z");
  });
});

describe("formatDateRange", () => {
  it("keeps it short", () => {
    expect(formatDateRange(d("2026-09-22"), d("2026-09-25"))).toBe("Sep 22 – 25, 2026");
    expect(formatDateRange(d("2026-09-29"), d("2026-10-02"))).toBe("Sep 29 – Oct 2, 2026");
    expect(formatDateRange(d("2026-12-30"), d("2027-01-02"))).toBe("Dec 30, 2026 – Jan 2, 2027");
    expect(formatDateRange(d("2026-09-22"), d("2026-09-22"))).toBe("Sep 22, 2026");
  });
});

describe("addMonths", () => {
  it("moves by whole months and stays inside short months", () => {
    expect(isoDate(addMonths(d("2026-09-30"), 2))).toBe("2026-11-30");
    expect(isoDate(addMonths(d("2026-11-15"), 3))).toBe("2027-02-15");
    expect(isoDate(addMonths(d("2026-12-31"), 2))).toBe("2027-02-28");
    expect(isoDate(addMonths(d("2027-12-31"), 2))).toBe("2028-02-29");
  });
});
