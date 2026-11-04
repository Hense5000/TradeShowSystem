import { describe, expect, it } from "vitest";
import type { HunterEmail } from "./hunter";
import { looksLikeHunterKey, ownContactFromHunter, readHunterAccount, withOwnContact } from "./own-contacts";

const email = (e: Partial<HunterEmail> & { value: string }): HunterEmail => ({
  type: "personal",
  confidence: 95,
  first_name: null,
  last_name: null,
  position: null,
  department: null,
  seniority: null,
  phone_number: null,
  ...e,
});

const empty = { contactName: null, contactTitle: null, email: null, phone: null };

describe("ownContactFromHunter", () => {
  it("takes the best named person", () => {
    const c = ownContactFromHunter([
      email({ value: "it@acme.com", first_name: "Ib", last_name: "It", department: "it" }),
      email({ value: "anna@acme.com", first_name: "Anna", last_name: "Berg", position: "Sales Manager", department: "sales", phone_number: "+45 11 22 33 44" }),
    ]);
    expect(c).toEqual({ contactName: "Anna Berg", contactTitle: "Sales Manager", email: "anna@acme.com", phone: "+45 11 22 33 44" });
  });

  it("falls back to a general address, or nothing", () => {
    expect(ownContactFromHunter([email({ value: "info@acme.com", type: "generic" })])).toEqual({ ...empty, email: "info@acme.com" });
    expect(ownContactFromHunter([])).toEqual(empty);
  });
});

describe("withOwnContact", () => {
  const shared = { id: "1", contactName: "Ole Shared", contactTitle: "CEO", email: "ole@acme.com", phone: "+45 99" };

  it("leaves the row alone without an own contact", () => {
    expect(withOwnContact(shared, null)).toEqual({ ...shared, ownContact: false });
    expect(withOwnContact(shared, empty)).toEqual({ ...shared, ownContact: false });
  });

  it("puts the own person on top, never with another person's email", () => {
    const own = { contactName: "Anna Berg", contactTitle: "Sales", email: null, phone: null };
    expect(withOwnContact(shared, own)).toEqual({ id: "1", contactName: "Anna Berg", contactTitle: "Sales", email: null, phone: "+45 99", ownContact: true });
    const generic = { ...shared, email: "info@acme.com" };
    expect(withOwnContact(generic, own).email).toBe("info@acme.com");
    expect(withOwnContact(generic, { ...own, email: "anna@acme.com" }).email).toBe("anna@acme.com");
  });

  it("only fills empty fields when the own contact names no one", () => {
    const own = { ...empty, email: "info@acme.com" };
    expect(withOwnContact(shared, own)).toEqual({ ...shared, ownContact: false });
    expect(withOwnContact({ ...shared, email: null }, own)).toEqual({ ...shared, email: "info@acme.com", ownContact: true });
  });
});

describe("readHunterAccount", () => {
  it("reads credits, searches or calls", () => {
    expect(readHunterAccount({ email: "a@b.com", plan_name: "Free", reset_date: "2026-12-01", requests: { searches: { used: 3, available: 25 } } })).toEqual({
      email: "a@b.com",
      plan: "Free",
      used: 3,
      available: 25,
      resetDate: "2026-12-01",
    });
    expect(readHunterAccount({ requests: { credits: { used: 1, available: 50 } } }).available).toBe(50);
    expect(readHunterAccount({ calls: { used: 2, available: 10 } }).used).toBe(2);
    expect(readHunterAccount({}).used).toBeNull();
  });
});

it("looksLikeHunterKey", () => {
  expect(looksLikeHunterKey("0123456789abcdef0123456789abcdef01234567")).toBe(true);
  expect(looksLikeHunterKey("short")).toBe(false);
  expect(looksLikeHunterKey("has spaces in it which is not a key")).toBe(false);
});
