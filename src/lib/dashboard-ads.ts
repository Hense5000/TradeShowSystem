// The ad spaces: 3 at the top of the dashboard (slots 1-3), and 4 at the top
// of the Trade shows page (4-7), the Exhibitors page (8-11), the Saved lists
// page (12-15), the Exhibition centers page (16-19) and the Exhibition
// organizers page (20-23). A platform admin uploads an image and a
// link per space on Super admin → Ads. An empty space shows "Your ad here"
// with the monthly price of a space on that page (adFreeText), and a "Get this ad space" button, whose form is emailed to AD_NOTIFY_EMAIL
// (Henrik's address when not set).

export const AD_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const;
export type AdSlot = (typeof AD_SLOTS)[number];

/**
 * The pages with ad spaces, each with its slots from left to right; `where` is
 * how a sentence names the page, `price` what one space there costs per month in euro.
 */
export const AD_PAGES = [
  { key: "dashboard", label: "Dashboard", where: "dashboard", price: 99, slots: [1, 2, 3] },
  { key: "tradeShows", label: "Trade shows page", where: "Trade shows page", price: 69, slots: [4, 5, 6, 7] },
  { key: "exhibitors", label: "Exhibitors page", where: "Exhibitors page", price: 69, slots: [8, 9, 10, 11] },
  { key: "savedLists", label: "Saved lists page", where: "Saved lists page", price: 69, slots: [12, 13, 14, 15] },
  { key: "centers", label: "Exhibition centers page", where: "Exhibition centers page", price: 69, slots: [16, 17, 18, 19] },
  { key: "organizers", label: "Exhibition organizers page", where: "Exhibition organizers page", price: 69, slots: [20, 21, 22, 23] },
] as const satisfies readonly { key: string; label: string; where: string; price: number; slots: readonly AdSlot[] }[];
export type AdPageKey = (typeof AD_PAGES)[number]["key"];

/** The slots of one page, left to right. */
export function adPageSlots(key: AdPageKey): readonly AdSlot[] {
  return AD_PAGES.find((p) => p.key === key)!.slots;
}

/** The page a slot is on, and its place there (1 = leftmost). */
export function adPlace(slot: AdSlot) {
  const page = AD_PAGES.find((p) => (p.slots as readonly number[]).includes(slot))!;
  return { page, position: (page.slots as readonly number[]).indexOf(slot) + 1 };
}

/** What a free space shows, with the monthly price of a space on its page: "Your ad here - €99 monthly". */
export function adFreeText(slot: AdSlot): string {
  return `Your ad here - €${adPlace(slot).page.price} monthly`;
}

/** The monthly price of a space, in the words of the request form and email: "€99 per month". */
export function adPriceText(slot: AdSlot): string {
  return `€${adPlace(slot).page.price} per month`;
}

/** What the advertiser's image must be, the same on every page (the spaces all have the shape of 1050 x 360). */
export const AD_IMAGE_TEXT = "PNG, JPG, WebP or GIF, max 2 MB. Best size: 1050 x 360 pixels";

/** The images an ad may be. SVG is left out, since it can carry scripts. */
export const AD_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const MAX_AD_IMAGE_BYTES = 2 * 1024 * 1024;

/** The slot number from a form or URL, or null when it is not one of AD_SLOTS. */
export function adSlot(value: unknown): AdSlot | null {
  const n = Number(value);
  return AD_SLOTS.find((s) => s === n) ?? null;
}

/** Where the image of an ad is served; the version makes browsers fetch a new image after an upload. */
export function adImageUrl(slot: AdSlot, updatedAt: Date): string {
  return `/api/ads/${slot}?v=${updatedAt.getTime()}`;
}

/** Checks an uploaded ad image: one of AD_IMAGE_TYPES and at most 2 MB. */
export function checkAdImage(file: { type: string; size: number }): { error: string } | null {
  if (!(AD_IMAGE_TYPES as readonly string[]).includes(file.type)) return { error: "The image must be a PNG, JPG, WebP or GIF file." };
  if (file.size > MAX_AD_IMAGE_BYTES) return { error: "The image is larger than 2 MB. Please use a smaller image." };
  return null;
}

/** The advertiser's website as a full http(s) link: "acme.com" becomes "https://acme.com". */
export function checkAdLink(value: unknown): { url: string } | { error: string } {
  let text = String(value ?? "").trim();
  if (!text) return { error: "Enter the link to the advertiser's website." };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) throw new Error();
    return { url: url.toString() };
  } catch {
    return { error: "The link is not a valid website address." };
  }
}

/** Who gets "Get this ad space" requests: AD_NOTIFY_EMAIL, or Henrik's address. */
export function adNotifyEmail(value = process.env.AD_NOTIFY_EMAIL): string {
  return (value ?? "").trim() || "hn@vivolead.com";
}

export const MAX_AD_REQUEST_MESSAGE = 2000;

export type AdRequest = { name: string; company: string; email: string; phone: string; website: string; message: string; slot: AdSlot | null };

const field = (formData: FormData, key: string, max = 200) => String(formData.get(key) ?? "").trim().slice(0, max);

/** Reads and checks the "Get this ad space" form. */
export function checkAdRequest(formData: FormData): AdRequest | { error: string } {
  const request: AdRequest = {
    name: field(formData, "name"),
    company: field(formData, "company"),
    email: field(formData, "email"),
    phone: field(formData, "phone", 50),
    website: field(formData, "website"),
    message: field(formData, "message", MAX_AD_REQUEST_MESSAGE),
    slot: adSlot(formData.get("slot")),
  };
  if (!request.name) return { error: "Enter your name." };
  if (!request.company) return { error: "Enter your company." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) return { error: "Enter a valid email address." };
  return request;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The email to the platform owner about a company that wants an ad space. */
export function adRequestEmailContent(request: AdRequest, account: { name: string; userEmail: string }) {
  const rows: [string, string][] = [
    ["Name", request.name],
    ["Company", request.company],
    ["Email", request.email],
    ["Phone", request.phone],
    ["Website", request.website],
    ["Ad space", request.slot ? `${adPlace(request.slot).page.label}, space ${adPlace(request.slot).position} of ${adPlace(request.slot).page.slots.length}` : "Any"],
    ["Price", request.slot ? adPriceText(request.slot) : ""],
    ["Sent from account", `${account.name} (${account.userEmail})`],
  ];
  const shown = rows.filter(([, v]) => v);
  const where = request.slot ? adPlace(request.slot).page.where : "dashboard";
  const intro = `${request.company} would like to advertise on the Trade Show System ${where}.`;
  return {
    subject: `Ad space request: ${request.company}`,
    text: `${intro}\n\n${shown.map(([k, v]) => `${k}: ${v}`).join("\n")}${request.message ? `\n\nMessage:\n${request.message}` : ""}`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">` +
      `<p>${escape(intro)}</p>` +
      `<table style="border-collapse:collapse">` +
      shown
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 16px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0;font-weight:bold">${
              k === "Email" ? `<a href="mailto:${escape(v)}" style="color:#287bbf">${escape(v)}</a>` : escape(v)
            }</td></tr>`,
        )
        .join("") +
      `</table>` +
      (request.message ? `<p style="margin-top:16px;color:#64748b">Message</p><p style="white-space:pre-wrap">${escape(request.message)}</p>` : "") +
      `</div>`,
  };
}

/**
 * The part of an image inside a white or transparent frame (judged from the
 * top-left pixel), so the ad fills the whole space on the dashboard. A coloured
 * edge is part of the ad's design and is kept. `data` is RGBA, 4 bytes a pixel.
 * Returns null when there is no such frame to cut.
 */
export function trimBounds(data: ArrayLike<number>, width: number, height: number, tolerance = 24) {
  const px = (x: number, y: number) => (y * width + x) * 4;
  const bg = [data[0], data[1], data[2], data[3]];
  const whiteOrClear = bg[3] < 16 || (bg[0] >= 240 && bg[1] >= 240 && bg[2] >= 240);
  if (!whiteOrClear) return null;
  const differs = (i: number) =>
    bg[3] < 16 ? data[i + 3] >= 16 : data[i + 3] < 16 || Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2])) > tolerance;
  let top = height, bottom = -1, left = width, right = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (differs(px(x, y))) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
  if (bottom < 0) return null; // one colour only
  const box = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  // A frame of a pixel or two is not worth a new image.
  return box.width >= width - 2 && box.height >= height - 2 ? null : box;
}
