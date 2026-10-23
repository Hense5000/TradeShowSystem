import { db } from "@/lib/db";
import { oldTradeShowsWhere } from "@/lib/trade-show-cleanup";

// Called by Vercel Cron every day (see vercel.json). Deletes trade shows that
// ended more than three years ago while the cleanup is switched on. Their
// exhibitors go with them; finder suggestions are kept but lose the link.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel sends CRON_SECRET as a bearer token; anyone else is turned away.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await db.tradeShowCleanupSettings.findUnique({ where: { id: 1 } });
  if (!settings?.enabled) return Response.json({ skipped: "The cleanup of old trade shows is switched off." });
  const { count } = await db.tradeShow.deleteMany({ where: oldTradeShowsWhere() });
  await db.tradeShowCleanupSettings.update({ where: { id: 1 }, data: { lastRunAt: new Date(), lastRunDeleted: count } });
  return Response.json({ deleted: count });
}
