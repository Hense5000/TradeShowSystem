"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { SaveState } from "@/components/save-form";
import type { FillResult, ProfileRunResult } from "@/lib/company-profile";
import {
  describeProfileError,
  emptyProfileWhere,
  fillMissingProfiles,
  isCompanyProfileConfigured,
  missingProfileWhere,
  writeCompanyProfile,
  writeProfiles,
} from "@/lib/company-profile-run";
import { type ContactFields, type ContactFillResult, contactSummary, contactUpdate, type FoundContact } from "@/lib/contact-finder";
import { describeContactError, fillMissingContacts, findContact, isContactFinderConfigured, missingContactWhere, needsHunter, withHunter } from "@/lib/contact-finder-run";
import { hunterDomain, hunterUpdate } from "@/lib/hunter";
import { isHunterConfigured } from "@/lib/hunter-run";
import { db } from "@/lib/db";
import { MAX_QUESTION } from "@/lib/exhibitor-ai-search";
import { askAiForFilters } from "@/lib/exhibitor-ai-search-run";
import { exhibitorQuery } from "@/lib/exhibitor-list";
import { exhibitorKey, IMPORT_ROWS_PER_CALL, parseExhibitorRows } from "@/lib/exhibitors";
import { fillCountriesFromPhones } from "@/lib/phone-country-run";
import { withPhoneCountry } from "@/lib/phone-country";
import { canEditExhibitor } from "@/lib/platform-admin";
import { requireMembership, requirePlatformAdmin } from "@/lib/tenant";
import { exhibitorSchema, firstError, website } from "@/lib/validation";

/** How long an import or a contact lookup press spends on AI profiles; the page may run for 300 seconds. */
const PROFILE_BUDGET_MS = 150_000;

const showExists = async (id: string) => Boolean(await db.tradeShow.findUnique({ where: { id }, select: { id: true } }));

/** The id of another exhibitor with the same company name at the same show, if there is one. */
async function findDuplicate(tradeShowId: string, name: string, exceptId?: string) {
  const match = await db.exhibitor.findFirst({
    where: { id: exceptId ? { not: exceptId } : undefined, tradeShowId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  return match?.id;
}

/** The exhibitor if this user may edit or delete it, else null (see canEditExhibitor). */
async function editableExhibitor(slug: string, id: string) {
  const { user, organization } = await requireMembership(slug);
  const exhibitor = await db.exhibitor.findUnique({ where: { id }, select: { id: true, addedByOrganizationId: true } });
  return exhibitor && canEditExhibitor(user.email, organization.id, exhibitor) ? exhibitor : null;
}

/** Every member may add an exhibitor; their account may then edit and delete it. */
export async function createExhibitor(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  const { organization } = await requireMembership(slug);
  const parsed = exhibitorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await showExists(parsed.data.tradeShowId))) return { error: "Choose the trade show." };
  if (await findDuplicate(parsed.data.tradeShowId, parsed.data.name)) {
    return { error: `${parsed.data.name} is already an exhibitor at that trade show.` };
  }

  await db.exhibitor.create({ data: { ...withPhoneCountry(parsed.data), addedByOrganizationId: organization.id } });
  revalidatePath(`/a/${slug}/exhibitors`);
  redirect(`/a/${slug}/exhibitors?show=${parsed.data.tradeShowId}`);
}

export async function updateExhibitor(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  if (!(await editableExhibitor(slug, id))) return { error: "This exhibitor no longer exists, or your account did not add it." };
  const parsed = exhibitorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await showExists(parsed.data.tradeShowId))) return { error: "Choose the trade show." };
  if (await findDuplicate(parsed.data.tradeShowId, parsed.data.name, id)) {
    return { error: `Another ${parsed.data.name} is already an exhibitor at that trade show.` };
  }

  // An empty profile or contact may be looked up by AI again, e.g. after the website was corrected.
  const retry = {
    ...(!parsed.data.companyProfile && { profileTriedAt: null }),
    ...(!parsed.data.contactName && !parsed.data.email && { contactTriedAt: null, hunterTriedAt: null }),
  };
  // companyKey is worked out again, since the name or website may have changed.
  const { count } = await db.exhibitor.updateMany({ where: { id }, data: { ...withPhoneCountry(parsed.data), ...retry, companyKey: null } });
  if (count === 0) return { error: "This exhibitor no longer exists." };
  revalidatePath(`/a/${slug}/exhibitors`);
  return { saved: true };
}

export async function deleteExhibitor(slug: string, id: string): Promise<ActionState> {
  if (!(await editableExhibitor(slug, id))) return { error: "This exhibitor no longer exists, or your account did not add it." };
  await db.exhibitor.deleteMany({ where: { id } });
  revalidatePath(`/a/${slug}/exhibitors`);
  redirect(`/a/${slug}/exhibitors`);
}

export type RowsResult = { error?: string; imported: number; alreadyThere: number; problems: string[] };

const isRow = (row: unknown): row is string[] => Array.isArray(row) && row.every((c) => typeof c === "string");

/**
 * Saves one part of an imported CSV file: the header row plus up to
 * IMPORT_ROWS_PER_CALL data rows. Companies already listed at the show are
 * skipped, so importing the same file twice does not create copies.
 */
export async function importExhibitorRows(
  slug: string,
  tradeShowId: string,
  header: string[],
  rows: string[][],
  firstRowNo: number,
): Promise<RowsResult> {
  await requirePlatformAdmin(slug);
  const none = { imported: 0, alreadyThere: 0, problems: [] };
  if (!isRow(header) || !Array.isArray(rows) || !rows.every(isRow) || rows.length > IMPORT_ROWS_PER_CALL) {
    return { ...none, error: "The file could not be read." };
  }
  if (!tradeShowId || !(await showExists(tradeShowId))) return { ...none, error: "Choose the trade show these exhibitors are at." };

  const { items, problems, error } = parseExhibitorRows([header, ...rows], Number.isInteger(firstRowNo) ? firstRowNo : 2);
  if (error) return { ...none, error };

  const existing = await db.exhibitor.findMany({ where: { tradeShowId }, select: { name: true } });
  const known = new Set(existing.map(exhibitorKey));
  const fresh = items.filter((e) => !known.has(exhibitorKey(e)));
  if (fresh.length > 0) await db.exhibitor.createMany({ data: fresh.map((e) => ({ ...withPhoneCountry(e), tradeShowId })) });
  revalidatePath(`/a/${slug}/exhibitors`);
  return { imported: fresh.length, alreadyThere: items.length - fresh.length, problems };
}

/** How many exhibitors at the show still wait for an AI company profile. */
export async function countMissingProfiles(slug: string, tradeShowId: string): Promise<number> {
  await requirePlatformAdmin(slug);
  if (!isCompanyProfileConfigured()) return 0;
  return db.exhibitor.count({ where: missingProfileWhere(tradeShowId) });
}

/** How many profiles one call of writeProfileBatch writes, side by side; a few at a time keeps the progress bar moving. */
const PROFILES_PER_CALL = 5;

/** Writes a few of the show's missing company profiles, for the import page's progress bar. */
export async function writeProfileBatch(slug: string, tradeShowId: string): Promise<FillResult> {
  await requirePlatformAdmin(slug);
  const result = await fillMissingProfiles({ tradeShowId, budgetMs: PROFILE_BUDGET_MS, limit: PROFILES_PER_CALL });
  revalidatePath(`/a/${slug}/exhibitors`);
  return result;
}

export type ProfileState = { profile?: string; error?: string };

/** Writes a company profile with AI from the website typed in the form. Nothing is saved until the form is. */
export async function generateExhibitorProfile(slug: string, name: string, site: string): Promise<ProfileState> {
  await requirePlatformAdmin(slug);
  if (!isCompanyProfileConfigured()) return { error: "Add ANTHROPIC_API_KEY in Vercel before AI can write profiles." };
  const url = website.safeParse(site);
  if (!url.success) return { error: firstError(url.error) };
  if (!url.data) return { error: "Enter the company's website first." };
  try {
    const profile = await writeCompanyProfile({ name: name.trim() || url.data, website: url.data });
    return profile ? { profile } : { error: "The website does not say what the company does, so no profile was written." };
  } catch (error) {
    return { error: describeProfileError(error) };
  }
}

export type FillState = { message?: string } | undefined;

/** The exhibitors of one trade show (or all) with an empty company profile, for "Fill missing profiles". */
export async function listEmptyProfiles(slug: string, tradeShowId: string | undefined): Promise<string[]> {
  await requirePlatformAdmin(slug);
  const rows = await db.exhibitor.findMany({ where: emptyProfileWhere(tradeShowId), orderBy: [{ name: "asc" }], select: { id: true } });
  return rows.map((r) => r.id);
}

/** Writes the profiles of a few exhibitors, for the progress bar of "Fill missing profiles". */
export async function writeProfilesFor(slug: string, ids: string[]): Promise<ProfileRunResult> {
  await requirePlatformAdmin(slug);
  if (!isCompanyProfileConfigured()) {
    return { written: 0, noInfo: 0, failed: 0, websitesFound: 0, problems: [], stoppedBy: "Add ANTHROPIC_API_KEY in Vercel before AI can write profiles." };
  }
  const result = await writeProfiles(ids.slice(0, PROFILES_PER_CALL));
  revalidatePath(`/a/${slug}/exhibitors`);
  return result;
}

/** How many exhibitors at the show still wait for AI to look up a contact person. */
export async function countMissingContacts(slug: string, tradeShowId: string): Promise<number> {
  await requirePlatformAdmin(slug);
  if (!isContactFinderConfigured()) return 0;
  return db.exhibitor.count({ where: missingContactWhere(tradeShowId) });
}

/** Looks up a few of the show's missing contacts, for the import page's progress bar. */
export async function findContactBatch(slug: string, tradeShowId: string): Promise<ContactFillResult> {
  await requirePlatformAdmin(slug);
  const result = await fillMissingContacts({ tradeShowId, budgetMs: PROFILE_BUDGET_MS, limit: PROFILES_PER_CALL });
  revalidatePath(`/a/${slug}/exhibitors`);
  return result;
}

export type ContactState = {
  contact?: FoundContact;
  error?: string;
  viaHunter?: boolean;
  /** Fields to overwrite although they are filled, e.g. info@ that gives way to the person's own email. */
  replace?: (keyof FoundContact)[];
  /** What Hunter.io did, when it added nothing, so the page can say why. */
  hunterNote?: string;
};

/**
 * Finds the contact person on the website typed in the form, and with Hunter.io
 * fills what the website did not show. `typed` is what the form's contact
 * fields hold now, so Hunter never puts an email next to someone else's name.
 * Nothing is saved until the form is.
 */
export async function findExhibitorContact(slug: string, name: string, site: string, typed?: ContactFields): Promise<ContactState> {
  await requirePlatformAdmin(slug);
  if (!isContactFinderConfigured()) return { error: "Add ANTHROPIC_API_KEY in Vercel before AI can look up contacts." };
  const url = website.safeParse(site);
  if (!url.success) return { error: firstError(url.error) };
  if (!url.data) return { error: "Enter the company's website first." };
  let contact: FoundContact | null = null;
  let error: string | undefined;
  try {
    contact = await findContact({ name: name.trim() || url.data, website: url.data });
  } catch (e) {
    error = describeContactError(e);
  }
  const current: ContactFields = {
    contactName: typed?.contactName?.trim() || null,
    contactTitle: typed?.contactTitle?.trim() || null,
    email: typed?.email?.trim() || null,
    phone: typed?.phone?.trim() || null,
  };
  const merged: FoundContact = { ...current, ...(contact && contactUpdate(current, contact)) };
  let viaHunter = false;
  let replace: (keyof FoundContact)[] = [];
  let hunterNote: string | undefined;
  if (!isHunterConfigured()) hunterNote = "Hunter.io is not set up (HUNTER_API_KEY is missing in Vercel).";
  else if (needsHunter(merged)) {
    try {
      const withHunterFound = await withHunter(url.data, merged);
      const added = withHunterFound ? hunterUpdate(merged, withHunterFound) : {};
      if (Object.keys(added).length > 0) {
        viaHunter = true;
        contact = { ...(contact ?? { contactName: null, contactTitle: null, email: null, phone: null }), ...added };
        if (added.email && current.email) replace = ["email"];
      }
      if (!added.contactName && !merged.contactName) hunterNote = `Hunter.io knows no named person at ${hunterDomain(url.data) ?? url.data}.`;
    } catch (e) {
      hunterNote = e instanceof Error ? e.message : "Hunter.io could not be reached.";
    }
  }
  if (contact) return { contact, viaHunter, replace, hunterNote };
  return { error: [error ?? "The website lists no contact person, email or phone number.", hunterNote].filter(Boolean).join(" ") };
}

/** Looks up the missing contacts of one trade show (or all), as many as fit in the time. */
export async function fillContacts(slug: string, tradeShowId: string | undefined): Promise<FillState> {
  await requirePlatformAdmin(slug);
  if (!isContactFinderConfigured()) return { message: "Add ANTHROPIC_API_KEY in Vercel before AI can look up contacts." };
  const result = await fillMissingContacts({ tradeShowId, budgetMs: PROFILE_BUDGET_MS });
  revalidatePath(`/a/${slug}/exhibitors`);
  return { message: contactSummary(result) };
}

/** Fills the empty countries of all exhibitors from their phone numbers' international prefix (+45, 0045). */
export async function fillCountries(slug: string): Promise<FillState> {
  await requirePlatformAdmin(slug);
  const filled = await fillCountriesFromPhones();
  revalidatePath(`/a/${slug}/exhibitors`);
  return { message: `Filled the country of ${filled} ${filled === 1 ? "exhibitor" : "exhibitors"} from the phone number.` };
}

/** "Ask AI": turns the user's sentence into the page's filters and shows the exhibitors they match. */
export async function askAiSearch(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMembership(slug);
  const question = String(formData.get("question") ?? "").trim().slice(0, MAX_QUESTION);
  if (!question) return { error: "Write what you are looking for." };
  if (!isCompanyProfileConfigured()) return { error: "AI search is not set up yet." };
  let filters;
  try {
    filters = await askAiForFilters(question);
  } catch (e) {
    console.error("AI search failed", e);
    return { error: e instanceof Error && e.message.startsWith("The AI") ? e.message : "The AI could not be reached. Try again in a moment." };
  }
  redirect(`/a/${slug}/exhibitors${exhibitorQuery(filters)}`);
}
