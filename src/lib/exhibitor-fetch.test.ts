import { describe, expect, it } from "vitest";
import { bulkFetchSummary, checkFoundExhibitors, directoryCandidate, cleanWebsite, compactJson, fetchSummary, morePages, pageKey, splitText, withLoadedData } from "./exhibitor-fetch";

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

describe("compactJson", () => {
  it("drops long texts, pictures and empty values", () => {
    const body = JSON.stringify({
      items: [{ name: "Acme Ltd", website: "acme.com", logoUrl: "x.png", description: "x".repeat(400), stand: "B12", tags: [] }],
    });
    expect(JSON.parse(compactJson(body))).toEqual({ items: [{ name: "Acme Ltd", website: "acme.com", stand: "B12" }] });
  });

  it("leaves text that is not JSON as it is", () => {
    expect(compactJson("not json")).toBe("not json");
  });
});

describe("withLoadedData", () => {
  it("adds the largest data first, within the limit", () => {
    const small = JSON.stringify({ a: "s".repeat(250) });
    const big = JSON.stringify({ list: Array.from({ length: 40 }, (_, i) => ({ name: `Company ${i}` })) });
    const text = withLoadedData("Exhibitors", [small, big], 10_000);
    expect(text.startsWith("Exhibitors\n\nData the page loaded:\n")).toBe(true);
    expect(text.indexOf("Company 0")).toBeLessThan(text.indexOf("sss"));
  });

  it("keeps the text as it is when nothing was loaded", () => {
    expect(withLoadedData("Exhibitors", [])).toBe("Exhibitors");
  });
});

describe("bulkFetchSummary", () => {
  it("says what was added and what was missing", () => {
    expect(
      bulkFetchSummary({ filled: 3, added: 412, noDirectory: 2, empty: 1, failed: 1, urlsFound: 2, left: 0 }),
    ).toBe(
      "412 exhibitors added to 3 shows. AI found the exhibitor list of 2 shows and saved the address on the show. 2 shows had no exhibitor list AI could find. 1 show had no exhibitors on the list yet. 1 show failed and will be tried again next time; the list below says why.",
    );
  });

  it("says why it stopped and how many are left", () => {
    expect(bulkFetchSummary({ filled: 1, added: 1, noDirectory: 0, empty: 0, failed: 0, urlsFound: 0, left: 4, stoppedBy: "The AI key is not valid." })).toBe(
      "1 exhibitor added to 1 show. Stopped: The AI key is not valid. 4 shows still to go; press the button again to carry on.",
    );
  });
});

describe("directoryCandidate", () => {
  const seen = ["https://www.ism-cologne.com/", "https://ism.expoplatform.com/newfront/marketplace/exhibitors?x=1"];
  it("knows addresses the search returned, written another way", () => {
    expect(directoryCandidate("https://ism-cologne.com", seen)).toBe("seen");
    expect(directoryCandidate("https://ism.expoplatform.com/newfront/marketplace/exhibitors?x=1#top", seen)).toBe("seen");
  });
  it("lets a page on a website it looked at through, to be checked", () => {
    expect(directoryCandidate("https://www.ism-cologne.com/exhibitors/exhibitor-list", seen)).toBe("sameHost");
  });
  it("drops addresses on websites it never looked at", () => {
    expect(directoryCandidate("https://made-up.example/exhibitors", seen)).toBeNull();
    expect(directoryCandidate(null, seen)).toBeNull();
  });
});
