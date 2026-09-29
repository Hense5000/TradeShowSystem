import type { Role } from "@prisma/client";

// Pure rules for who may do what inside an account. Kept free of database
// access so they are easy to test.

const RANK: Record<Role, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 };

export const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export function hasRole(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required];
}

export function canManageMembers(role: Role): boolean {
  return hasRole(role, "ADMIN");
}

/** Owners may hand out any role; admins may hand out admin or member. */
export function canAssignRole(actor: Role, role: Role): boolean {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return role !== "OWNER";
  return false;
}

type Result = { ok: true } | { ok: false; error: string };

export function checkRoleChange(input: {
  actor: Role;
  target: Role;
  next: Role;
  ownerCount: number;
}): Result {
  const { actor, target, next, ownerCount } = input;
  if (!canManageMembers(actor)) return { ok: false, error: "You cannot manage users in this account." };
  if (target === "OWNER" && actor !== "OWNER") return { ok: false, error: "Only an owner can change another owner." };
  if (!canAssignRole(actor, next)) return { ok: false, error: "You cannot assign that role." };
  if (target === "OWNER" && next !== "OWNER" && ownerCount <= 1)
    return { ok: false, error: "An account must always have at least one owner." };
  return { ok: true };
}

export function checkRemoval(input: {
  actor: Role;
  target: Role;
  ownerCount: number;
  isSelf: boolean;
}): Result {
  const { actor, target, ownerCount, isSelf } = input;
  if (target === "OWNER" && ownerCount <= 1)
    return { ok: false, error: "An account must always have at least one owner." };
  if (isSelf) return { ok: true }; // anyone may leave
  if (!canManageMembers(actor)) return { ok: false, error: "You cannot manage users in this account." };
  if (target === "OWNER" && actor !== "OWNER") return { ok: false, error: "Only an owner can remove another owner." };
  return { ok: true };
}
