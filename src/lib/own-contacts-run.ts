import "server-only";
import { companyDomain } from "@/lib/company";
import { db } from "@/lib/db";
import { HunterStopError, hunterAccount, hunterDomainSearch } from "@/lib/hunter-run";
import { type ContactParts, hasContact, type HunterAccountInfo, ownContactFromHunter, withOwnContact } from "@/lib/own-contacts";
import { openSecret } from "@/lib/secret-box";

// A customer account's own Hunter.io connection, and the contacts its users
// find with it. Those contacts are only ever read with the account's own id,
// so no other account sees them.

/** The account's own Hunter key, or null when none is connected or it can no longer be read. */
export async function ownHunterKey(organizationId: string): Promise<string | null> {
  const connection = await db.hunterConnection.findUnique({ where: { organizationId }, select: { keyCipher: true } });
  return connection ? openSecret(connection.keyCipher) : null;
}

export const hasOwnHunter = async (organizationId: string) =>
  Boolean(await db.hunterConnection.findUnique({ where: { organizationId }, select: { organizationId: true } }));

export type HunterStatus =
  | { connected: false }
  | {
      connected: true;
      keyHint: string;
      connectedAt: Date;
      connectedBy: string | null;
      /** This month's credits from Hunter; null when Hunter could not be asked just now. */
      account: HunterAccountInfo | null;
      /** Hunter turns the key away, or it can no longer be read: connect it again. */
      broken: boolean;
    };

/** What Company profile shows about the account's Hunter connection. */
export async function hunterStatus(organizationId: string): Promise<HunterStatus> {
  const connection = await db.hunterConnection.findUnique({
    where: { organizationId },
    include: { connectedBy: { select: { name: true, email: true } } },
  });
  if (!connection) return { connected: false };
  const key = openSecret(connection.keyCipher);
  let account: HunterAccountInfo | null = null;
  let broken = !key;
  if (key) {
    try {
      account = await hunterAccount(key);
      broken = !account;
    } catch (error) {
      console.error("Hunter.io account check failed", error);
    }
  }
  return {
    connected: true,
    keyHint: connection.keyHint,
    connectedAt: connection.connectedAt,
    connectedBy: connection.connectedBy ? (connection.connectedBy.name ?? connection.connectedBy.email) : null,
    account,
    broken,
  };
}

type Row = ContactParts & { website: string | null };

/** The rows as the account sees them: with the contacts it found itself on top (see withOwnContact). */
export async function withOwnContacts<R extends Row>(organizationId: string, rows: R[]): Promise<(R & { ownContact: boolean })[]> {
  const domains = [...new Set(rows.map((r) => companyDomain(r.website)).filter((d): d is string => Boolean(d)))];
  const own = domains.length
    ? await db.ownContact.findMany({ where: { organizationId, domain: { in: domains } } })
    : [];
  const byDomain = new Map(own.map((c) => [c.domain, c]));
  return rows.map((r) => {
    const domain = companyDomain(r.website);
    return withOwnContact(r, domain ? byDomain.get(domain) : null);
  });
}

/** The domains (of these websites) the account has already asked Hunter about, so the button can say "Search again". */
export async function searchedDomains(organizationId: string, websites: (string | null)[]): Promise<Set<string>> {
  const domains = [...new Set(websites.map(companyDomain).filter((d): d is string => Boolean(d)))];
  if (!domains.length) return new Set();
  const rows = await db.ownContact.findMany({ where: { organizationId, domain: { in: domains } }, select: { domain: true } });
  return new Set(rows.map((r) => r.domain));
}

export type OwnFindResult = { contact?: ContactParts; error?: string; none?: boolean };

/**
 * Asks Hunter.io with the account's own key for the company at this website
 * and keeps what it found for the account only. Uses one of the account's
 * Hunter credits when Hunter knows addresses for the domain.
 */
export async function findOwnContact(organizationId: string, userId: string, website: string | null): Promise<OwnFindResult> {
  const domain = companyDomain(website);
  if (!domain) return { error: "This company has no website that Hunter.io can search." };
  const key = await ownHunterKey(organizationId);
  if (!key) return { error: "Your account has no working Hunter.io connection. An owner or admin can connect it on Company profile." };
  let contact: ContactParts;
  try {
    contact = ownContactFromHunter(await hunterDomainSearch(domain, key));
  } catch (error) {
    if (error instanceof HunterStopError) return { error: error.message };
    console.error(`Own Hunter.io search for ${domain} failed`, error);
    return { error: error instanceof Error && error.message.startsWith("Hunter.io") ? error.message : "Hunter.io could not be reached. Try again in a moment." };
  }
  const data = { ...contact, foundById: userId, searchedAt: new Date() };
  await db.ownContact.upsert({
    where: { organizationId_domain: { organizationId, domain } },
    create: { organizationId, domain, ...data },
    update: data,
  });
  return hasContact(contact) ? { contact } : { none: true, error: `Hunter.io knows no contact at ${domain}.` };
}
