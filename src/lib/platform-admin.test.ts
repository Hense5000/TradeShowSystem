import { describe, expect, it } from "vitest";
import { canEditExhibitor, isPlatformAdmin } from "./platform-admin";

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

describe("canEditExhibitor", () => {
  const admins = "henrik@example.com";

  it("lets platform admins edit every exhibitor", () => {
    expect(canEditExhibitor("henrik@example.com", "org1", { addedByOrganizationId: null }, admins)).toBe(true);
    expect(canEditExhibitor("henrik@example.com", "org1", { addedByOrganizationId: "org2" }, admins)).toBe(true);
  });

  it("lets a customer edit only what its own account added", () => {
    expect(canEditExhibitor("kunde@example.com", "org1", { addedByOrganizationId: "org1" }, admins)).toBe(true);
    expect(canEditExhibitor("kunde@example.com", "org1", { addedByOrganizationId: "org2" }, admins)).toBe(false);
    expect(canEditExhibitor("kunde@example.com", "org1", { addedByOrganizationId: null }, admins)).toBe(false);
  });
});
