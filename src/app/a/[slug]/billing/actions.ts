"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import { appUrl } from "@/lib/app-url";
import { currentSubscription, isLive } from "@/lib/billing";
import { createCheckout } from "@/lib/checkout";
import { billingConfigured, planPriceId, proPriceId, stripe } from "@/lib/stripe";
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

/**
 * The Upgrade button (download limit dialog and Billing page): moves the
 * existing subscription to the upgraded price, so the account never pays for
 * two subscriptions. The owner confirms the new price on a Stripe page. If
 * the customer portal isn't set up for plan changes, the subscription is
 * changed directly instead (the owner accepted the price in the dialog) and
 * the difference for the rest of the month is charged at once.
 */
export async function upgradePlan(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization } = await requireMembership(slug, "OWNER");
  const pro = proPriceId();
  const sub = currentSubscription(organization.subscriptions);
  if (!billingConfigured() || !pro || !organization.stripeCustomerId || !sub || !isLive(sub.status)) {
    return { error: "Upgrading is not available yet. Please contact support." };
  }

  const back = String(formData.get("back") ?? "");
  const returnTo = back.startsWith(`/a/${slug}/`) ? back : `/a/${slug}/exhibitors`;
  const done = `${appUrl()}/a/${slug}/billing/upgraded?back=${encodeURIComponent(returnTo)}`;

  let url: string;
  try {
    const current = await stripe().subscriptions.retrieve(sub.stripeSubscriptionId);
    const item = current.items.data.find((i) => i.price.id === planPriceId() || i.price.id === pro) ?? current.items.data[0];
    if (!item) return { error: "Could not find the subscription. Please contact support." };
    if (item.price.id === pro) {
      url = done;
    } else {
      const change = { id: item.id, price: pro, quantity: item.quantity ?? 1 };
      try {
        const session = await stripe().billingPortal.sessions.create({
          customer: organization.stripeCustomerId,
          return_url: `${appUrl()}${returnTo}`,
          flow_data: {
            type: "subscription_update_confirm",
            subscription_update_confirm: { subscription: current.id, items: [change] },
            after_completion: { type: "redirect", redirect: { return_url: done } },
          },
        });
        url = session.url;
      } catch (error) {
        console.warn("The Stripe customer portal could not confirm the upgrade; changing the subscription directly", error);
        await stripe().subscriptions.update(current.id, {
          items: [change],
          proration_behavior: "always_invoice",
          // If the card is declined, nothing changes.
          payment_behavior: "error_if_incomplete",
        });
        url = done;
      }
    }
  } catch (error) {
    console.error("Could not upgrade the subscription", error);
    return { error: "Could not upgrade. Please check the card on the Billing page and try again." };
  }
  redirect(url);
}
