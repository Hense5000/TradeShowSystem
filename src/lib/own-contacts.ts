import { type HunterEmail, bestHunterGeneric, bestHunterPerson, isGenericEmail } from "@/lib/hunter";

// Contacts an account found with its own Hunter.io key (see own-contacts-run.ts).
// They are kept per company domain and only shown to that account, on top of
// the shared exhibitor details that every account sees.

export type ContactParts = { contactName: string | null; contactTitle: string | null; email: string | null; phone: string | null };

/** The account's own contact for a company, from Hunter's Domain Search: the best named person, else a general address. */
export function ownContactFromHunter(emails: HunterEmail[]): ContactParts {
  const person = bestHunterPerson(emails);
  if (person) {
    return {
      contactName: [person.first_name, person.last_name].map((p) => p?.trim()).filter(Boolean).join(" ").slice(0, 100),
      contactTitle: person.position?.trim().slice(0, 100) || null,
      email: person.value.toLowerCase(),
      phone: person.phone_number?.trim().slice(0, 30) || null,
    };
  }
  return { contactName: null, contactTitle: null, email: bestHunterGeneric(emails), phone: null };
}

export const hasContact = (c: ContactParts | null | undefined): c is ContactParts => Boolean(c && (c.contactName || c.email || c.phone));

/**
 * The exhibitor as the account sees it, with its own contact on top. A named
 * person of its own replaces the shared person, with that person's email (or
 * the shared email when it is a general one such as info@, never another
 * person's own). Without a named person, the own details only fill the empty
 * shared fields. `ownContact` tells whether anything came from the account's own.
 */
export function withOwnContact<R extends ContactParts>(row: R, own: ContactParts | null | undefined): R & { ownContact: boolean } {
  if (!hasContact(own)) return { ...row, ownContact: false };
  if (own.contactName) {
    const sharedEmail = row.email && (!row.contactName || isGenericEmail(row.email)) ? row.email : null;
    return {
      ...row,
      contactName: own.contactName,
      contactTitle: own.contactTitle,
      email: own.email ?? sharedEmail,
      phone: own.phone ?? row.phone,
      ownContact: true,
    };
  }
  const merged = { ...row, email: row.email ?? own.email, phone: row.phone ?? own.phone };
  return { ...merged, ownContact: merged.email !== row.email || merged.phone !== row.phone };
}

/** Hunter's account details with only what is shown: the plan and this month's credits. */
export type HunterAccountInfo = { email: string | null; plan: string | null; used: number | null; available: number | null; resetDate: string | null };

type HunterUsage = { used?: number; available?: number } | undefined;

/** Reads Hunter's /v2/account answer; newer plans count "credits", older ones "searches" (or "calls"). */
export function readHunterAccount(data: {
  email?: string | null;
  plan_name?: string | null;
  reset_date?: string | null;
  requests?: { credits?: HunterUsage; searches?: HunterUsage };
  calls?: HunterUsage;
}): HunterAccountInfo {
  const usage = data.requests?.credits ?? data.requests?.searches ?? data.calls;
  return {
    email: data.email ?? null,
    plan: data.plan_name ?? null,
    used: typeof usage?.used === "number" ? usage.used : null,
    available: typeof usage?.available === "number" ? usage.available : null,
    resetDate: data.reset_date ?? null,
  };
}

/** The key's last 4 characters, shown so the user can tell which key is connected. */
export const keyHint = (key: string) => `…${key.slice(-4)}`;

/** A Hunter.io API key looks like 40 hex characters; anything clearly different is turned away before Hunter is asked. */
export const looksLikeHunterKey = (key: string) => /^[A-Za-z0-9_-]{20,100}$/.test(key);
