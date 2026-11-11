"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { adSlot, checkAdImage, checkAdLink } from "@/lib/dashboard-ads";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";

export type SaveAdState = ActionState | { saved: true };

/**
 * Saves the ad in one of the ad spaces (dashboard, Trade shows page or Exhibitors page). A new image is needed for an
 * empty space; on a filled one the image may be left out to change only the link.
 */
export async function saveAd(slug: string, _prev: SaveAdState, formData: FormData): Promise<SaveAdState> {
  await requirePlatformAdmin(slug);
  const slot = adSlot(formData.get("slot"));
  if (!slot) return { error: "Unknown ad space." };
  const link = checkAdLink(formData.get("linkUrl"));
  if ("error" in link) return link;
  const name = String(formData.get("name") ?? "").trim().slice(0, 200) || null;

  const file = formData.get("image");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    const bad = checkAdImage(file);
    if (bad) return bad;
    const image = new Uint8Array(await file.arrayBuffer());
    await db.dashboardAd.upsert({
      where: { slot },
      create: { slot, image, imageType: file.type, linkUrl: link.url, name },
      update: { image, imageType: file.type, linkUrl: link.url, name },
    });
  } else {
    const { count } = await db.dashboardAd.updateMany({ where: { slot }, data: { linkUrl: link.url, name } });
    if (count === 0) return { error: "Choose an image for the ad." };
  }
  revalidatePath("/a/[slug]", "page");
  revalidatePath("/a/[slug]/trade-shows", "page");
  revalidatePath(`/a/${slug}/admin/ads`);
  return { saved: true };
}

/** Empties an ad space, so it shows "Your ad here!" again. */
export async function removeAd(slug: string, slotValue: number): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  const slot = adSlot(slotValue);
  if (!slot) return { error: "Unknown ad space." };
  await db.dashboardAd.deleteMany({ where: { slot } });
  revalidatePath("/a/[slug]", "page");
  revalidatePath("/a/[slug]/trade-shows", "page");
  revalidatePath(`/a/${slug}/admin/ads`);
  return undefined;
}
