"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import { appUrl } from "@/lib/app-url";
import { createCheckout } from "@/lib/checkout";
import { billingConfigured, stripe } from "@/lib/stripe";
import { requireMembership } from "@/lib/tenant";

/** Sends the owner to Stripe Checkout to start the subscription. */
export async function startCheckout(slug: string, _prev: ActionState): Promise<ActionState> {
  const { user, organization } = await requireMembership(slug, "OWNER", { allowUnpaid: true });
  const checkout = await createCheckout(organization, user.email, slug);
  if ("error" in checkout) return { error: checkout.error };
  redirect(checkout.url);
}

/** Opens Stripe's customer portal: change card, cancel, see invoices. */
export async function openPortal(slug: string, _prev: ActionState): Promise<ActionState> {
  const { organization } = await requireMembership(slug, "OWNER", { allowUnpaid: true });
  if (!billingConfigured() || !organization.stripeCustomerId) return { error: "There is no subscription to manage yet." };

  let url: string;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${appUrl()}/a/${slug}/billing`,
    });
    url = session.url;
  } catch (error) {
    console.error("Could not open the Stripe customer portal", error);
    return { error: "Could not open the billing portal. Please try again." };
  }
  redirect(url);
}
