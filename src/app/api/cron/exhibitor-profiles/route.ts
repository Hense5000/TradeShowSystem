import { isCompanyProfileConfigured } from "@/lib/company-profile-run";
import { contactSummary } from "@/lib/contact-finder";
import { fillMissingContacts } from "@/lib/contact-finder-run";
import { fillCountriesFromPhones } from "@/lib/phone-country-run";

// Called by Vercel Cron every night (see vercel.json). Looks up the contact
// persons that an import did not finish, and fills empty countries from phone
// numbers. Company profiles are not written here, to keep the AI cost down;
// a user asks for one on the company's page. Hunter.io is not asked here,
// so its paid credits are only spent when someone presses a button.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** When the run stops starting new lookups; one that has started can take up to two minutes more. */
const BUDGET_MS = 170_000;

export async function GET(request: Request) {
  // Vercel sends CRON_SECRET as a bearer token; anyone else is turned away.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const countries = await fillCountriesFromPhones();
  if (!isCompanyProfileConfigured()) return Response.json({ skipped: "ANTHROPIC_API_KEY is not set." });
  const contacts = contactSummary(await fillMissingContacts({ budgetMs: BUDGET_MS, useHunter: false }));
  return Response.json({ summary: `${contacts} Filled ${countries} countries from phone numbers.` });
}
