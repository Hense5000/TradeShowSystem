import { describe, expect, it } from "vitest";
import { checkListName } from "./saved-lists";

describe("list names", () => {
  it("trims and tidies the name", () => {
    expect(checkListName("  Contact  in   May ", [])).toEqual({ name: "Contact in May" });
  });

  it("refuses empty, too long, Favorites and names already used", () => {
    expect(checkListName("  ", [])).toHaveProperty("error");
    expect(checkListName("x".repeat(81), [])).toHaveProperty("error");
    expect(checkListName("favorites", [])).toHaveProperty("error");
    expect(checkListName("Leads", ["leads"])).toHaveProperty("error");
    expect(checkListName(undefined, [])).toHaveProperty("error");
  });
});
