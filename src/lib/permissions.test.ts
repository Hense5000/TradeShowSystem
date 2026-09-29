import { describe, expect, it } from "vitest";
import { canAssignRole, canManageMembers, checkRemoval, checkRoleChange, hasRole } from "./permissions";

describe("hasRole", () => {
  it("ranks owner > admin > member", () => {
    expect(hasRole("OWNER", "ADMIN")).toBe(true);
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("MEMBER", "ADMIN")).toBe(false);
  });
});

describe("member management", () => {
  it("only admins and owners manage users", () => {
    expect(canManageMembers("MEMBER")).toBe(false);
    expect(canManageMembers("ADMIN")).toBe(true);
  });

  it("admins cannot hand out the owner role", () => {
    expect(canAssignRole("ADMIN", "OWNER")).toBe(false);
    expect(canAssignRole("ADMIN", "ADMIN")).toBe(true);
    expect(canAssignRole("OWNER", "OWNER")).toBe(true);
    expect(canAssignRole("MEMBER", "MEMBER")).toBe(false);
  });
});

describe("checkRoleChange", () => {
  it("keeps at least one owner", () => {
    expect(checkRoleChange({ actor: "OWNER", target: "OWNER", next: "ADMIN", ownerCount: 1 }).ok).toBe(false);
    expect(checkRoleChange({ actor: "OWNER", target: "OWNER", next: "ADMIN", ownerCount: 2 }).ok).toBe(true);
  });

  it("stops admins from touching owners", () => {
    expect(checkRoleChange({ actor: "ADMIN", target: "OWNER", next: "MEMBER", ownerCount: 2 }).ok).toBe(false);
  });

  it("lets admins promote members to admin but not owner", () => {
    expect(checkRoleChange({ actor: "ADMIN", target: "MEMBER", next: "ADMIN", ownerCount: 1 }).ok).toBe(true);
    expect(checkRoleChange({ actor: "ADMIN", target: "MEMBER", next: "OWNER", ownerCount: 1 }).ok).toBe(false);
  });

  it("stops members from changing roles", () => {
    expect(checkRoleChange({ actor: "MEMBER", target: "MEMBER", next: "ADMIN", ownerCount: 1 }).ok).toBe(false);
  });
});

describe("checkRemoval", () => {
  it("lets anyone leave, except the last owner", () => {
    expect(checkRemoval({ actor: "MEMBER", target: "MEMBER", ownerCount: 1, isSelf: true }).ok).toBe(true);
    expect(checkRemoval({ actor: "OWNER", target: "OWNER", ownerCount: 1, isSelf: true }).ok).toBe(false);
  });

  it("stops members removing others and admins removing owners", () => {
    expect(checkRemoval({ actor: "MEMBER", target: "MEMBER", ownerCount: 1, isSelf: false }).ok).toBe(false);
    expect(checkRemoval({ actor: "ADMIN", target: "OWNER", ownerCount: 2, isSelf: false }).ok).toBe(false);
    expect(checkRemoval({ actor: "ADMIN", target: "MEMBER", ownerCount: 1, isSelf: false }).ok).toBe(true);
  });
});
