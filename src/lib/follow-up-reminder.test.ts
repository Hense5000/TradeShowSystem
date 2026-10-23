import { describe, expect, it } from "vitest";
import { followUpReminderEmail } from "./follow-up-reminder";

describe("follow-up reminder email", () => {
  const url = "https://tss.ngasoft.dk/a/acme/favorites/exhibitors?owner=me&followup=due";

  it("names the exhibitor and the reminder in the subject when there is one", () => {
    const email = followUpReminderEmail({ accountName: "Acme", leads: [{ exhibitor: "Bolt & <Nut>", tradeShow: "Medica 2026", note: "Call again" }], url });
    expect(email.subject).toBe("Reminder today: Call again – Bolt & <Nut>");
    expect(email.text).toContain("You have a follow-up today on a lead you are responsible for in Acme's Favorites.");
    expect(email.text).toContain("Bolt & <Nut> (Medica 2026)\nReminder: Call again");
    expect(email.text).toContain(url);
    expect(email.html).toContain("Bolt &amp; &lt;Nut&gt;");
    expect(email.html).not.toContain("<Nut>");
    expect(email.html).toContain(`href="${url.replace("&", "&amp;")}"`);
  });

  it("counts several follow-ups and leaves out a missing reminder text", () => {
    const email = followUpReminderEmail({
      accountName: "Acme",
      leads: [
        { exhibitor: "Bolt", tradeShow: "Medica 2026", note: null },
        { exhibitor: "Nut", tradeShow: "Medica 2026", note: "Send offer" },
      ],
      url,
    });
    expect(email.subject).toBe("Reminder today: 2 follow-ups");
    expect(email.text).toContain("You have 2 follow-ups today");
    expect(email.text).toContain("Bolt (Medica 2026)\n\nNut (Medica 2026)\nReminder: Send offer");
  });

  it("says Follow up when the only reminder has no text", () => {
    const email = followUpReminderEmail({ accountName: "Acme", leads: [{ exhibitor: "Bolt", tradeShow: "Medica 2026", note: null }], url });
    expect(email.subject).toBe("Reminder today: Follow up – Bolt");
  });
});
