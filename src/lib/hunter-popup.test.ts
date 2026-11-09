import { describe, expect, it } from "vitest";
import { popupDay, shouldShowHunterPopup } from "./hunter-popup";

const now = new Date("2026-11-09T10:00:00Z");
const base = {
  hunterConnected: false,
  hasAccess: true,
  hidden: false,
  lastShownDay: null,
  now,
};

describe("shouldShowHunterPopup", () => {
  it("shows when Hunter.io is not connected and it was not shown today", () => {
    expect(shouldShowHunterPopup(base)).toBe(true);
    expect(shouldShowHunterPopup({ ...base, lastShownDay: "2026-11-08" })).toBe(true);
  });

  it("shows at most once a day", () => {
    expect(shouldShowHunterPopup({ ...base, lastShownDay: "2026-11-09" })).toBe(false);
  });

  it("uses the Danish date", () => {
    // 23:30 UTC on 9 November is already 10 November in Denmark.
    expect(popupDay(new Date("2026-11-09T23:30:00Z"))).toBe("2026-11-10");
  });

  it("never shows once Hunter.io is connected, the user hid it, or the account is blocked", () => {
    expect(shouldShowHunterPopup({ ...base, hunterConnected: true })).toBe(false);
    expect(shouldShowHunterPopup({ ...base, hidden: true })).toBe(false);
    expect(shouldShowHunterPopup({ ...base, hasAccess: false })).toBe(false);
  });
});
