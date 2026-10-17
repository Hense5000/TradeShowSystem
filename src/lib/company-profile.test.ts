import { describe, expect, it } from "vitest";
import { cleanProfile, fillSummary, profileLine, profileRunSummary } from "./company-profile";

describe("cleanProfile", () => {
  it("makes a short profile one plain paragraph", () => {
    expect(cleanProfile("## About\n\nAcme makes **pumps**  for ships.\n\n\nIt is based in Aarhus.")).toBe(
      "About Acme makes pumps for ships. It is based in Aarhus.",
    );
  });

  it("returns null when the website said nothing", () => {
    expect(cleanProfile("NO INFORMATION")).toBeNull();
    expect(cleanProfile("  ")).toBeNull();
  });

  it("cuts a long profile after the last full sentence within 300 characters", () => {
    const sentence = "Acme makes pumps for ships and offshore platforms.";
    const result = cleanProfile(Array.from({ length: 20 }, () => sentence).join(" "))!;
    expect(result.length).toBeLessThanOrEqual(300);
    expect(result.length).toBeGreaterThan(240);
    expect(result.endsWith(".")).toBe(true);
  });

  it("cuts after a whole word with … when there is no sentence end to step back to", () => {
    const result = cleanProfile(Array.from({ length: 100 }, (_, i) => `word${i}`).join(" "))!;
    expect(result.length).toBeLessThanOrEqual(300);
    expect(result).toMatch(/word\d+…$/);
  });
});

describe("profileLine", () => {
  it("reads the profile from the search answer", () => {
    expect(profileLine("I searched.\nWEBSITE: https://acme.dk\nPROFILE: Acme makes pumps for ships in Aarhus.")).toBe(
      "Acme makes pumps for ships in Aarhus.",
    );
    expect(profileLine("WEBSITE: NONE\nPROFILE: NO INFORMATION")).toBeNull();
    expect(profileLine("nothing here")).toBeNull();
  });
});

describe("profileRunSummary", () => {
  it("says what was written and what is left", () => {
    expect(profileRunSummary({ written: 2, noInfo: 1, failed: 0, websitesFound: 1 }, 0)).toBe(
      "AI wrote 2 company profiles. 1 exhibitor also got a website. For 1 company AI found nothing about what they do.",
    );
    expect(profileRunSummary({ written: 0, noInfo: 0, failed: 1, websitesFound: 0 }, 3)).toContain("3 still without a profile");
  });
});

describe("fillSummary", () => {
  it("says what was written and what is left", () => {
    expect(fillSummary({ written: 1, noInfo: 2, failed: 0, left: 0 })).toBe(
      "AI wrote 1 company profile. 2 websites did not say what the company does.",
    );
    expect(fillSummary({ written: 3, noInfo: 0, failed: 1, left: 5 })).toContain("5 still to write");
  });
});
