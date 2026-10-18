import { describe, expect, it } from "vitest";
import { currentSubscription, formatMoney, hasPaidAccess, intervalLabel, isLive, statusLabel, statusPill } from "./billing";

describe("currentSubscription", () => {
  const old = { status: "canceled", createdAt: new Date("2026-01-01") };
  const live = { status: "active", createdAt: new Date("2026-02-01") };
  const newer = { status: "canceled", createdAt: new Date("2026-03-01") };

  it("prefers a live subscription over newer cancelled ones", () => {
    expect(currentSubscription([old, newer, live])).toBe(live);
  });

  it("falls back to the newest one when none is live", () => {
    expect(currentSubscription([old, newer])).toBe(newer);
  });

  it("returns null when the account never subscribed", () => {
    expect(currentSubscription([])).toBeNull();
  });
});

describe("status rules", () => {
  it("treats a failed payment as still subscribed, so no second subscription is started", () => {
    expect(isLive("past_due")).toBe(true);
    expect(isLive("canceled")).toBe(false);
    expect(isLive("incomplete_expired")).toBe(false);
  });

  it("labels and colours statuses", () => {
    expect(statusLabel("active")).toBe("Active");
    expect(statusLabel("something_new")).toBe("something_new");
    expect(statusPill("active")).toBe("pill-ok");
    expect(statusPill("past_due")).toBe("pill-warn");
    expect(statusPill("canceled")).toBe("pill-neutral");
  });
});

describe("formatting", () => {
  it("formats amounts in the smallest currency unit", () => {
    expect(formatMoney(125000, "dkk").replace(/\s/g, " ")).toBe("DKK 1,250.00");
    expect(formatMoney(4900, "eur")).toBe("€49.00");
  });

  it("describes billing intervals", () => {
    expect(intervalLabel("month")).toBe("per month");
    expect(intervalLabel("year")).toBe("per year");
    expect(intervalLabel("month", 3)).toBe("every 3 months");
  });
});

describe("hasPaidAccess", () => {
  it("lets paying accounts in, also while a failed payment is retried", () => {
    expect(hasPaidAccess({ status: "active" })).toBe(true);
    expect(hasPaidAccess({ status: "trialing" })).toBe(true);
    expect(hasPaidAccess({ status: "past_due" })).toBe(true);
  });

  it("blocks accounts that never paid or whose subscription ended", () => {
    expect(hasPaidAccess(null)).toBe(false);
    expect(hasPaidAccess({ status: "incomplete" })).toBe(false);
    expect(hasPaidAccess({ status: "unpaid" })).toBe(false);
    expect(hasPaidAccess({ status: "canceled" })).toBe(false);
  });
});
