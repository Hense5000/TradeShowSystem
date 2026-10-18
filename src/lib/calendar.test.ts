import { describe, expect, it } from "vitest";
import { icsCalendar, isOn, monthParam, monthWeeks, parseMonth, shiftMonth } from "./calendar";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("calendar months", () => {
  it("reads the month from the URL, else this month", () => {
    expect(parseMonth("2026-11", d("2026-10-18"))).toEqual(d("2026-11-01"));
    expect(parseMonth("2026-13", d("2026-10-18"))).toEqual(d("2026-10-01"));
    expect(parseMonth(undefined, d("2026-10-18"))).toEqual(d("2026-10-01"));
    expect(monthParam(shiftMonth(d("2026-12-01"), 1))).toBe("2027-01");
    expect(monthParam(shiftMonth(d("2026-01-01"), -1))).toBe("2025-12");
  });

  it("shows whole weeks from Monday to Sunday", () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const weeks = monthWeeks(d("2026-10-01"));
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual(d("2026-09-28"));
    expect(weeks[4][6]).toEqual(d("2026-11-01"));
    // February 2027 is exactly four weeks from Monday the 1st.
    expect(monthWeeks(d("2027-02-01"))).toHaveLength(4);
  });

  it("knows which days a show is on", () => {
    const show = { startDate: d("2026-11-16"), endDate: d("2026-11-19") };
    expect(isOn(show, d("2026-11-16"))).toBe(true);
    expect(isOn(show, d("2026-11-19"))).toBe(true);
    expect(isOn(show, d("2026-11-20"))).toBe(false);
  });
});

describe("ics file", () => {
  it("writes each show as an all-day event", () => {
    const ics = icsCalendar(
      "VivoLead favorite trade shows",
      [
        {
          id: "s1",
          name: "MEDICA 2026",
          startDate: d("2026-11-16"),
          endDate: d("2026-11-19"),
          location: "Messe Düsseldorf, Düsseldorf; Germany",
          url: "https://www.medica.de",
          description: "Meeting plan: https://x.test/a/v/favorites/plan?show=s1",
        },
      ],
      new Date("2026-10-18T19:20:00.123Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261116\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261120\r\n");
    expect(ics).toContain("DTSTAMP:20261018T192000Z\r\n");
    expect(ics).toContain("LOCATION:Messe Düsseldorf\\, Düsseldorf\; Germany\r\n");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    // No line is longer than 75 bytes.
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain("DESCRIPTION:Meeting plan: https://x.test/a/v/favorites/plan?show=s1");
  });
});
