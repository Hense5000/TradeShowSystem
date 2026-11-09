import Link from "next/link";
import { AD_SLOTS, adImageUrl } from "@/lib/dashboard-ads";
import { AdSpaceRequest } from "./ad-space-request";

// On wide screens the same height as the count cards below them (Exhibitors,
// Exhibition centers...). On smaller screens the spaces keep the 3 : 1 shape
// of the ad images, so an image is never cut much.
export const AD_BOX = "aspect-[3/1] xl:aspect-auto xl:h-[7.5rem]";

type Ad = { slot: number; linkUrl: string; name: string | null; updatedAt: Date };

/** The 3 ad spaces on the dashboard: the advertiser's image, or "Your ad here!" while the space is free. */
export function DashboardAds({
  slug,
  ads,
  platformAdmin,
  requester,
}: {
  slug: string;
  ads: Ad[];
  platformAdmin: boolean;
  requester: { name: string; company: string; email: string };
}) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-3">
      {AD_SLOTS.map((slot) => {
        const ad = ads.find((a) => a.slot === slot);
        return (
          <div key={slot} className="relative">
            {ad ? (
              <a
                href={ad.linkUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className={`card block overflow-hidden p-0 hover:border-brand ${AD_BOX}`}
                title={ad.name ?? undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={adImageUrl(slot, ad.updatedAt)} alt={ad.name ?? "Advertisement"} className="size-full object-cover" />
              </a>
            ) : (
              <div className={`card flex flex-col items-center justify-center gap-2 px-3 py-2 text-center xl:gap-2.5 xl:py-3 ${AD_BOX}`}>
                <p className="text-xl font-extrabold tracking-tight xl:text-2xl">Your ad here!</p>
                <AdSpaceRequest slug={slug} slot={slot} defaults={requester} />
              </div>
            )}
            {platformAdmin && (
              <Link
                href={`/a/${slug}/admin/ads#ad-${slot}`}
                className="pill pill-soft absolute top-2 right-2 hover:underline"
                title="Only you see this (Super admin)"
              >
                Edit
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
