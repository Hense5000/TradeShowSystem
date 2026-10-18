import { describe, expect, it } from "vitest";
import { parseAiFilters } from "./exhibitor-ai-search";

describe("AI search answer", () => {
  it("reads the filters and drops what is not valid", () => {
    const answer = 'Here you go:\n```json\n{"country":"dk","industry":["medical","medtech"," "],"showCountry":"DE","showCity":null,"from":"2027-03-01","to":"2027-02-30","q":null}\n```';
    expect(parseAiFilters(answer, "  danske medicoudstillere på messer i Tyskland i foråret ")).toEqual({
      q: "",
      show: "",
      country: "DK",
      industry: "medical, medtech",
      showCountry: "DE",
      showCity: "",
      from: "2027-03-01",
      to: "",
      ai: "danske medicoudstillere på messer i Tyskland i foråret",
    });
  });

  it("never lets the AI pick a trade show id", () => {
    expect(parseAiFilters('{"show":"abc","showCountry":"XX"}', "x")?.show).toBe("");
    expect(parseAiFilters('{"show":"abc","showCountry":"XX"}', "x")?.showCountry).toBe("");
  });

  it("gives null without a JSON object", () => {
    expect(parseAiFilters("Sorry, I cannot help.", "x")).toBeNull();
    expect(parseAiFilters("{not json}", "x")).toBeNull();
  });
});
