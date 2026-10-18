import { isoDate } from "@/lib/dates";

// The month calendar of favorite trade shows and its .ics download. Dates are
// date-only values at midnight UTC, like trade show start and end (see dates.ts).

/** The month in "?month=2026-11", or the month of today when it is missing or wrong. Returns the first day of the month. */
export function parseMonth(value: unknown, today: Date): Date {
  const m = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})$/) : null;
  const month = m ? Number(m[2]) : 0;
  if (m && month >= 1 && month <= 12) return new Date(Date.UTC(Number(m[1]), month - 1, 1));
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
}

/** "2026-11", for links to a month. */
export function monthParam(month: Date): string {
  return isoDate(month).slice(0, 7);
}

/** The first day of the month a number of months before or after. */
export function shiftMonth(month: Date, by: number): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + by, 1));
}

const DAY = 86_400_000;

/** The weeks shown for a month, Monday first, from the Monday on or before the 1st to the Sunday on or after the last day. */
export function monthWeeks(month: Date): Date[][] {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
  const start = first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY;
  const end = last.getTime() + ((7 - last.getUTCDay()) % 7) * DAY;
  const weeks: Date[][] = [];
  for (let t = start; t <= end; t += 7 * DAY) weeks.push(Array.from({ length: 7 }, (_, i) => new Date(t + i * DAY)));
  return weeks;
}

/** Whether a show is on during a day (start and end included). */
export function isOn(show: { startDate: Date; endDate: Date }, day: Date): boolean {
  return show.startDate.getTime() <= day.getTime() && day.getTime() <= show.endDate.getTime();
}

export type CalendarEvent = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  location: string;
  url: string | null; // the show's website
  description: string;
};

// Text in an .ics file: backslash, semicolon, comma and line breaks are escaped.
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (d: Date) => isoDate(d).replace(/-/g, "");

/** Lines longer than 75 bytes are folded: continued on the next line after a space. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** An iCalendar file with each show as an all-day event, for Outlook, Google Calendar or Apple Calendar. */
export function icsCalendar(name: string, events: CalendarEvent[], stamp: Date): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trade Show System//Favorite trade shows//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${text(name)}`,
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.id}@tradeshowsystem`,
      `DTSTAMP:${stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART;VALUE=DATE:${compact(e.startDate)}`,
      // The end of an all-day event is the day after the last day.
      `DTEND;VALUE=DATE:${compact(new Date(e.endDate.getTime() + DAY))}`,
      `SUMMARY:${text(e.name)}`,
      ...(e.location ? [`LOCATION:${text(e.location)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      ...(e.description ? [`DESCRIPTION:${text(e.description)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
