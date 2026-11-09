"use server";

import { db } from "@/lib/db";
import { popupDay } from "@/lib/hunter-popup";
import { requireMembership } from "@/lib/tenant";

/** Notes that the signed-in user saw the Hunter.io popup today. */
export async function markHunterPopupShown(slug: string) {
  const { user } = await requireMembership(slug, "MEMBER", {
    allowUnpaid: true,
  });
  await db.user.update({
    where: { id: user.id },
    data: { hunterPopupDay: popupDay() },
  });
}

/** "Don't show this popup again": the signed-in user never sees it again. */
export async function hideHunterPopup(slug: string) {
  const { user } = await requireMembership(slug, "MEMBER", {
    allowUnpaid: true,
  });
  await db.user.update({
    where: { id: user.id },
    data: { hideHunterPopup: true },
  });
}
