import { describe, expect, it } from "vitest";
import { countryName, countryOptions, isCountryCode } from "./countries";
import { isProfileComplete } from "./profile";
import { contactSchema, profileSchema, website } from "./validation";

const address = { addressLine1: "Havnegade 12", postalCode: "1058", city: "København K", country: "DK" };
const contact = { name: "Mette Kjær", email: "mette@example.com" };

describe("isProfileComplete", () => {
  it("needs an address and a primary contact", () => {
    expect(isProfileComplete(address, contact)).toBe(true);
    expect(isProfileComplete(address, null)).toBe(false);
    expect(isProfileComplete({ ...address, country: null }, contact)).toBe(false);
  });
});

describe("website", () => {
  it("adds https:// when missing", () => expect(website.parse("nordlys-expo.dk")).toBe("https://nordlys-expo.dk"));
  it("keeps an existing scheme and path", () => expect(website.parse("http://example.com/about")).toBe("http://example.com/about"));
  it("turns an empty field into null", () => expect(website.parse("  ")).toBeNull());
  it("rejects text that is not a website", () => {
    expect(website.safeParse("not a website").success).toBe(false);
    expect(website.safeParse("localhost").success).toBe(false);
  });
});

describe("profileSchema", () => {
  const base = { name: "Nordlys Expo ApS", vatNumber: "", addressLine1: "", addressLine2: "", postalCode: "", city: "", region: "", country: "", website: "" };

  it("accepts a company name alone and stores empty fields as null", () => {
    const parsed = profileSchema.parse(base);
    expect(parsed.name).toBe("Nordlys Expo ApS");
    expect(parsed.country).toBeNull();
    expect(parsed.addressLine1).toBeNull();
  });
  it("normalises the country code", () => expect(profileSchema.parse({ ...base, country: "dk" }).country).toBe("DK"));
  it("rejects unknown countries and a missing name", () => {
    expect(profileSchema.safeParse({ ...base, country: "XX" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, name: " " }).success).toBe(false);
  });
});

describe("contactSchema", () => {
  it("accepts a normal contact", () => {
    expect(contactSchema.parse({ name: "Mette", email: "Mette@Example.com ", phone: "+45 31 22 45 90" })).toEqual({
      name: "Mette",
      email: "mette@example.com",
      phone: "+45 31 22 45 90",
    });
  });
  it("allows no phone but rejects nonsense", () => {
    expect(contactSchema.parse({ name: "Mette", email: "m@example.com", phone: "" }).phone).toBeNull();
    expect(contactSchema.safeParse({ name: "Mette", email: "m@example.com", phone: "call me" }).success).toBe(false);
  });
});

describe("countries", () => {
  it("knows common countries by code and name", () => {
    expect(isCountryCode("DK")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
    expect(countryName("DE")).toBe("Germany");
  });
  it("lists every country once, sorted by name", () => {
    const options = countryOptions();
    expect(new Set(options.map((o) => o.code)).size).toBe(options.length);
    expect(options[0].name.localeCompare(options[1].name)).toBeLessThan(0);
  });
});
