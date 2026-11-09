import { adSlot } from "@/lib/dashboard-ads";
import { db } from "@/lib/db";

// The image of a dashboard ad. The page links it with ?v=<upload time>, so a
// new upload gets a new address and the image can be cached for good.
export async function GET(_req: Request, ctx: RouteContext<"/api/ads/[slot]">) {
  const slot = adSlot((await ctx.params).slot);
  const ad = slot && (await db.dashboardAd.findUnique({ where: { slot }, select: { image: true, imageType: true } }));
  if (!ad) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(ad.image), {
    headers: {
      "Content-Type": ad.imageType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
