import { describe, expect, it } from "vitest";
import { cleanContact, contactPageLinks, contactSummary, contactUpdate, decodeCloudflareEmail, linkedContacts } from "./contact-finder";

describe("contactPageLinks", () => {
  const html = `
    <a href="/">Home</a>
    <a href="/products">Products</a>
    <a href="/about-us">About us</a>
    <a href="https://www.acme.com/kontakt/">Kontakt</a>
    <a href="/en/our-team#top"><span>Our team</span></a>
    <a href="https://facebook.com/acme">Contact us on Facebook</a>
    <a href="/files/contact.pdf">Contact sheet</a>
    <a href="/impressum">Impressum</a>`;

  it("lists same-site pages with people or contact details, contact pages first", () => {
    expect(contactPageLinks(html, "https://acme.com/")).toEqual([
      "https://www.acme.com/kontakt/",
      "https://acme.com/en/our-team",
      "https://acme.com/impressum",
    ]);
  });

  it("can return more pages", () => {
    expect(contactPageLinks(html, "https://acme.com/", 5)).toContain("https://acme.com/about-us");
  });
});

describe("linkedContacts", () => {
  it("finds addresses and numbers only shown as links, including Cloudflare-hidden emails", () => {
    const hex = "42" + [..."sales@acme.com"].map((c) => (c.charCodeAt(0) ^ 0x42).toString(16).padStart(2, "0")).join("");
    expect(decodeCloudflareEmail(hex)).toBe("sales@acme.com");
    const html = `<a href="mailto:Info@Acme.com?subject=Hi">Write to us</a> <a href="tel:+4512345678">Call</a> <a href="/cdn-cgi/l/email-protection#${hex}">[email protected]</a>`;
    expect(linkedContacts(html)).toEqual(["info@acme.com", "+4512345678", "sales@acme.com"]);
  });
});

describe("cleanContact", () => {
  const source = "Sales\nJane  Doe, Head of Sales\njane.doe@acme.com\nMain office: info@acme.com";

  it("keeps details that are on the website", () => {
    expect(
      cleanContact({ contactName: " Jane Doe ", contactTitle: "Head of Sales", email: "Jane.Doe@acme.com", phone: "+45 12 34 56 78" }, source),
    ).toEqual({ contactName: "Jane Doe", contactTitle: "Head of Sales", email: "jane.doe@acme.com", phone: "+45 12 34 56 78" });
  });

  it("drops an invented person or a guessed email address", () => {
    expect(cleanContact({ contactName: "John Smith", contactTitle: "CEO", email: "john.smith@acme.com", phone: null }, source)).toBeNull();
    expect(cleanContact({ contactName: "John Smith", contactTitle: "CEO", email: "info@acme.com", phone: "n/a" }, source)).toEqual({
      contactName: null,
      contactTitle: null,
      email: "info@acme.com",
      phone: null,
    });
  });
});

describe("contactUpdate", () => {
  const found = { contactName: "Jane Doe", contactTitle: "Head of Sales", email: "jane@acme.com", phone: "+45 12 34 56 78" };
  const empty = { contactName: null, contactTitle: null, email: null, phone: null };

  it("fills only the empty fields", () => {
    expect(contactUpdate(empty, found)).toEqual(found);
    expect(contactUpdate({ ...empty, email: "info@acme.com" }, found)).toEqual({ contactName: "Jane Doe", contactTitle: "Head of Sales", phone: "+45 12 34 56 78" });
  });

  it("never puts a position next to someone else's name", () => {
    expect(contactUpdate({ ...empty, contactName: "Bob Hansen" }, found)).toEqual({ email: "jane@acme.com", phone: "+45 12 34 56 78" });
  });
});

describe("contactSummary", () => {
  it("says what was found and what is left", () => {
    expect(contactSummary({ filled: 1, noInfo: 2, failed: 0, left: 0 })).toBe(
      "AI found contact details for 1 exhibitor. 2 websites listed no contact person or email.",
    );
    expect(contactSummary({ filled: 0, noInfo: 0, failed: 1, left: 4 })).toContain("4 still to look up");
  });
});
