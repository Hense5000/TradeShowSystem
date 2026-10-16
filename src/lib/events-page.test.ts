import { describe, expect, it } from "vitest";
import { answerLine, checkSearchedUrl, eventsPageSummary, normalizeUrl, parseSearchAnswer, pickFromLinks, sameSite, siteLinks } from "@/lib/events-page";

const HOME = `
<nav>
  <a href="/en/about">About us</a>
  <a href="/en/visitors/">Visitors</a>
  <a href="https://www.messe-berlin.de/en/events/calendar#top">Event calendar</a>
  <a href="/de/veranstaltungen">Veranstaltungen</a>
  <a href="https://facebook.com/messeberlin">Facebook</a>
  <a href="/files/plan.pdf">Hall plan</a>
  <a href="mailto:info@messe-berlin.de">Mail</a>
  <a href="/en/about">About</a>
</nav>`;

describe("siteLinks", () => {
  it("keeps links on the same website, events-like ones first, without duplicates", () => {
    const links = siteLinks(HOME, "https://www.messe-berlin.de/");
    expect(links.map((l) => l.url)).toEqual([
      "https://www.messe-berlin.de/en/events/calendar",
      "https://www.messe-berlin.de/de/veranstaltungen",
      "https://www.messe-berlin.de/en/about",
      "https://www.messe-berlin.de/en/visitors",
    ]);
    expect(links[0].label).toBe("Event calendar");
  });

  it("counts subdomains as the same website", () => {
    expect(sameSite("https://events.akkc.dk/x", "https://akkc.dk")).toBe(true);
    expect(sameSite("https://akkc.dk.evil.com", "https://akkc.dk")).toBe(false);
  });
});

describe("pickFromLinks", () => {
  const links = siteLinks(HOME, "https://www.messe-berlin.de/");
  it("accepts a listed link written slightly differently", () => {
    expect(pickFromLinks("https://www.messe-berlin.de/en/events/calendar/", links)).toBe("https://www.messe-berlin.de/en/events/calendar");
  });
  it("drops a link that was not on the page", () => {
    expect(pickFromLinks("https://www.messe-berlin.de/en/whats-on", links)).toBeNull();
    expect(pickFromLinks(null, links)).toBeNull();
  });
});

describe("web search answer", () => {
  it("reads the two last lines", () => {
    const text = "I found it.\n\nWEBSITE: https://www.bigsight.jp/english/\nEVENTS: <https://www.bigsight.jp/english/visitor/event/>";
    expect(parseSearchAnswer(text)).toEqual({ website: "https://www.bigsight.jp/english", eventsUrl: "https://www.bigsight.jp/english/visitor/event" });
    expect(parseSearchAnswer("WEBSITE: NONE\nEVENTS: NONE")).toEqual({ website: null, eventsUrl: null });
  });

  it("keeps only addresses the search returned, on the center's website", () => {
    const seen = ["https://www.bigsight.jp/english/visitor/event/", "https://www.eventseye.com/fairs/tokyo"];
    expect(checkSearchedUrl("https://www.bigsight.jp/english/visitor/event", seen, "https://www.bigsight.jp")).toBe("https://www.bigsight.jp/english/visitor/event");
    expect(checkSearchedUrl("https://www.bigsight.jp/made-up", seen, "https://www.bigsight.jp")).toBeNull();
    expect(checkSearchedUrl("https://www.eventseye.com/fairs/tokyo", seen, "https://www.bigsight.jp")).toBeNull();
  });
});

describe("normalizeUrl", () => {
  it("drops the hash and a trailing slash, and refuses other schemes", () => {
    expect(normalizeUrl("https://Example.com/Events/#x")).toBe("https://example.com/Events");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("eventsPageSummary", () => {
  it("says what was done and what is left", () => {
    expect(eventsPageSummary({ filled: 3, notFound: 1, failed: 0, left: 2 })).toBe(
      "AI found the events page of 3 centers. 1 center has no events page AI could find; add those by hand. 2 still to look up; press the button again to go on.",
    );
  });
});

describe("answerLine", () => {
  it("reads the DIRECTORY line of the answer", () => {
    expect(answerLine("Found it.\n**DIRECTORY:** <https://www.ism-cologne.com/exhibitors/>", "DIRECTORY")).toBe("https://www.ism-cologne.com/exhibitors");
    expect(answerLine("DIRECTORY: NONE", "DIRECTORY")).toBeNull();
    expect(answerLine("No line here", "DIRECTORY")).toBeNull();
  });
});
