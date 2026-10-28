import { describe, expect, it } from "vitest";
import { daysLeftLabel, inTrial, TRIAL_DAYS, trialDaysLeft, trialEnd, trialEndedEmailContent } from "./trial";

describe("free trial", () => {
  const start = new Date("2026-10-28T09:00:00Z");
  const end = trialEnd(start);

  it("lasts seven days from sign-up", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(end.toISOString()).toBe("2026-11-04T09:00:00.000Z");
  });

  it("is on until the end time and off after it, and off for accounts without one", () => {
    expect(inTrial(end, new Date("2026-11-04T08:59:59Z"))).toBe(true);
    expect(inTrial(end, new Date("2026-11-04T09:00:00Z"))).toBe(false);
    expect(inTrial(null, start)).toBe(false);
  });

  it("counts the days left, a started day as one", () => {
    expect(trialDaysLeft(end, start)).toBe(7);
    expect(trialDaysLeft(end, new Date("2026-11-03T10:00:00Z"))).toBe(1);
    expect(trialDaysLeft(end, new Date("2026-11-05T10:00:00Z"))).toBe(0);
    expect(daysLeftLabel(1)).toBe("1 day left");
    expect(daysLeftLabel(7)).toBe("7 days left");
  });

  it("writes the trial ended email with the subscribe link", () => {
    const mail = trialEndedEmailContent({ accountName: "A & B", price: "€49.00", url: "https://x.test/a/ab/billing/checkout" });
    expect(mail.text).toContain("https://x.test/a/ab/billing/checkout");
    expect(mail.text).toContain("€49.00 per user per month");
    expect(mail.html).toContain("A &amp; B");
  });
});
