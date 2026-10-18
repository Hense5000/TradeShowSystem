import { describe, expect, it } from "vitest";
import { defaultDraftLanguage, mailtoHref, parseDraft, parseDraftLanguage } from "./email-draft";

describe("email draft", () => {
  it("writes in the exhibitor's language when it is likely to prefer it, else English", () => {
    expect(defaultDraftLanguage("DK")).toBe("da");
    expect(defaultDraftLanguage("AT")).toBe("de");
    expect(defaultDraftLanguage("US")).toBe("en");
    expect(defaultDraftLanguage(null)).toBe("en");
    expect(parseDraftLanguage("de")).toBe("de");
    expect(parseDraftLanguage("xx")).toBe("en");
  });

  it("splits the subject from the body", () => {
    expect(parseDraft("SUBJECT: Meeting at MEDICA\n\nDear Anna,\n\n\n\nBest regards")).toEqual({
      subject: "Meeting at MEDICA",
      body: "Dear Anna,\n\nBest regards",
    });
    expect(parseDraft("**Subject:** **Hello**\nHi")).toEqual({ subject: "Hello", body: "Hi" });
    expect(parseDraft("Just a body")).toEqual({ subject: "", body: "Just a body" });
  });

  it("builds a mailto link", () => {
    expect(mailtoHref("anna@acme.com", "Hi & bye", "Line 1\nLine 2")).toBe("mailto:anna@acme.com?subject=Hi%20%26%20bye&body=Line%201%0ALine%202");
    expect(mailtoHref(null, "", "")).toBe("mailto:");
  });
});
