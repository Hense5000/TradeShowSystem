import { describe, expect, it } from "vitest";
import { answerText, organizerSummary, parseOrganizerAnswer } from "@/lib/organizer-finder";

describe("parseOrganizerAnswer", () => {
  it("reads the last lines", () => {
    const text = "The show is run by Messe Frankfurt.\n\nORGANIZER: Messe Frankfurt GmbH\nWEBSITE: https://www.messefrankfurt.com/\n**COUNTRY:** Germany";
    expect(parseOrganizerAnswer(text)).toEqual({ name: "Messe Frankfurt GmbH", website: "https://www.messefrankfurt.com/", country: "DE" });
  });

  it("treats NONE as nothing found", () => {
    expect(parseOrganizerAnswer("ORGANIZER: NONE\nWEBSITE: NONE\nCOUNTRY: NONE")).toEqual({ name: null, website: null, country: null });
    expect(answerText("No answer here", "ORGANIZER")).toBeNull();
  });
});

describe("organizerSummary", () => {
  it("mentions what is left", () => {
    expect(organizerSummary({ filled: 3, notFound: 1, failed: 0, left: 2 })).toBe(
      "AI found the organizer of 3 trade shows. For 1 show AI could not find one; add those by hand. 2 still to look up; press the button again to go on.",
    );
  });
});
