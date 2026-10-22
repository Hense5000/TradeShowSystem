import { describe, expect, it } from "vitest";
import { changedFields, changedShowFields, digestEmail, exhibitorSnapshot, MAX_SUGGESTIONS, showSnapshot, similarExhibitors } from "./list-digest";

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
      favoritesUrl: "https://x.test/a/bolt/favorites",
      entries: [
        { exhibitor: "Acme", tradeShow: "Medica 2026", lists: ["Leads"], addedBy: "Anna", changes: [] },
        { exhibitor: "<Beta>", tradeShow: "Medica 2026", lists: ["Favorites", "Leads"], changes: [{ label: "Email", value: "b@beta.dk" }, { label: "Phone", value: null }] },
      ],
    });
    expect(mail.subject).toBe("Bolt & Co: 1 new exhibitor, 1 updated in your Favorites");
    expect(mail.text).toContain("Added to Leads by Anna");
    expect(mail.text).toContain("<Beta> (Medica 2026) · Favorites, Leads");
    expect(mail.text).toContain("Phone: removed");
    expect(mail.html).toContain("&lt;Beta&gt;");
    expect(mail.html).toContain("Bolt &amp; Co");
    expect(mail.html).not.toContain("<Beta>");
    expect(mail.text).toContain("Open your Favorites: https://x.test/a/bolt/favorites");
    expect(mail.text).not.toContain("Follow-ups due");
  });

  it("puts due follow-ups first, also when nothing else is new", () => {
    const mail = digestEmail({
      accountName: "Bolt",
      listsUrl: "https://x.test/a/bolt/lists",
      favoritesUrl: "https://x.test/a/bolt/favorites",
      entries: [],
      followUps: [
        { exhibitor: "Acme", tradeShow: "Medica 2026", due: "Overdue · Oct 15", note: "Call <Anna>" },
        { exhibitor: "Beta", tradeShow: "Medica 2026", due: "Today", note: null },
      ],
    });
    expect(mail.subject).toBe("Bolt: 2 follow-ups due in your Favorites");
    expect(mail.text).toContain("Overdue · Oct 15: Acme (Medica 2026)\n  - Call <Anna>");
    expect(mail.text).toContain("Today: Beta (Medica 2026)");
    expect(mail.text).not.toContain("What is new");
    expect(mail.html).toContain("Call &lt;Anna&gt;");
  });
});

describe("new exhibitors you may like", () => {
  const ex = (name: string, industry: string | null, country: string | null, companyKey: string | null = null) => ({ name, industry, country, companyKey });
  const starred = [ex("Dräger", "Medical devices", "DE", "draeger"), ex("Ambu", " medical devices", "DK")];

  it("finds exhibitors with the same industry or country, best match first", () => {
    const found = similarExhibitors(starred, [
      ex("Zeiss", "Optics", "DE"),
      ex("Philips", "Medical Devices", "NL"),
      ex("Coloplast", "Medical devices", "DK"),
      ex("Nestlé", "Food", "CH"),
    ]);
    expect(found.map((f) => [f.exhibitor.name, f.why])).toEqual([
      ["Coloplast", "Medical devices · Denmark"],
      ["Philips", "Medical Devices"],
      ["Zeiss", "Germany"],
    ]);
  });

  it("leaves out companies that are already starred at another show", () => {
    expect(similarExhibitors(starred, [ex("Drägerwerk", "Medical devices", "DE", "draeger")])).toEqual([]);
  });

  it("lists them in the email with a link to star them", () => {
    const suggestions = Array.from({ length: MAX_SUGGESTIONS + 2 }, (_, i) => ({
      exhibitor: `Co ${i}`,
      tradeShow: "Medica 2026",
      why: "Germany",
      url: `https://x.test/a/bolt/exhibitors?show=s&q=Co%20${i}`,
    }));
    const mail = digestEmail({ accountName: "Bolt", entries: [], suggestions, listsUrl: "https://x.test/a/bolt/lists", favoritesUrl: "https://x.test/a/bolt/favorites" });
    expect(mail.subject).toBe("Bolt: 12 new exhibitors you may like in your Favorites");
    expect(mail.text).toContain("Co 0 (Medica 2026) · Germany\n  Star it: https://x.test/a/bolt/exhibitors?show=s&q=Co%200");
    expect(mail.text).toContain("…and 2 more at your favorite trade shows.");
    expect(mail.text).not.toContain("Co 10 ");
    expect(mail.html).toContain("New exhibitors you may like");
    expect(mail.html).toContain('href="https://x.test/a/bolt/exhibitors?show=s&amp;q=Co%200"');
  });
});

describe("favorite trade show changes", () => {
  const show = {
    name: "Medica 2026",
    startDate: new Date("2026-11-16"),
    endDate: new Date("2026-11-19"),
    city: "Düsseldorf",
    country: "DE",
    website: "https://medica.de",
    exhibitorDirectoryUrl: null,
    center: { name: "Messe Düsseldorf" },
  };

  it("reports new dates, a new exhibitor list and a removed center", () => {
    const before = showSnapshot(show);
    const now = showSnapshot({ ...show, endDate: new Date("2026-11-20"), exhibitorDirectoryUrl: "https://medica.de/list", center: null });
    expect(changedShowFields(before, now)).toEqual([
      { label: "Dates", value: "Nov 16 – 20, 2026" },
      { label: "Exhibitor list", value: "https://medica.de/list" },
      { label: "Exhibition center", value: null },
    ]);
    expect(changedShowFields(before, showSnapshot(show))).toEqual([]);
  });

  it("lists the show changes and new exhibitors in the email", () => {
    const mail = digestEmail({
      accountName: "Bolt",
      entries: [],
      shows: [{ tradeShow: "Medica 2026", changes: [{ label: "City", value: "Essen" }], newExhibitors: 3, url: "https://x.test/a/bolt/exhibitors?show=s" }],
      listsUrl: "https://x.test/a/bolt/lists",
      favoritesUrl: "https://x.test/a/bolt/favorites",
    });
    expect(mail.subject).toBe("Bolt: 1 trade show changed in your Favorites");
    expect(mail.text).toContain("Medica 2026\n  - City: Essen\n  - 3 new exhibitors on the list\n  Open: https://x.test/a/bolt/exhibitors?show=s");
    expect(mail.html).toContain("Changes to your favorite trade shows");
  });
});
