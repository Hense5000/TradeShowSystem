import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";
import { safeCallbackUrl } from "./redirect";

describe("slugify", () => {
  it("handles Danish letters and punctuation", () => {
    expect(slugify("Ærø Messe A/S")).toBe("aeroe-messe-a-s");
    expect(slugify("  Café  Åbo!! ")).toBe("cafe-aabo");
    expect(slugify("!!!")).toBe("account");
  });

  it("adds a number when the slug is taken", async () => {
    const taken = new Set(["acme", "acme-2"]);
    expect(await uniqueSlug("acme", async (s) => taken.has(s))).toBe("acme-3");
  });
});

describe("safeCallbackUrl", () => {
  it("only allows paths on this site", () => {
    expect(safeCallbackUrl("/a/acme")).toBe("/a/acme");
    expect(safeCallbackUrl("https://evil.example")).toBe("/accounts");
    expect(safeCallbackUrl("//evil.example")).toBe("/accounts");
    expect(safeCallbackUrl(null)).toBe("/accounts");
  });
});
