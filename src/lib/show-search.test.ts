import { describe, expect, it } from "vitest";
import { filterByLabel } from "./show-search";

const shows = [
  { id: "1", label: "CPHI Milan (6–8 Oct 2026)" },
  { id: "2", label: "Formland Herning (2–4 Feb 2027)" },
  { id: "3", label: "Messe Düsseldorf Medica (16–19 Nov 2026)" },
];
const ids = (search: string) => filterByLabel(shows, search).map((s) => s.id);

describe("filterByLabel", () => {
  it("keeps everything for an empty search", () => {
    expect(ids("  ")).toEqual(["1", "2", "3"]);
  });
  it("ignores case and accents", () => {
    expect(ids("formland")).toEqual(["2"]);
    expect(ids("dusseldorf")).toEqual(["3"]);
  });
  it("needs every word, in any order", () => {
    expect(ids("2026 milan")).toEqual(["1"]);
    expect(ids("2026")).toEqual(["1", "3"]);
    expect(ids("milan 2027")).toEqual([]);
  });
});
