import { fillSummary } from "@/lib/company-profile";
import { fillMissingProfiles, isCompanyProfileConfigured } from "@/lib/company-profile-run";

// Called by Vercel Cron every night (see vercel.json). Writes the company
// profiles that an import did not finish within its time limit.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel sends CRON_SECRET as a bearer token; anyone else is turned away.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCompanyProfileConfigured()) return Response.json({ skipped: "ANTHROPIC_API_KEY is not set." });
  return Response.json({ summary: fillSummary(await fillMissingProfiles({ budgetMs: 150_000 })) });
}
