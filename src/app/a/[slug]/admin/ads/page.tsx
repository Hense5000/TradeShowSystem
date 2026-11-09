import { PageHeader } from "@/components/page-header";
import { AD_SLOTS, adImageUrl, adNotifyEmail } from "@/lib/dashboard-ads";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { AD_BOX } from "../../dashboard-ads";
import { AdForm } from "./ad-form";

export default async function DashboardAdsPage({ params }: PageProps<"/a/[slug]/admin/ads">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const ads = await db.dashboardAd.findMany({ select: { slot: true, linkUrl: true, name: true, updatedAt: true } });

  return (
    <>
      <PageHeader
        title="Dashboard ads"
        description={`The 3 ad spaces at the top of every user's dashboard. Upload an image and the link to the advertiser's website. A free space shows “Your ad here!” and a “Get this ad space” button; those requests are emailed to ${adNotifyEmail()}.`}
      />
      <div className="grid items-start gap-3.5 xl:grid-cols-3">
        {AD_SLOTS.map((slot) => {
          const ad = ads.find((a) => a.slot === slot);
          return (
            <AdForm
              key={slot}
              slug={slug}
              slot={slot}
              boxClass={AD_BOX}
              ad={ad ? { imageUrl: adImageUrl(slot, ad.updatedAt), linkUrl: ad.linkUrl, name: ad.name } : null}
            />
          );
        })}
      </div>
    </>
  );
}
