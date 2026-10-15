import { decodeEntities } from "@/lib/show-finder";

// Pure helpers for finding an exhibitor's contact person on the company's own
// website: which pages to read, the email addresses and phone numbers linked
// on them, and checking what the AI found. The part that downloads the pages
// and calls the AI is in contact-finder-run.ts.

/** What the AI found on the website; null where the website shows nothing. */
export type FoundContact = {
  contactName: string | null;
  contactTitle: string | null;
  email: string | null;
  phone: string | null;
};

/** The contact fields of an exhibitor as they are now. */
export type ContactFields = { [K in keyof FoundContact]: string | null };

/** How many pages besides the homepage are read, e.g. "Contact", "Team" and "About us". */
export const MAX_CONTACT_PAGES = 3;

/** Each page's text is cut at this length; contact details are short. */
export const MAX_CONTACT_PAGE_CHARS = 15_000;

// Words in a link's address or text that point to a page with people or contact details.
const CONTACT_WORDS =
  /contact|kontakt|contatt|contacto|team|people|staff|management|leadership|ledelse|medarbejder|mitarbeiter|ansprech|about|om-os|om os|uber-uns|über uns|ueber-uns|impressum|imprint|sales|salg|vertrieb/i;

// Contact pages first: they most often name the person to write to.
function rank(text: string): number {
  if (/contact|kontakt|contatt|contacto|ansprech/i.test(text)) return 0;
  if (/team|people|staff|management|leadership|ledelse|medarbejder|mitarbeiter|sales|salg|vertrieb/i.test(text)) return 1;
  if (/impressum|imprint/i.test(text)) return 2;
  return 3;
}

const sameSite = (a: URL, b: URL) => a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");

/** Links on the homepage to pages on the same website that likely list people or contact details. */
export function contactPageLinks(html: string, pageUrl: string, max = MAX_CONTACT_PAGES): string[] {
  const home = new URL(pageUrl);
  const found = new Map<string, number>();
  for (const [, href, inner] of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    let url: URL;
    try {
      url = new URL(decodeEntities(href), pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || !sameSite(url, home)) continue;
    if (/\.(pdf|jpe?g|png|gif|zip|docx?)$/i.test(url.pathname)) continue;
    const words = `${decodeURIComponent(url.pathname)} ${label}`;
    if (!CONTACT_WORDS.test(words)) continue;
    url.hash = "";
    const key = url.toString();
    if (key === home.toString() || url.pathname === home.pathname) continue;
    found.set(key, Math.min(found.get(key) ?? 9, rank(words)));
  }
  return [...found.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, max)
    .map(([url]) => url);
}

/** Decodes an email address hidden by Cloudflare's email protection (a hex string, the first byte being the key). */
export function decodeCloudflareEmail(hex: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2) return null;
  const key = Number.parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out.includes("@") ? out : null;
}

/**
 * Email addresses and phone numbers that a page only shows as links (such as
 * "Write to us"), which are lost when the page is turned into text.
 */
export function linkedContacts(html: string): string[] {
  const out = new Set<string>();
  for (const [, kind, value] of html.matchAll(/href\s*=\s*["'](mailto|tel):([^"'?]+)/gi)) {
    const v = decodeEntities(decodeURIComponentSafe(value)).trim();
    if (v) out.add(kind.toLowerCase() === "mailto" ? v.toLowerCase() : v);
  }
  for (const [, hex] of html.matchAll(/(?:data-cfemail\s*=\s*["']|email-protection#)([0-9a-f]+)/gi)) {
    const email = decodeCloudflareEmail(hex);
    if (email) out.add(email.toLowerCase());
  }
  return [...out];
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const EMAIL = /^[^\s@<>()[\],;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const PHONE = /^\+?[\d\s().-]{5,}$/;

/** Makes text compare loosely: lower case, single spaces. */
const loose = (text: string) => text.toLowerCase().replace(/\s+/g, " ");

/**
 * Tidies what the AI found and drops anything that is not on the website:
 * the name and the email address must be written in the text it read, so an
 * invented person or a guessed address such as firstname@company.com never
 * gets saved. Returns null when nothing is left.
 */
export function cleanContact(found: FoundContact, sourceText: string): FoundContact | null {
  const source = loose(sourceText);
  const text = (value: string | null, max: number) => {
    const v = value?.replace(/\s+/g, " ").trim();
    return v && v.length <= max ? v : null;
  };

  let contactName = text(found.contactName, 100);
  if (contactName && !source.includes(loose(contactName))) contactName = null;
  const contactTitle = contactName ? text(found.contactTitle, 100) : null;

  let email = text(found.email, 254)?.replace(/^mailto:/i, "").toLowerCase() ?? null;
  if (email && (!EMAIL.test(email) || !source.includes(email))) email = null;

  let phone = text(found.phone, 30);
  if (phone && (!PHONE.test(phone) || phone.replace(/\D/g, "").length < 6)) phone = null;

  return contactName || email || phone ? { contactName, contactTitle, email, phone } : null;
}

/**
 * The fields to save: only those that are still empty, so nothing typed in by
 * hand or imported is overwritten. The position is only filled together with
 * the name, so it never ends up next to a different person's name.
 */
export function contactUpdate(current: ContactFields, found: FoundContact): Partial<FoundContact> {
  const data: Partial<FoundContact> = {};
  if (!current.contactName && found.contactName) {
    data.contactName = found.contactName;
    if (!current.contactTitle && found.contactTitle) data.contactTitle = found.contactTitle;
  }
  if (!current.email && found.email) data.email = found.email;
  if (!current.phone && found.phone) data.phone = found.phone;
  return data;
}

export type ContactFillResult = {
  /** Exhibitors that got at least one field filled. */
  filled: number;
  /** Websites that listed nothing new. */
  noInfo: number;
  failed: number;
  left: number;
  /** Why the run stopped early, e.g. an invalid AI key. */
  stoppedBy?: string;
};

/** A short sentence on what a run did, for the page. */
export function contactSummary(r: ContactFillResult): string {
  const parts = [`AI found contact details for ${r.filled} ${r.filled === 1 ? "exhibitor" : "exhibitors"}.`];
  if (r.noInfo) parts.push(`${r.noInfo} ${r.noInfo === 1 ? "website" : "websites"} listed no contact person or email.`);
  if (r.failed) parts.push(`${r.failed} ${r.failed === 1 ? "website" : "websites"} could not be read.`);
  if (r.stoppedBy) parts.push(`Stopped: ${r.stoppedBy}`);
  if (r.left) parts.push(`${r.left} still to look up; this happens automatically during the night, or press "Find missing contacts" on the Exhibitors list.`);
  return parts.join(" ");
}
