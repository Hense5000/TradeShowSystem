import { describe, expect, it } from "vitest";
import { centerKey, parseCenterRows } from "./centers";
import { findCountryCode } from "./countries";

describe("findCountryCode", () => {
  it("accepts codes, English names and common short names", () => {
    expect(findCountryCode("de")).toBe("DE");
    expect(findCountryCode("Germany")).toBe("DE");
    expect(findCountryCode("united arab emirates")).toBe("AE");
    expect(findCountryCode("UK")).toBe("GB");
    expect(findCountryCode("Atlantis")).toBeNull();
    expect(findCountryCode(" ")).toBeNull();
  });
});

describe("parseCenterRows", () => {
  it("maps Base44-style headers and cleans up the values", () => {
    const result = parseCenterRows([
      ["Center Name", "Location", "Country", "Official Website", "Events URL"],
      ["Messe Berlin", "Berlin", "Germany", "messe-berlin.de", "https://messe-berlin.de/events/"],
      ["Bella Center", "Copenhagen", "DK", "", ""],
    ]);
    expect(result.error).toBeUndefined();
    expect(result.problems).toEqual([]);
    expect(result.items).toEqual([
      {
        name: "Messe Berlin",
        city: "Berlin",
        country: "DE",
        website: "https://messe-berlin.de",
        eventsUrl: "https://messe-berlin.de/events",
      },
      { name: "Bella Center", city: "Copenhagen", country: "DK", website: null, eventsUrl: null },
    ]);
  });

  it("explains rows it cannot use", () => {
    const result = parseCenterRows([
      ["Name", "City", "Country", "Website"],
      ["", "Paris", "FR", ""],
      ["Fira", "Barcelona", "Catalonia", ""],
      ["fira", "barcelona", "ES", ""],
      ["Expo", "Oslo", "NO", "not a url"],
    ]);
    expect(result.items).toEqual([{ name: "Fira", city: "Barcelona", country: null, website: null, eventsUrl: null }]);
    expect(result.problems).toHaveLength(4);
    expect(result.problems[0]).toMatch(/^Row 2: /);
    expect(result.problems[1]).toMatch(/Row 3: unknown country "Catalonia"/);
    expect(result.problems[2]).toMatch(/Row 4: .*twice/);
    expect(result.problems[3]).toMatch(/^Row 5: Website/);
  });

  it("needs a name column", () => {
    expect(parseCenterRows([["City"], ["Berlin"]]).error).toMatch(/Name/);
  });
});

describe("centerKey", () => {
  it("ignores case and surrounding spaces", () => {
    expect(centerKey({ name: " Messe Berlin", city: "BERLIN" })).toBe(centerKey({ name: "messe berlin", city: "Berlin " }));
  });
});
