import { type AdPageKey, adPageSlots } from "@/lib/dashboard-ads";
import { db } from "@/lib/db";
import { DashboardAds } from "./dashboard-ads";

/** The row of 4 ad spaces at the top of a list page, read from the database. */
export async function PageAds({
  slug,
  page,
  platformAdmin,
  requester,
}: {
  slug: string;
  page: AdPageKey;
  platformAdmin: boolean;
  requester: { name: string; company: string; email: string };
}) {
  const slots = adPageSlots(page);
  const ads = await db.dashboardAd.findMany({ where: { slot: { in: [...slots] } }, select: { slot: true, linkUrl: true, name: true, updatedAt: true } });
  return <DashboardAds slug={slug} slots={slots} ads={ads} platformAdmin={platformAdmin} requester={requester} />;
}
