"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import type { SaveState } from "@/components/save-form";
import { type FillResult, fillSummary } from "@/lib/company-profile";
import {
  describeProfileError,
  fillMissingProfiles,
  isCompanyProfileConfigured,
  missingProfileWhere,
  writeCompanyProfile,
} from "@/lib/company-profile-run";
import { type ContactFillResult, contactSummary, type FoundContact } from "@/lib/contact-finder";
import { describeContactError, fillMissingContacts, findContact, isContactFinderConfigured, missingContactWhere } from "@/lib/contact-finder-run";
import { db } from "@/lib/db";
import { exhibitorKey, IMPORT_ROWS_PER_CALL, parseExhibitorRows } from "@/lib/exhibitors";
import { requirePlatformAdmin } from "@/lib/tenant";
import { exhibitorSchema, firstError, website } from "@/lib/validation";

/** How long an import or a "Write missing profiles" press spends on AI profiles; the page may run for 300 seconds. */
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

export async function createExhibitor(slug: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = exhibitorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await showExists(parsed.data.tradeShowId))) return { error: "Choose the trade show." };
  if (await findDuplicate(parsed.data.tradeShowId, parsed.data.name)) {
    return { error: `${parsed.data.name} is already an exhibitor at that trade show.` };
  }

  await db.exhibitor.create({ data: parsed.data });
  revalidatePath(`/a/${slug}/exhibitors`);
  redirect(`/a/${slug}/exhibitors?show=${parsed.data.tradeShowId}`);
}

export async function updateExhibitor(slug: string, id: string, _prev: SaveState, formData: FormData): Promise<SaveState> {
  await requirePlatformAdmin(slug);
  const parsed = exhibitorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await showExists(parsed.data.tradeShowId))) return { error: "Choose the trade show." };
  if (await findDuplicate(parsed.data.tradeShowId, parsed.data.name, id)) {
    return { error: `Another ${parsed.data.name} is already an exhibitor at that trade show.` };
  }

  // An empty profile or contact may be looked up by AI again, e.g. after the website was corrected.
  const retry = {
    ...(!parsed.data.companyProfile && { profileTriedAt: null }),
    ...(!parsed.data.contactName && !parsed.data.email && { contactTriedAt: null }),
  };
  const { count } = await db.exhibitor.updateMany({ where: { id }, data: { ...parsed.data, ...retry } });
  if (count === 0) return { error: "This exhibitor no longer exists." };
  revalidatePath(`/a/${slug}/exhibitors`);
  return { saved: true };
}

export async function deleteExhibitor(slug: string, id: string): Promise<ActionState> {
  await requirePlatformAdmin(slug);
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
  if (fresh.length > 0) await db.exhibitor.createMany({ data: fresh.map((e) => ({ ...e, tradeShowId })) });
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

/** Writes the missing company profiles of one trade show (or all), as many as fit in the time. */
export async function fillProfiles(slug: string, tradeShowId: string | undefined): Promise<FillState> {
  await requirePlatformAdmin(slug);
  if (!isCompanyProfileConfigured()) return { message: "Add ANTHROPIC_API_KEY in Vercel before AI can write profiles." };
  const result = await fillMissingProfiles({ tradeShowId, budgetMs: PROFILE_BUDGET_MS });
  revalidatePath(`/a/${slug}/exhibitors`);
  return { message: fillSummary(result) };
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

export type ContactState = { contact?: FoundContact; error?: string };

/** Finds the contact person on the website typed in the form. Nothing is saved until the form is. */
export async function findExhibitorContact(slug: string, name: string, site: string): Promise<ContactState> {
  await requirePlatformAdmin(slug);
  if (!isContactFinderConfigured()) return { error: "Add ANTHROPIC_API_KEY in Vercel before AI can look up contacts." };
  const url = website.safeParse(site);
  if (!url.success) return { error: firstError(url.error) };
  if (!url.data) return { error: "Enter the company's website first." };
  try {
    const contact = await findContact({ name: name.trim() || url.data, website: url.data });
    return contact ? { contact } : { error: "The website lists no contact person, email or phone number." };
  } catch (error) {
    return { error: describeContactError(error) };
  }
}

/** Looks up the missing contacts of one trade show (or all), as many as fit in the time. */
export async function fillContacts(slug: string, tradeShowId: string | undefined): Promise<FillState> {
  await requirePlatformAdmin(slug);
  if (!isContactFinderConfigured()) return { message: "Add ANTHROPIC_API_KEY in Vercel before AI can look up contacts." };
  const result = await fillMissingContacts({ tradeShowId, budgetMs: PROFILE_BUDGET_MS });
  revalidatePath(`/a/${slug}/exhibitors`);
  return { message: contactSummary(result) };
}
