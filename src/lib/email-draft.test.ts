import { describe, expect, it } from "vitest";
import { mailtoHref, standardEmail } from "./email-draft";

const sender = {
  name: "Henrik Hansen",
  company: "Acme Stands",
  website: "https://acme.com/",
  offer: "We build custom exhibition stands across Europe.",
  benefits: ["Fixed prices", " ", "Delivery in 4 weeks"],
};

describe("standard email", () => {
  it("fills in the template from the profile, the exhibitor and the show", () => {
    const { subject, body } = standardEmail({ sender, exhibitor: { name: "Medtech AB", contactName: "Anna Berg" }, tradeShow: { name: "MEDICA 2026" } });
    expect(subject).toBe("Introduction: Acme Stands");
    expect(body).toBe(
      [
        "Dear Anna Berg,",
        "I came across Medtech AB as an exhibitor at MEDICA 2026, and I would like to briefly introduce Acme Stands.",
        "We build custom exhibition stands across Europe.",
        "We work with companies like yours and would be happy to tell you more about how we could support Medtech AB.",
        "• Fixed prices\n• Delivery in 4 weeks",
        "If it sounds relevant, I would be glad to send you more information or set up a short call at a time that suits you.",
        "You can read more about us at https://acme.com.",
        "Best regards,\nHenrik Hansen\nAcme Stands\nhttps://acme.com",
      ].join("\n\n"),
    );
  });

  it("leaves out lines without data", () => {
    const { body } = standardEmail({
      sender: { ...sender, website: null, offer: null, benefits: [] },
      exhibitor: { name: "Medtech AB", contactName: null },
      tradeShow: { name: "MEDICA 2026" },
    });
    expect(body.startsWith("Dear Medtech AB team,\n\n")).toBe(true);
    expect(body).not.toContain("•");
    expect(body).not.toContain("read more");
    expect(body.endsWith("Best regards,\nHenrik Hansen\nAcme Stands")).toBe(true);
  });

  it("builds a mailto link", () => {
    expect(mailtoHref("anna@acme.com", "Hi & bye", "Line 1\nLine 2")).toBe("mailto:anna@acme.com?subject=Hi%20%26%20bye&body=Line%201%0ALine%202");
    expect(mailtoHref(null, "", "")).toBe("mailto:");
  });
});
