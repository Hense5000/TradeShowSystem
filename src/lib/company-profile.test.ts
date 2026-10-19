import { describe, expect, it } from "vitest";
import { cleanProfile, profileLine } from "./company-profile";

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
