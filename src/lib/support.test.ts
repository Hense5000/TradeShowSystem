import { describe, expect, it } from "vitest";
import { checkMessage, checkTicket, MAX_SUPPORT_MESSAGE, supportNotifyEmail, supportNotifyEmailContent, supportReplyEmailContent } from "./support";

describe("supportNotifyEmail", () => {
  it("uses SUPPORT_NOTIFY_EMAIL when set, else Henrik's address", () => {
    expect(supportNotifyEmail(" help@example.com ")).toBe("help@example.com");
    expect(supportNotifyEmail("")).toBe("henrik1000@gmail.com");
    expect(supportNotifyEmail(undefined)).toBe("henrik1000@gmail.com");
  });
});

describe("checkTicket", () => {
  it("cleans subject and message", () => {
    expect(checkTicket("  Import   stops ", " It stops at 50%\r\nWhy? ")).toEqual({ subject: "Import stops", body: "It stops at 50%\nWhy?" });
  });

  it("needs both a subject and a message", () => {
    expect(checkTicket("", "Hi")).toEqual({ error: "Write a subject." });
    expect(checkTicket("Hi", "   ")).toEqual({ error: "Write a message." });
    expect(checkTicket(null, null)).toEqual({ error: "Write a subject." });
  });

  it("limits the length", () => {
    expect(checkTicket("x".repeat(151), "Hi")).toHaveProperty("error");
    expect(checkMessage("x".repeat(MAX_SUPPORT_MESSAGE + 1))).toHaveProperty("error");
  });
});

describe("support emails", () => {
  it("tells support about a new request with a link, escaping what the customer wrote", () => {
    const email = supportNotifyEmailContent({
      accountName: "Acme",
      author: "Ann",
      subject: "Help <now>",
      body: "<script>x</script>",
      url: "https://tss.ngasoft.dk/support/t1",
      isReply: false,
    });
    expect(email.subject).toBe("Support: Help <now> – Acme");
    expect(email.text).toContain("https://tss.ngasoft.dk/support/t1");
    expect(email.html).toContain('href="https://tss.ngasoft.dk/support/t1"');
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
  });

  it("marks a customer's reply as a reply", () => {
    const email = supportNotifyEmailContent({ accountName: "Acme", author: "Ann", subject: "Help", body: "More", url: "u", isReply: true });
    expect(email.subject).toBe("Reply: Help – Acme");
    expect(email.text).toContain("New reply from Ann (Acme)");
  });

  it("sends the customer support's answer with a link", () => {
    const email = supportReplyEmailContent({ subject: "Help", body: "Fixed", url: "https://tss.ngasoft.dk/support/t1" });
    expect(email.subject).toBe("Re: Help");
    expect(email.text).toContain("Fixed");
    expect(email.html).toContain("https://tss.ngasoft.dk/support/t1");
  });
});
