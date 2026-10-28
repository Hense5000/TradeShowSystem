import { describe, expect, it } from "vitest";
import { leadAssignedEmailContent } from "./lead-assigned";

describe("lead assigned email", () => {
  it("names who assigned which exhibitor, links to the leads and escapes names", () => {
    const email = leadAssignedEmailContent({
      assignedBy: "Ann",
      accountName: "Acme",
      exhibitor: "Bolt & <Nut>",
      tradeShow: "Medica 2026",
      url: "https://tss.ngasoft.dk/a/acme/favorites/exhibitors?owner=me",
    });
    expect(email.subject).toBe("You are now responsible for Bolt & <Nut>");
    expect(email.text).toContain("Ann has made you responsible for Bolt & <Nut> in Acme's Favorites.");
    expect(email.text).toContain("Medica 2026");
    expect(email.text).toContain("https://tss.ngasoft.dk/a/acme/favorites/exhibitors?owner=me");
    expect(email.html).toContain("Bolt &amp; &lt;Nut&gt;");
    expect(email.html).not.toContain("<Nut>");
    expect(email.html).toContain('href="https://tss.ngasoft.dk/a/acme/favorites/exhibitors?owner=me"');
  });
});
