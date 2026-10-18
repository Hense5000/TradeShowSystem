import "server-only";
import type { Organization } from "@prisma/client";
import { appUrl } from "@/lib/app-url";
import { currentSubscription, isLive } from "@/lib/billing";
import { db } from "@/lib/db";
import { billingConfigured, ensureCustomer, planPriceId, stripe } from "@/lib/stripe";

/**
 * A Stripe Checkout page where the owner enters a card and pays the first
 * month, or an error to show. Charged per user: one unit for each user.
 */
export async function createCheckout(
  organization: Organization,
  ownerEmail: string,
  slug: string,
): Promise<{ url: string } | { error: string }> {
  const price = planPriceId();
  if (!billingConfigured() || !price) return { error: "Payments are not set up yet." };

  const subscriptions = await db.subscription.findMany({ where: { organizationId: organization.id } });
  const current = currentSubscription(subscriptions);
  if (current && isLive(current.status)) return { error: "This account already has a subscription." };

  const users = Math.max(1, await db.membership.count({ where: { organizationId: organization.id } }));
  try {
    const customer = await ensureCustomer(organization, ownerEmail);
    const base = `${appUrl()}/a/${slug}/billing`;
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: organization.id,
      line_items: [{ price, quantity: users }],
      subscription_data: { metadata: { organizationId: organization.id } },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { name: "auto", address: "auto" },
      success_url: `${base}?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: base,
    });
    if (session.url) return { url: session.url };
  } catch (error) {
    console.error("Could not start Stripe Checkout", error);
  }
  return { error: "Could not open the payment page. Please try again." };
}
