import { describe, expect, it } from "vitest";
import { cleanProfile, countWords, fillSummary } from "./company-profile";

describe("cleanProfile", () => {
  it("keeps a short profile as plain paragraphs", () => {
    expect(cleanProfile("## About\n\nAcme makes **pumps**  for ships.\n\n\nIt is based in Aarhus.")).toBe(
      "About\n\nAcme makes pumps for ships.\n\nIt is based in Aarhus.",
    );
  });

  it("returns null when the website said nothing", () => {
    expect(cleanProfile("NO INFORMATION")).toBeNull();
    expect(cleanProfile("  ")).toBeNull();
  });

  it("cuts a long profile after the last full sentence within the limit", () => {
    const sentence = "Acme makes pumps for ships and offshore platforms.";
    const long = Array.from({ length: 50 }, () => sentence).join(" ");
    const result = cleanProfile(long)!;
    expect(countWords(result)).toBeLessThanOrEqual(300);
    expect(countWords(result)).toBeGreaterThan(280);
    expect(result.endsWith(".")).toBe(true);
  });

  it("cuts at the word limit when there is no sentence end to step back to", () => {
    const result = cleanProfile(Array.from({ length: 400 }, (_, i) => `word${i}`).join(" "), 300)!;
    expect(countWords(result)).toBe(300);
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
