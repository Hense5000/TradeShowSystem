import { db } from "@/lib/db";
import { runShowFinder } from "@/lib/show-finder-run";

// Called by Vercel Cron every day (see vercel.json). Each center is checked
// about once a month; the daily call picks up the ones that are due, so the
// work is spread out and each run stays within the time limit.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel sends CRON_SECRET as a bearer token; anyone else is turned away.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await db.showFinderSettings.findUnique({ where: { id: 1 } });
  if (!settings?.enabled) return Response.json({ skipped: "The AI trade show finder is switched off." });
  return Response.json({ summary: await runShowFinder({ onlyDue: true }) });
}
