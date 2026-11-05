import { describe, expect, it } from "vitest";
import { signupNotifyEmail, signupNotifyEmailContent } from "./signup-notify";

describe("signupNotifyEmail", () => {
  it("uses SIGNUP_NOTIFY_EMAIL when set, else Henrik's address", () => {
    expect(signupNotifyEmail(" sales@example.com ")).toBe("sales@example.com");
    expect(signupNotifyEmail("")).toBe("hn@vivolead.com");
    expect(signupNotifyEmail(undefined)).toBe("hn@vivolead.com");
  });
});

describe("signupNotifyEmailContent", () => {
  it("names the person, company and email, escaped in HTML", () => {
    const mail = signupNotifyEmailContent({ name: "Anna <Hansen>", email: "anna@acme.dk", companyName: "Acme & Co" });
    expect(mail.subject).toBe("New customer: Acme & Co");
    expect(mail.text).toContain("Name: Anna <Hansen>");
    expect(mail.text).toContain("Company: Acme & Co");
    expect(mail.text).toContain("Email: anna@acme.dk");
    expect(mail.html).toContain("Anna &lt;Hansen&gt;");
    expect(mail.html).toContain("Acme &amp; Co");
    expect(mail.html).toContain("mailto:anna@acme.dk");
  });
});
