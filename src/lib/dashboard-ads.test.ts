import { describe, expect, it } from "vitest";
import { adFreeText, adPriceText, adNotifyEmail, adPageSlots, adPlace, adRequestEmailContent, adSlot, checkAdImage, checkAdLink, checkAdRequest, trimBounds } from "./dashboard-ads";

describe("adSlot", () => {
  it("accepts 1 to 23 only (3 on the dashboard, 4 on each of 5 other pages)", () => {
    expect(adSlot("1")).toBe(1);
    expect(adSlot(3)).toBe(3);
    expect(adSlot("7")).toBe(7);
    expect(adSlot("11")).toBe(11);
    expect(adSlot("23")).toBe(23);
    expect(adSlot("24")).toBeNull();
    expect(adSlot(0)).toBeNull();
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
    expect(mail.text).toContain("Ad space: Dashboard, space 1 of 3");
    expect(mail.text).toContain("on the Trade Show System dashboard");
    expect(mail.text).toContain("Sent from account: Buyer Ltd (anna@buyer.com)");
    expect(mail.text).not.toContain("Phone:");
    expect(mail.text).toContain("Message:\nCall me");
    expect(mail.html).toContain("Anna &lt;Hansen&gt;");
    expect(mail.html).toContain("Acme &amp; Co");
  });
});

describe("adPlace", () => {
  it("tells the page and the place on it", () => {
    expect(adPlace(2)).toMatchObject({ page: { key: "dashboard" }, position: 2 });
    expect(adPlace(4)).toMatchObject({ page: { key: "tradeShows" }, position: 1 });
    expect(adPlace(7)).toMatchObject({ page: { key: "tradeShows" }, position: 4 });
    expect(adPlace(8)).toMatchObject({ page: { key: "exhibitors" }, position: 1 });
    expect(adPlace(11)).toMatchObject({ page: { key: "exhibitors" }, position: 4 });
  });
  it("puts the Saved lists, centers and organizers pages after the Exhibitors page", () => {
    expect(adPlace(12)).toMatchObject({ page: { key: "savedLists" }, position: 1 });
    expect(adPlace(19)).toMatchObject({ page: { key: "centers" }, position: 4 });
    expect(adPlace(20)).toMatchObject({ page: { key: "organizers" }, position: 1 });
    expect(adPageSlots("organizers")).toEqual([20, 21, 22, 23]);
  });
  it("names the Exhibition centers page in a request for one of its spaces", () => {
    const mail = adRequestEmailContent(
      { name: "Anna", company: "Acme", email: "a@acme.com", phone: "", website: "", message: "", slot: 17 },
      { name: "Buyer Ltd", userEmail: "anna@buyer.com" },
    );
    expect(mail.text).toContain("advertise on the Trade Show System Exhibition centers page");
    expect(mail.text).toContain("Ad space: Exhibition centers page, space 2 of 4");
  });
  it("names the Exhibitors page in a request for one of its spaces", () => {
    const mail = adRequestEmailContent(
      { name: "Anna", company: "Acme", email: "a@acme.com", phone: "", website: "", message: "", slot: 10 },
      { name: "Buyer Ltd", userEmail: "anna@buyer.com" },
    );
    expect(mail.text).toContain("advertise on the Trade Show System Exhibitors page");
    expect(mail.text).toContain("Ad space: Exhibitors page, space 3 of 4");
  });
  it("names the Trade shows page in a request for one of its spaces", () => {
    const mail = adRequestEmailContent(
      { name: "Anna", company: "Acme", email: "a@acme.com", phone: "", website: "", message: "", slot: 5 },
      { name: "Buyer Ltd", userEmail: "anna@buyer.com" },
    );
    expect(mail.text).toContain("advertise on the Trade Show System Trade shows page");
    expect(mail.text).toContain("Ad space: Trade shows page, space 2 of 4");
  });
});

describe("trimBounds", () => {
  // A w x h RGBA image of colour `bg` with a block of colour `fg` at x0..x1, y0..y1.
  function image(w: number, h: number, bg: number[], fg: number[], [x0, y0, x1, y1]: number[]) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) data.set(x >= x0 && x <= x1 && y >= y0 && y <= y1 ? fg : bg, (y * w + x) * 4);
    return data;
  }
  const white = [255, 255, 255, 255];
  const green = [58, 166, 128, 255];

  it("cuts a white frame around the ad", () => {
    expect(trimBounds(image(30, 12, white, green, [5, 2, 24, 9]), 30, 12)).toEqual({ x: 5, y: 2, width: 20, height: 8 });
  });
  it("cuts a transparent frame", () => {
    expect(trimBounds(image(30, 12, [0, 0, 0, 0], green, [3, 1, 26, 10]), 30, 12)).toEqual({ x: 3, y: 1, width: 24, height: 10 });
  });
  it("keeps a coloured edge, which is part of the ad", () => {
    expect(trimBounds(image(30, 12, green, white, [5, 2, 24, 9]), 30, 12)).toBeNull();
  });
  it("leaves an image without a frame alone", () => {
    expect(trimBounds(image(30, 12, green, white, [0, 0, 29, 11]), 30, 12)).toBeNull();
    expect(trimBounds(image(30, 12, white, white, [0, 0, 0, 0]), 30, 12)).toBeNull();
  });
  it("ignores a frame of a pixel or two", () => {
    expect(trimBounds(image(30, 12, white, green, [1, 1, 28, 10]), 30, 12)).toBeNull();
  });
});

describe("adFreeText", () => {
  it("shows €99 on the dashboard and €69 on the other pages", () => {
    expect(adFreeText(1)).toBe("Your ad here - €99 monthly");
    expect(adFreeText(3)).toBe("Your ad here - €99 monthly");
    expect(adFreeText(4)).toBe("Your ad here - €69 monthly");
    expect(adFreeText(23)).toBe("Your ad here - €69 monthly");
  });
});

describe("adPriceText", () => {
  it("is €99 per month on the dashboard and €69 on the other pages", () => {
    expect(adPriceText(2)).toBe("€99 per month");
    expect(adPriceText(10)).toBe("€69 per month");
  });
});
