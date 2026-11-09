"use server";

import type { ActionState } from "@/components/action-form";
import { adNotifyEmail, adRequestEmailContent, checkAdRequest } from "@/lib/dashboard-ads";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { requireMembership } from "@/lib/tenant";

export type AdRequestState = ActionState | { sent: true };

/** "Get this ad space": emails the form to the platform owner, with the sender as reply-to. */
export async function requestAdSpace(slug: string, _prev: AdRequestState, formData: FormData): Promise<AdRequestState> {
  const { user, organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const request = checkAdRequest(formData);
  if ("error" in request) return request;
  if (!isEmailConfigured()) return { error: `The request could not be sent right now. Please write to ${adNotifyEmail()}.` };
  try {
    await sendEmail({
      to: adNotifyEmail(),
      replyTo: request.email,
      ...adRequestEmailContent(request, { name: organization.name, userEmail: user.email }),
    });
  } catch (e) {
    console.error("Ad space request email failed", e);
    return { error: "The request could not be sent right now. Please try again in a moment." };
  }
  return { sent: true };
}
