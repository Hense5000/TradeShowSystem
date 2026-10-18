import { describe, expect, it } from "vitest";
import { companyDomain, companyKeys, normalizeCompanyName, summarizeCompany } from "./company";

describe("companyDomain", () => {
  it("keeps only the company's own domain", () => {
    expect(companyDomain("https://www.acme.com/en/products")).toBe("acme.com");
    expect(companyDomain("acme.com")).toBe("acme.com");
    expect(companyDomain("http://shop.ACME.com")).toBe("acme.com");
    expect(companyDomain("https://www.acme.co.uk")).toBe("acme.co.uk");
    expect(companyDomain("https://acme.dk/")).toBe("acme.dk");
  });

  it("ignores missing websites and pages on shared sites", () => {
    expect(companyDomain(null)).toBeNull();
    expect(companyDomain("")).toBeNull();
    expect(companyDomain("https://www.facebook.com/acme")).toBeNull();
    expect(companyDomain("https://www.linkedin.com/company/acme")).toBeNull();
    expect(companyDomain("http://192.168.1.1")).toBeNull();
    expect(companyDomain("localhost")).toBeNull();
  });
});

describe("normalizeCompanyName", () => {
  it("ignores case, accents, punctuation and legal endings", () => {
    expect(normalizeCompanyName("ACME GmbH")).toBe("acme");
    expect(normalizeCompanyName("Acme GmbH & Co. KG")).toBe("acme");
    expect(normalizeCompanyName("Acme A/S")).toBe("acme");
    expect(normalizeCompanyName("Acme ApS")).toBe("acme");
    expect(normalizeCompanyName("Acme Ltd.")).toBe("acme");
    expect(normalizeCompanyName("The Acme Company, Inc.")).toBe("acme");
    expect(normalizeCompanyName("Acme S.p.A.")).toBe("acme");
    expect(normalizeCompanyName("Café Øresund")).toBe("cafe øresund");
    expect(normalizeCompanyName("Smith & Sons")).toBe("smith and sons");
  });

  it("never removes the whole name", () => {
    expect(normalizeCompanyName("Group")).toBe("group");
    expect(normalizeCompanyName("AG")).toBe("ag");
  });
});

describe("companyKeys", () => {
  it("matches on the website domain first", () => {
    const keys = companyKeys([
      { id: "1", name: "Acme GmbH", website: "https://acme.com" },
      { id: "2", name: "ACME Europe", website: "www.acme.com/de" },
      { id: "3", name: "Acme GmbH", website: "https://acme-other.com" },
    ]);
    expect(keys.get("1")).toBe("acme.com");
    expect(keys.get("2")).toBe("acme.com");
    expect(keys.get("3")).toBe("acme-other.com");
  });

  it("lets a row without a website join the company with the same name", () => {
    const keys = companyKeys([
      { id: "1", name: "Acme GmbH", website: "https://acme.com" },
      { id: "2", name: "ACME", website: null },
    ]);
    expect(keys.get("2")).toBe("acme.com");
  });

  it("matches on the name when the name goes with no or several domains", () => {
    const keys = companyKeys([
      { id: "1", name: "Nova A/S", website: null },
      { id: "2", name: "Nova", website: "https://www.facebook.com/nova" },
      { id: "3", name: "Atlas", website: "https://atlas.de" },
      { id: "4", name: "Atlas", website: "https://atlas.fr" },
      { id: "5", name: "Atlas", website: null },
      { id: "6", name: "!!!", website: null },
    ]);
    expect(keys.get("1")).toBe("name:nova");
    expect(keys.get("2")).toBe("name:nova");
    expect(keys.get("5")).toBe("name:atlas");
    expect(keys.get("6")).toBe("id:6");
  });
});

describe("summarizeCompany", () => {
  const rows = [
    { id: "a", tradeShow: { id: "s2" }, name: "Acme", contactName: null, email: null, industry: null },
    { id: "b", tradeShow: { id: "s1" }, name: "Acme GmbH", contactName: "Jo", email: "jo@acme.com", industry: "Tools" },
    { id: "c", tradeShow: { id: "s1" }, name: "Acme", contactName: null, email: null, industry: null },
  ];

  it("shows the latest row and fills empty details from the others", () => {
    const c = summarizeCompany(rows);
    expect(c.main.id).toBe("a");
    expect(c.contact.id).toBe("b");
    expect(c.first("industry")).toBe("Tools");
    expect(c.shows.map((s) => s.id)).toEqual(["s2", "s1"]);
    expect(c.ids).toEqual(["a", "b", "c"]);
  });

  it("shows the row the filters match", () => {
    expect(summarizeCompany(rows, (r) => r.tradeShow.id === "s1").main.id).toBe("b");
  });
});
