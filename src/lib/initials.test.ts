import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("uses the first two words", () => expect(initials("Nordlys Expo ApS")).toBe("NE"));
  it("uses two letters of a single name", () => expect(initials("Nordlys")).toBe("NO"));
  it("falls back to the email's local part", () => expect(initials("mette.kjaer@example.com")).toBe("MK"));
  it("never returns an empty string", () => expect(initials("  ")).toBe("?"));
});
