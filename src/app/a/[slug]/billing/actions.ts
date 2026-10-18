"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import { appUrl } from "@/lib/app-url";
import { currentSubscription, isLive } from "@/lib/billing";
import { db } from "@/lib/db";
import { billingConfigured, ensureCustomer, planPriceId, stripe } from "@/lib/stripe";
import { requireMembership } from "@/lib/tenant";

/** Sends the owner to Stripe Checkout to start the subscription. */
export async function startCheckout(slug: string, _prev: ActionState): Promise<ActionState> {
  const { user, organization } = await requireMembership(slug, "OWNER", { allowUnpaid: true });
  const price = planPriceId();
  if (!billingConfigured() || !price) return { error: "Payments are not set up yet." };

  const subscriptions = await db.subscription.findMany({ where: { organizationId: organization.id } });
  const current = currentSubscription(subscriptions);
  if (current && isLive(current.status)) return { error: "This account already has a subscription." };

  const users = Math.max(1, await db.membership.count({ where: { organizationId: organization.id } }));
  let url: string | null;
  try {
    const customer = await ensureCustomer(organization, user.email);
    const base = `${appUrl()}/a/${slug}/billing`;
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: organization.id,
      // Charged per user: one unit for each user in the account.
      line_items: [{ price, quantity: users }],
      subscription_data: { metadata: { organizationId: organization.id } },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { name: "auto", address: "auto" },
      success_url: `${base}?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: base,
    });
    url = session.url;
  } catch (error) {
    console.error("Could not start Stripe Checkout", error);
    return { error: "Could not open the payment page. Please try again." };
  }
  if (!url) return { error: "Could not open the payment page. Please try again." };
  redirect(url);
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
