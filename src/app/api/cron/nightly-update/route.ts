import { db } from "@/lib/db";
import { shouldRun } from "@/lib/nightly-update";
import { runNightlyUpdate } from "@/lib/nightly-update-run";

// Called by Vercel Cron every hour from 01 to 04 UTC (see vercel.json). It
// only works between 03:00 and 06:59 Danish time, on Sunday night and on the
// nights after until the week's update is done (see shouldRun).

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** When the round stops starting new work; what has started may run on for up to two minutes. */
const ROUND_MS = 280_000;

export async function GET(request: Request) {
  // Vercel sends CRON_SECRET as a bearer token; anyone else is turned away.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await db.nightlyUpdateSettings.findUnique({ where: { id: 1 } });
  if (settings && !settings.enabled) return Response.json({ skipped: "The weekly update is switched off." });
  if (!shouldRun(settings)) return Response.json({ skipped: "Not a night the weekly update works." });
  return Response.json({ summary: await runNightlyUpdate(ROUND_MS) });
}
