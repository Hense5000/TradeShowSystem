import "server-only";
import type { Organization } from "@prisma/client";
import Stripe from "stripe";
import { currentSubscription, isLive } from "@/lib/billing";
import { db } from "@/lib/db";

// Stripe holds the truth about subscriptions and invoices; the Subscription
// and Invoice tables are copies kept up to date by the webhook
// (src/app/api/stripe/webhook) so pages don't have to ask Stripe every time.

let client: Stripe | undefined;

/** The Stripe client. Created on first use so builds work without a key. */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}

/** The Stripe Price of the subscription plan, e.g. price_123. */
export function planPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_ID?.trim() || undefined;
}

/**
 * The Stripe Price of the upgraded plan, which allows downloads from more
 * trade shows per day (see src/lib/export-limit.ts), e.g. price_456.
 */
export function proPriceId(): string | undefined {
  return process.env.STRIPE_PRO_PRICE_ID?.trim() || undefined;
}

/** Whether everything needed to take payments is set in the environment. */
export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && planPriceId());
}

/** True with a test key (sk_test_...), where no real money moves. */
export function stripeTestMode(): boolean {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;
}

/** A price and its product name, for the billing page. Null if Stripe can't be reached. */
export async function planPrice(id = planPriceId()) {
  if (!id || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const price = await stripe().prices.retrieve(id, { expand: ["product"] });
    const product = typeof price.product === "object" && !price.product.deleted ? price.product : null;
    return {
      name: product?.name ?? "Subscription",
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
      intervalCount: price.recurring?.interval_count ?? 1,
    };
  } catch (error) {
    console.error("Could not read the Stripe price", error);
    return null;
  }
}

/** The account's Stripe customer id, creating the customer the first time. */
export async function ensureCustomer(org: Organization, fallbackEmail: string): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const contact = await db.contact.findFirst({ where: { organizationId: org.id, isPrimary: true } });
  const customer = await stripe().customers.create(
    {
      name: org.name,
      email: contact?.email ?? fallbackEmail,
      address: org.addressLine1
        ? {
            line1: org.addressLine1,
            line2: org.addressLine2 ?? undefined,
            postal_code: org.postalCode ?? undefined,
            city: org.city ?? undefined,
            state: org.region ?? undefined,
            country: org.country ?? undefined,
          }
        : undefined,
      metadata: { organizationId: org.id },
    },
    // Two clicks at once still make only one customer.
    { idempotencyKey: `customer-${org.id}` },
  );
  const { count } = await db.organization.updateMany({
    where: { id: org.id, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  if (count === 0) {
    const saved = await db.organization.findUniqueOrThrow({ where: { id: org.id } });
    return saved.stripeCustomerId ?? customer.id;
  }
  return customer.id;
}

function customerId(customer: string | { id: string } | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

async function organizationFor(customer: string | { id: string } | null, metadataOrgId?: string) {
  const id = customerId(customer);
  const org = id ? await db.organization.findUnique({ where: { stripeCustomerId: id } }) : null;
  if (org) return org;
  return metadataOrgId ? db.organization.findUnique({ where: { id: metadataOrgId } }) : null;
}

/** Copies a subscription from Stripe into the Subscription table. */
export async function syncSubscription(subscriptionId: string) {
  // Always read the latest version, so events arriving out of order can't
  // overwrite a newer state with an older one.
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const org = await organizationFor(sub.customer, sub.metadata.organizationId);
  if (!org) {
    console.warn(`Stripe subscription ${sub.id} belongs to no account`);
    return;
  }
  const periodEnds = sub.items.data.map((i) => i.current_period_end).filter(Boolean);
  const data = {
    status: sub.status,
    priceId: (sub.items.data.find((i) => i.price.id === proPriceId()) ?? sub.items.data[0])?.price.id ?? null,
    currentPeriodEnd: periodEnds.length ? new Date(Math.min(...periodEnds) * 1000) : null,
    // The customer portal may cancel with a date instead of "at period end".
    cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at !== null,
  };
  await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: { organizationId: org.id, stripeSubscriptionId: sub.id, ...data },
    update: data,
  });
}

/** Copies an invoice from Stripe into the Invoice table. */
export async function syncInvoice(invoiceId: string) {
  const inv = await stripe().invoices.retrieve(invoiceId);
  if (!inv.id) return;
  const org = await organizationFor(inv.customer);
  if (!org) {
    console.warn(`Stripe invoice ${inv.id} belongs to no account`);
    return;
  }
  const data = {
    number: inv.number,
    status: inv.status ?? "draft",
    currency: inv.currency,
    amountDue: inv.amount_due,
    amountPaid: inv.amount_paid,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdfUrl: inv.invoice_pdf ?? null,
    periodStart: new Date(inv.period_start * 1000),
    periodEnd: new Date(inv.period_end * 1000),
  };
  await db.invoice.upsert({
    where: { stripeInvoiceId: inv.id },
    create: { organizationId: org.id, stripeInvoiceId: inv.id, ...data },
    update: data,
  });
}

/**
 * The subscription is charged per user, so its quantity follows the number of
 * users in the account. Call after a user joins or leaves. A new user is
 * invoiced and charged at once for the rest of the period. Never throws: a failure is logged and the
 * next change (or the next checkout) corrects it.
 */
export async function syncSeats(organizationId: string) {
  if (!billingConfigured()) return;
  try {
    const subs = await db.subscription.findMany({ where: { organizationId } });
    const current = currentSubscription(subs);
    if (!current || !isLive(current.status)) return;
    const sub = await stripe().subscriptions.retrieve(current.stripeSubscriptionId);
    const item = sub.items.data.find((i) => i.price.id === planPriceId() || i.price.id === proPriceId()) ?? sub.items.data[0];
    const users = Math.max(1, await db.membership.count({ where: { organizationId } }));
    if (!item || item.quantity === users) return;
    await stripe().subscriptions.update(sub.id, {
      items: [{ id: item.id, quantity: users }],
      // A new user is charged right away for the rest of the period; a
      // removed user becomes a credit on the next invoice.
      proration_behavior: users > (item.quantity ?? 0) ? "always_invoice" : "create_prorations",
    });
  } catch (error) {
    console.error(`Could not update the number of users on the subscription of ${organizationId}`, error);
  }
}

/**
 * Handles one webhook event. Returns false when the event was already handled
 * (Stripe may send the same event more than once).
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<boolean> {
  if (await db.stripeEvent.findUnique({ where: { id: event.id } })) return false;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orgId = session.client_reference_id;
      const customer = customerId(session.customer);
      if (orgId && customer) {
        await db.organization.updateMany({ where: { id: orgId, stripeCustomerId: null }, data: { stripeCustomerId: customer } });
      }
      const subscription = customerId(session.subscription);
      if (subscription) await syncSubscription(subscription);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object.id);
      break;
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.updated":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided":
    case "invoice.marked_uncollectible": {
      const id = event.data.object.id;
      if (id) await syncInvoice(id);
      break;
    }
  }

  // Recorded only after it worked, so a failed attempt is retried by Stripe.
  await db.stripeEvent.createMany({ data: [{ id: event.id, type: event.type }], skipDuplicates: true });
  return true;
}

/** Whether Stripe says the object doesn't exist, e.g. a test-mode id asked with a live key. */
function isMissing(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeError && error.code === "resource_missing";
}

/** Runs `retrieve` for each id and returns the ids Stripe doesn't know. Other errors stop it. */
async function missingIds(ids: string[], retrieve: (id: string) => Promise<unknown>): Promise<string[]> {
  const missing: string[] = [];
  for (const id of ids) {
    try {
      await retrieve(id);
    } catch (error) {
      if (!isMissing(error)) throw error;
      missing.push(id);
    }
  }
  return missing;
}

/**
 * After switching from test keys to live keys: removes the copies of
 * subscriptions, invoices and customers the current Stripe account doesn't
 * know (the test-mode ones). Accounts that only paid in test mode are then
 * unpaid and must subscribe again. Safe to run any time: what Stripe knows
 * is kept.
 */
export async function removeUnknownBillingData() {
  const s = stripe();
  const [subs, invoices, orgs, items] = await Promise.all([
    db.subscription.findMany({ select: { stripeSubscriptionId: true } }),
    db.invoice.findMany({ select: { stripeInvoiceId: true } }),
    db.organization.findMany({ where: { stripeCustomerId: { not: null } }, select: { stripeCustomerId: true } }),
    db.organizationFeature.findMany({ where: { stripeSubscriptionItemId: { not: null } }, select: { stripeSubscriptionItemId: true } }),
  ]);
  const goneSubs = await missingIds(subs.map((x) => x.stripeSubscriptionId), (id) => s.subscriptions.retrieve(id));
  const goneInvoices = await missingIds(invoices.map((x) => x.stripeInvoiceId), (id) => s.invoices.retrieve(id));
  const goneCustomers = await missingIds(orgs.map((x) => x.stripeCustomerId!), (id) => s.customers.retrieve(id));
  const goneItems = await missingIds(items.map((x) => x.stripeSubscriptionItemId!), (id) => s.subscriptionItems.retrieve(id));

  await db.$transaction([
    db.subscription.deleteMany({ where: { stripeSubscriptionId: { in: goneSubs } } }),
    db.invoice.deleteMany({ where: { stripeInvoiceId: { in: goneInvoices } } }),
    db.organization.updateMany({ where: { stripeCustomerId: { in: goneCustomers } }, data: { stripeCustomerId: null } }),
    db.organizationFeature.updateMany({
      where: { stripeSubscriptionItemId: { in: goneItems } },
      data: { stripeSubscriptionItemId: null },
    }),
  ]);
  return { subscriptions: goneSubs.length, invoices: goneInvoices.length, customers: goneCustomers.length };
}
