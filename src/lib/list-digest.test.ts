import { describe, expect, it } from "vitest";
import { changedFields, digestEmail, exhibitorSnapshot } from "./list-digest";

const base = exhibitorSnapshot({
  name: "Acme",
  contactName: null,
  contactTitle: null,
  email: null,
  phone: "+45 1234",
  website: null,
  country: "DK",
  industry: null,
  boothNumber: null,
  standLocationUrl: null,
  companyProfile: null,
});

describe("list email", () => {
  it("finds new, changed and removed details", () => {
    const now = { ...base, email: "a@acme.dk", phone: null, country: "DE" };
    expect(changedFields(base, now)).toEqual([
      { label: "Email", value: "a@acme.dk" },
      { label: "Phone", value: null },
      { label: "Country", value: "Germany" },
    ]);
    expect(changedFields(base, base)).toEqual([]);
    // A detail missing from an old snapshot counts as empty, not as changed.
    expect(changedFields({ name: "Acme", phone: "+45 1234", country: "DK" }, base)).toEqual([]);
  });

  it("writes one email with what was added and what changed", () => {
    const mail = digestEmail({
      accountName: "Bolt & Co",
      listsUrl: "https://x.test/a/bolt/lists",
      entries: [
        { exhibitor: "Acme", tradeShow: "Medica 2026", lists: ["Leads"], addedBy: "Anna", changes: [] },
        { exhibitor: "<Beta>", tradeShow: "Medica 2026", lists: ["Favorites", "Leads"], changes: [{ label: "Email", value: "b@beta.dk" }, { label: "Phone", value: null }] },
      ],
    });
    expect(mail.subject).toBe("Bolt & Co: 1 new exhibitor, 1 updated on your saved lists");
    expect(mail.text).toContain("Added to Leads by Anna");
    expect(mail.text).toContain("<Beta> (Medica 2026) · Favorites, Leads");
    expect(mail.text).toContain("Phone: removed");
    expect(mail.html).toContain("&lt;Beta&gt;");
    expect(mail.html).toContain("Bolt &amp; Co");
    expect(mail.html).not.toContain("<Beta>");
  });
});
