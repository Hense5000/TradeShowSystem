import { describe, expect, it } from "vitest";
import { adNotifyEmail, adRequestEmailContent, adSlot, checkAdImage, checkAdLink, checkAdRequest } from "./dashboard-ads";

describe("adSlot", () => {
  it("accepts 1, 2 and 3 only", () => {
    expect(adSlot("1")).toBe(1);
    expect(adSlot(3)).toBe(3);
    expect(adSlot("4")).toBeNull();
    expect(adSlot("x")).toBeNull();
    expect(adSlot(null)).toBeNull();
  });
});

describe("checkAdImage", () => {
  it("allows PNG, JPG, WebP and GIF up to 2 MB", () => {
    expect(checkAdImage({ type: "image/png", size: 500_000 })).toBeNull();
    expect(checkAdImage({ type: "image/jpeg", size: 2 * 1024 * 1024 })).toBeNull();
    expect(checkAdImage({ type: "image/svg+xml", size: 1000 })).toEqual({ error: expect.stringContaining("PNG") });
    expect(checkAdImage({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toEqual({ error: expect.stringContaining("2 MB") });
  });
});

describe("checkAdLink", () => {
  it("adds https:// when missing", () => {
    expect(checkAdLink(" acme.com ")).toEqual({ url: "https://acme.com/" });
    expect(checkAdLink("http://acme.com/offer?x=1")).toEqual({ url: "http://acme.com/offer?x=1" });
  });
  it("refuses empty, non-web and broken links", () => {
    expect(checkAdLink("")).toHaveProperty("error");
    expect(checkAdLink("javascript:alert(1)")).toHaveProperty("error");
    expect(checkAdLink("not a site")).toHaveProperty("error");
  });
});

describe("adNotifyEmail", () => {
  it("uses AD_NOTIFY_EMAIL when set, else Henrik's address", () => {
    expect(adNotifyEmail(" ads@example.com ")).toBe("ads@example.com");
    expect(adNotifyEmail("")).toBe("hn@vivolead.com");
    expect(adNotifyEmail(undefined)).toBe("hn@vivolead.com");
  });
});

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("checkAdRequest", () => {
  it("needs name, company and a valid email", () => {
    expect(checkAdRequest(form({ company: "Acme", email: "a@acme.com" }))).toEqual({ error: "Enter your name." });
    expect(checkAdRequest(form({ name: "Anna", email: "a@acme.com" }))).toEqual({ error: "Enter your company." });
    expect(checkAdRequest(form({ name: "Anna", company: "Acme", email: "nope" }))).toEqual({ error: "Enter a valid email address." });
  });
  it("returns the trimmed fields and the slot", () => {
    expect(checkAdRequest(form({ name: " Anna ", company: "Acme", email: "a@acme.com", slot: "2", message: "Hi" }))).toEqual({
      name: "Anna",
      company: "Acme",
      email: "a@acme.com",
      phone: "",
      website: "",
      message: "Hi",
      slot: 2,
    });
  });
});

describe("adRequestEmailContent", () => {
  it("lists the filled fields, escaped in HTML", () => {
    const mail = adRequestEmailContent(
      { name: "Anna <Hansen>", company: "Acme & Co", email: "a@acme.com", phone: "", website: "acme.com", message: "Call me", slot: 1 },
      { name: "Buyer Ltd", userEmail: "anna@buyer.com" },
    );
    expect(mail.subject).toBe("Ad space request: Acme & Co");
    expect(mail.text).toContain("Ad space: 1 of 3");
    expect(mail.text).toContain("Sent from account: Buyer Ltd (anna@buyer.com)");
    expect(mail.text).not.toContain("Phone:");
    expect(mail.text).toContain("Message:\nCall me");
    expect(mail.html).toContain("Anna &lt;Hansen&gt;");
    expect(mail.html).toContain("Acme &amp; Co");
  });
});
