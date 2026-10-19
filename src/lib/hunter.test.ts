import { describe, expect, it } from "vitest";
import { addHunterContact, bestHunterGeneric, bestHunterPerson, type HunterEmail, hunterDomain, hunterUpdate } from "./hunter";

const email = (value: string, more: Partial<HunterEmail> = {}): HunterEmail => ({
  value,
  type: "personal",
  confidence: 95,
  first_name: null,
  last_name: null,
  position: null,
  department: null,
  seniority: null,
  phone_number: null,
  ...more,
});

const ceo = email("anna@acme.com", { first_name: "Anna", last_name: "Berg", position: "CEO", department: "executive", seniority: "executive" });
const sales = email("bo@acme.com", { first_name: "Bo", last_name: "Holm", position: "Export Manager", department: "sales", seniority: "senior" });
const info = email("info@acme.com", { type: "generic" });
const empty = { contactName: null, contactTitle: null, email: null, phone: null };

describe("hunterDomain", () => {
  it("takes the host without www", () => {
    expect(hunterDomain("https://www.acme.com/en/")).toBe("acme.com");
    expect(hunterDomain("acme.de")).toBe("acme.de");
    expect(hunterDomain("not a site")).toBeNull();
  });
});

describe("bestHunterPerson", () => {
  it("prefers sales over the management, and skips unsure or nameless addresses", () => {
    expect(bestHunterPerson([ceo, sales, info])).toBe(sales);
    expect(bestHunterPerson([email("x@acme.com", { first_name: "X", last_name: "Y", confidence: 40 }), info])).toBeNull();
  });
});

describe("bestHunterGeneric", () => {
  it("prefers sales@ over info@", () => {
    expect(bestHunterGeneric([info, email("sales@acme.com", { type: "generic" }), sales])).toBe("sales@acme.com");
  });
});

describe("addHunterContact", () => {
  it("adds a person when no one is named", () => {
    expect(addHunterContact(null, [ceo, sales])).toEqual({ contactName: "Bo Holm", contactTitle: "Export Manager", email: "bo@acme.com", phone: null });
  });

  it("adds a person next to a general email, keeping the phone", () => {
    expect(addHunterContact({ ...empty, email: "info@acme.com", phone: "+45 1234 5678" }, [sales])).toEqual({
      contactName: "Bo Holm",
      contactTitle: "Export Manager",
      email: "bo@acme.com",
      phone: "+45 1234 5678",
    });
  });

  it("names the owner of a personal email, and no one else", () => {
    expect(addHunterContact({ ...empty, email: "anna@acme.com" }, [ceo, sales])?.contactName).toBe("Anna Berg");
    expect(addHunterContact({ ...empty, email: "kim@acme.com" }, [ceo, sales])).toEqual({ ...empty, email: "kim@acme.com" });
  });

  it("gives a named person only their own email, else a general one", () => {
    expect(addHunterContact({ ...empty, contactName: "anna  berg" }, [sales, ceo])?.email).toBe("anna@acme.com");
    expect(addHunterContact({ ...empty, contactName: "Kim Lund" }, [sales, info])?.email).toBe("info@acme.com");
  });

  it("returns null when Hunter has nothing and nothing was there", () => {
    expect(addHunterContact(null, [])).toBeNull();
  });
});

describe("hunterUpdate", () => {
  const current = { contactName: null, contactTitle: null, email: "info@acme.com", phone: null };

  it("swaps a general address for the own email of the person Hunter adds", () => {
    const found = addHunterContact(current, [sales, info])!;
    expect(hunterUpdate(current, found)).toEqual({ contactName: "Bo Holm", contactTitle: "Export Manager", email: "bo@acme.com" });
  });

  it("keeps a personal address that is already there", () => {
    const mine = { ...current, email: "anna@acme.com" };
    expect(hunterUpdate(mine, addHunterContact(mine, [ceo, sales])!)).toEqual({ contactName: "Anna Berg", contactTitle: "CEO" });
  });

  it("does not touch the email when no person is added", () => {
    expect(hunterUpdate(current, addHunterContact(current, [info])!)).toEqual({});
  });
});
