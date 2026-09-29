import { describe, expect, it } from "vitest";
import { isPlatformAdmin } from "./platform-admin";

describe("isPlatformAdmin", () => {
  it("matches listed emails, ignoring case and spaces", () => {
    const list = " Henrik@Example.com, ops@example.com ";
    expect(isPlatformAdmin("henrik@example.com", list)).toBe(true);
    expect(isPlatformAdmin("OPS@example.com", list)).toBe(true);
    expect(isPlatformAdmin("someone@example.com", list)).toBe(false);
  });

  it("allows no one when the list is empty", () => {
    expect(isPlatformAdmin("henrik@example.com", "")).toBe(false);
  });
});
