import { describe, expect, it } from "vitest";
import { findOrganizer, organizerKey, organizerNameKey, parseOrganizerRows } from "./organizers";

describe("parseOrganizerRows", () => {
  it("maps the organizer columns and cleans up the values", () => {
    const result = parseOrganizerRows([
      ["Organizer company", "Website", "Country"],
      ["Messe Düsseldorf GmbH", "messe-duesseldorf.de", "Germany"],
      ["RX Global", "", "GB"],
      ["rx global", "", ""],
      ["", "x.com", ""],
    ]);
    expect(result.items).toEqual([
      { name: "Messe Düsseldorf GmbH", website: "https://messe-duesseldorf.de", country: "DE" },
      { name: "RX Global", website: null, country: "GB" },
    ]);
    expect(result.problems).toHaveLength(2);
    expect(result.problems[0]).toMatch(/Row 4: .*twice/);
    expect(result.problems[1]).toMatch(/^Row 5: /);
  });

  it("needs a name column", () => {
    expect(parseOrganizerRows([["Website"], ["x.com"]]).error).toMatch(/Organizer company/);
  });
});

describe("organizerKey", () => {
  it("ignores case and spaces", () => {
    expect(organizerKey({ name: " RX Global " })).toBe(organizerKey({ name: "rx global" }));
  });
});

describe("findOrganizer", () => {
  const list = [{ name: "Messe Frankfurt GmbH" }, { name: "RX" }, { name: "Bella Center Copenhagen A/S" }, { name: "Messe München" }];

  it("ignores case, accents and company forms", () => {
    expect(findOrganizer("messe frankfurt", list)).toBe(list[0]);
    expect(findOrganizer("Messe Munchen GmbH", list)).toBe(list[3]);
    expect(findOrganizer("Bella Center Copenhagen", list)).toBe(list[2]);
    expect(findOrganizer("RX", list)).toBe(list[1]);
  });

  it("matches a longer form of the same name", () => {
    expect(findOrganizer("Messe Frankfurt Exhibition GmbH", list)).toBe(list[0]);
  });

  it("does not match short names inside others, or unknown names", () => {
    expect(findOrganizer("RX Global", list)).toBeUndefined();
    expect(findOrganizer("Messe Berlin", list)).toBeUndefined();
    expect(findOrganizer("GmbH", list)).toBeUndefined();
  });
});

describe("organizerNameKey", () => {
  it("drops company forms and punctuation", () => {
    expect(organizerNameKey("Messe Düsseldorf GmbH")).toBe("messedusseldorf");
    expect(organizerNameKey("Bella Center A/S")).toBe("bellacenter");
  });
});
