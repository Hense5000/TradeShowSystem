import type { FoundContact } from "@/lib/contact-finder";

// Pure helpers for Hunter.io's Domain Search, which lists the email addresses
// Hunter has found on the web for a company's domain, with the person's name
// and position. The part that calls Hunter is in hunter-run.ts.

/** One email address from Hunter's Domain Search, with only the fields used here. */
export type HunterEmail = {
  value: string;
  /** "personal" (a person's own address) or "generic" (info@, sales@ …). */
  type: string | null;
  /** 0–100: how sure Hunter is that the address works. */
  confidence: number | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  /** E.g. "sales", "marketing", "executive", "management", "it". */
  department: string | null;
  /** "junior", "senior" or "executive". */
  seniority: string | null;
  phone_number: string | null;
  verification?: { status: string | null } | null;
};

/** Addresses Hunter is less sure of than this are not used. */
export const MIN_HUNTER_CONFIDENCE = 70;

/** The domain Hunter searches, e.g. "acme.com" for "https://www.acme.com/en/". */
export function hunterDomain(website: string): string | null {
  try {
    const host = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.toLowerCase();
    return host.includes(".") ? host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@<>()[\],;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

const usable = (e: HunterEmail) =>
  EMAIL.test(e.value) && (e.confidence ?? 0) >= MIN_HUNTER_CONFIDENCE && e.verification?.status !== "invalid";

const fullName = (e: HunterEmail) => [e.first_name, e.last_name].map((p) => p?.trim()).filter(Boolean).join(" ");

// Sales and export people first, as on the website: then marketing, then the management.
function departmentRank(e: HunterEmail): number {
  const text = `${e.department ?? ""} ${e.position ?? ""}`.toLowerCase();
  if (/sales|export|business development|key account|vertrieb|salg/.test(text)) return 0;
  if (/marketing|communication|event/.test(text)) return 1;
  if (/executive|management|ceo|managing director|owner|founder|president|direktør|geschäftsführer/.test(text)) return 2;
  return 3;
}

const seniorityRank = (e: HunterEmail) => (e.seniority === "executive" ? 0 : e.seniority === "senior" ? 1 : 2);

/** The best named person to contact: sales first, then marketing, then the management; the surer address wins a tie. */
export function bestHunterPerson(emails: HunterEmail[]): HunterEmail | null {
  const people = emails.filter((e) => usable(e) && e.type !== "generic" && e.first_name?.trim() && e.last_name?.trim());
  people.sort(
    (a, b) => departmentRank(a) - departmentRank(b) || seniorityRank(a) - seniorityRank(b) || (b.confidence ?? 0) - (a.confidence ?? 0),
  );
  return people[0] ?? null;
}

/** The best general address (sales@, export@, info@ …), for when no person is listed. */
export function bestHunterGeneric(emails: HunterEmail[]): string | null {
  const rank = (v: string) => (/^(sales|export|salg|vertrieb)@/.test(v) ? 0 : /^(info|contact|kontakt|mail|office)@/.test(v) ? 1 : 2);
  const generic = emails.filter((e) => usable(e) && e.type === "generic").map((e) => e.value.toLowerCase());
  generic.sort((a, b) => rank(a) - rank(b));
  return generic[0] ?? null;
}

const loose = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

const GENERIC_EMAIL = /^(info|sales|export|salg|vertrieb|contact|kontakt|mail|office|hello|hej|post|service|support|marketing|admin|reception|enquiries|inquiries)@/i;

/**
 * Fills the gaps in a contact with what Hunter found. What is already there
 * wins. A person from Hunter is only added when no one is named yet and the
 * email already there (if any) is a general one or that person's own, and a
 * personal address only when it belongs to the person that is named, so an
 * email never ends up next to someone else's name.
 */
export function addHunterContact(base: FoundContact | null, emails: HunterEmail[]): FoundContact | null {
  const have: FoundContact = base ?? { contactName: null, contactTitle: null, email: null, phone: null };
  const out = { ...have };
  if (!have.contactName) {
    const known = have.email?.toLowerCase();
    const owner = known ? emails.find((e) => usable(e) && e.value.toLowerCase() === known && fullName(e)) : undefined;
    const generic = known && (GENERIC_EMAIL.test(known) || emails.some((e) => e.value.toLowerCase() === known && e.type === "generic"));
    const person = owner ?? (!known || generic ? bestHunterPerson(emails) : null);
    if (person) {
      out.contactName = fullName(person).slice(0, 100);
      out.contactTitle = person.position?.trim().slice(0, 100) || null;
      // The person's own address beats a general one.
      out.email = person.value.toLowerCase();
      out.phone = have.phone ?? (person.phone_number?.trim().slice(0, 30) || null);
    }
  } else if (!have.email) {
    const same = emails.find((e) => usable(e) && fullName(e) && loose(fullName(e)) === loose(have.contactName!));
    if (same) out.email = same.value.toLowerCase();
  }
  if (!out.email) out.email = bestHunterGeneric(emails);
  return out.contactName || out.email || out.phone ? out : null;
}
