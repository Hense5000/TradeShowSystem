import { describe, expect, it } from "vitest";
import { organizerKey, parseOrganizerRows } from "./organizers";

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
