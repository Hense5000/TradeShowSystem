import { PageHeader } from "@/components/page-header";
import { AD_PAGES, adImageUrl, adNotifyEmail } from "@/lib/dashboard-ads";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { AD_BOX } from "../../dashboard-ads";
import { AdForm } from "./ad-form";

export default async function AdsPage({ params }: PageProps<"/a/[slug]/admin/ads">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const ads = await db.dashboardAd.findMany({ select: { slot: true, linkUrl: true, name: true, updatedAt: true } });

  return (
    <>
      <PageHeader
        title="Ads"
        description={`3 ad spaces at the top of every user's dashboard and 4 at the top of the Trade shows page. Upload an image and the link to the advertiser's website. A free space shows “Your ad here!” and a “Get this ad space” button; those requests are emailed to ${adNotifyEmail()}.`}
      />
      {AD_PAGES.map((page) => (
        <section key={page.key} id={page.key} className="flex scroll-mt-6 flex-col gap-3">
          <h2 className="text-lg font-bold">{page.label}</h2>
          <div className={`grid items-start gap-3.5 ${page.slots.length === 4 ? "md:grid-cols-2 2xl:grid-cols-4" : "xl:grid-cols-3"}`}>
            {page.slots.map((slot, i) => {
              const ad = ads.find((a) => a.slot === slot);
              return (
                <AdForm
                  key={slot}
                  slug={slug}
                  slot={slot}
                  position={i + 1}
                  pageName={page.key === "dashboard" ? "dashboard" : "Trade shows page"}
                  boxClass={AD_BOX}
                  ad={ad ? { imageUrl: adImageUrl(slot, ad.updatedAt), linkUrl: ad.linkUrl, name: ad.name } : null}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
