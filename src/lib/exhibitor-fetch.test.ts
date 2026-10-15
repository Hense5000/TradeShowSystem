import { describe, expect, it } from "vitest";
import { checkFoundExhibitors, cleanWebsite, fetchSummary, morePages, pageKey, splitText } from "./exhibitor-fetch";

const blank = { website: null, email: null, phone: null, country: null, industry: null, boothNumber: null };

describe("splitText", () => {
  it("keeps short text whole", () => {
    expect(splitText("a\nb", 100)).toEqual(["a\nb"]);
  });

  it("cuts between lines, never past the size", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Exhibitor ${i}`);
    const parts = splitText(lines.join("\n"), 60);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(60);
    expect(parts.join("\n")).toBe(lines.join("\n"));
  });

  it("cuts a single very long line", () => {
    const parts = splitText("x".repeat(250), 100);
    expect(parts.map((p) => p.length)).toEqual([100, 100, 50]);
  });
});

describe("cleanWebsite", () => {
  it("adds https and drops what is not a web address", () => {
    expect(cleanWebsite("acme.com")).toBe("https://acme.com");
    expect(cleanWebsite("https://www.acme.com/")).toBe("https://www.acme.com");
    expect(cleanWebsite("mailto:a@acme.com")).toBeNull();
    expect(cleanWebsite("not a site")).toBeNull();
    expect(cleanWebsite("localhost")).toBeNull();
    expect(cleanWebsite(null)).toBeNull();
  });
});

describe("checkFoundExhibitors", () => {
  const dir = "https://www.show.example/exhibitors";

  it("tidies fields and keeps each company once", () => {
    const result = checkFoundExhibitors(
      [
        { ...blank, name: "  Acme   A/S ", website: "acme.dk", email: "Sales@Acme.dk", phone: "+45 12 34 56 78", country: "Denmark", industry: "Machinery", boothNumber: "B123" },
        { ...blank, name: "acme a/s", website: "other.dk" },
        { ...blank, name: "" },
        { ...blank, name: "Beta", email: "not an email", phone: "call us", country: "Atlantis" },
      ],
      dir,
    );
    expect(result).toEqual([
      { name: "Acme A/S", website: "https://acme.dk", email: "sales@acme.dk", phone: "+45 12 34 56 78", country: "DK", industry: "Machinery", boothNumber: "B123" },
      { ...blank, name: "Beta" },
    ]);
  });

  it("drops a website that is a page on the directory's own site", () => {
    const [e] = checkFoundExhibitors([{ ...blank, name: "Acme", website: "https://show.example/exhibitor/acme" }], dir);
    expect(e.website).toBeNull();
  });
});

describe("morePages", () => {
  const dir = "https://www.show.example/exhibitors";

  it("keeps new pages on the same site, as full addresses", () => {
    const result = morePages(
      ["?page=2", "https://show.example/exhibitors?page=3#top", "https://other.example/list", "javascript:void(0)", "?page=2", dir],
      dir,
      [dir],
    );
    expect(result).toEqual(["https://www.show.example/exhibitors?page=2", "https://show.example/exhibitors?page=3"]);
  });

  it("skips pages already known", () => {
    expect(morePages(["?page=2"], dir, ["https://www.show.example/exhibitors?page=2#x"])).toEqual([]);
  });
});

describe("pageKey", () => {
  it("drops the fragment", () => {
    expect(pageKey("https://a.example/x#y")).toBe("https://a.example/x");
  });
});

describe("fetchSummary", () => {
  it("says what was read and added", () => {
    expect(fetchSummary({ pages: 4, found: 212, added: 198, failedPages: 1, morePagesLeft: 0 })).toBe(
      "Read 4 pages of the exhibitor list. Found 212 exhibitors: 198 added, 14 already listed. 1 page could not be read.",
    );
    expect(fetchSummary({ pages: 1, found: 0, added: 0, failedPages: 0, morePagesLeft: 0 })).toBe("Read 1 page of the exhibitor list. No exhibitors were found.");
  });
});
