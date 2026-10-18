import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { currentSubscription, formatMoney, intervalLabel, isLive, statusLabel, statusPill } from "@/lib/billing";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/permissions";
import { billingConfigured, planPrice, stripe, stripeTestMode, syncSubscription } from "@/lib/stripe";
import { requireMembership } from "@/lib/tenant";
import { openPortal, startCheckout } from "./actions";

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Back from Stripe Checkout: copy the new subscription right away instead of
 * waiting for the webhook, so the page shows it at once.
 */
async function syncCheckout(sessionId: string, stripeCustomerId: string | null) {
  if (!stripeCustomerId || !sessionId.startsWith("cs_")) return false;
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (customer !== stripeCustomerId) return false;
    const sub = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (sub) await syncSubscription(sub);
    return true;
  } catch (error) {
    console.error("Could not read the Stripe Checkout session", error);
    return false;
  }
}

export default async function BillingPage({ params, searchParams }: PageProps<"/a/[slug]/billing">) {
  const { slug } = await params;
  const { checkout } = await searchParams;
  const { membership, organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const isOwner = hasRole(membership.role, "OWNER");
  const configured = billingConfigured();

  const justPaid = configured && typeof checkout === "string" && (await syncCheckout(checkout, organization.stripeCustomerId));
  const [subscriptions, invoices, price, users] = await Promise.all([
    db.subscription.findMany({ where: { organizationId: organization.id } }),
    db.invoice.findMany({
      where: { organizationId: organization.id, status: { not: "draft" } },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    configured ? planPrice() : null,
    db.membership.count({ where: { organizationId: organization.id } }),
  ]);
  const sub = currentSubscription(subscriptions);
  const live = sub ? isLive(sub.status) : false;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your subscription and invoices. Payments are handled securely by Stripe."
        action={configured && stripeTestMode() ? <span className="pill pill-warn">Test mode: no real payments</span> : undefined}
      />

      {justPaid && <p className="success">Thank you! Your subscription is set up.</p>}
      {!isOwner && (
        <p className="rounded-lg bg-brand-soft px-3 py-2.5 text-sm">Only owners can start or change the subscription.</p>
      )}

      <section className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">Subscription</h2>
            <p className="text-sm text-muted">
              {price ? price.name : "Trade Show System"}
              {price?.amount != null && (
                <>
                  {" · "}
                  <span className="font-semibold text-ink">{formatMoney(price.amount, price.currency)}</span>
                  {" per user"}
                  {price.interval && ` ${intervalLabel(price.interval, price.intervalCount)}`}
                </>
              )}
            </p>
            {price?.amount != null && (
              <p className="mt-1 text-sm text-muted">
                {users} {users === 1 ? "user" : "users"}
                {" · "}
                <span className="font-semibold text-ink">{formatMoney(price.amount * users, price.currency)}</span>
                {price.interval && ` ${intervalLabel(price.interval, price.intervalCount)}`}
                {" excl. VAT. Adding or removing users changes the amount."}
              </p>
            )}
          </div>
          {sub && <span className={`pill ${statusPill(sub.status)}`}>{statusLabel(sub.status)}</span>}
        </div>

        {!configured ? (
          <p className="text-sm text-muted">Online payment is not available yet. We will let you know when it is.</p>
        ) : !sub || !live ? (
          <p className="text-sm text-muted">
            {sub ? "Your subscription has ended. Start a new one to continue." : "You don't have a subscription yet."}
          </p>
        ) : (
          <p className="text-sm text-muted">
            {sub.status === "past_due" || sub.status === "unpaid"
              ? "The last payment failed. Please update your card to keep your subscription."
              : sub.cancelAtPeriodEnd
                ? `Cancelled. It stays active until ${sub.currentPeriodEnd ? date.format(sub.currentPeriodEnd) : "the end of the period"}.`
                : sub.currentPeriodEnd
                  ? `Renews on ${date.format(sub.currentPeriodEnd)}.`
                  : "Your subscription is active."}
          </p>
        )}

        {configured && isOwner && (
          <div className="card-foot">
            {live ? (
              <ActionForm action={openPortal.bind(null, slug)}>
                <button className="btn">Manage subscription</button>
              </ActionForm>
            ) : (
              <>
                {sub && organization.stripeCustomerId && (
                  <ActionForm action={openPortal.bind(null, slug)}>
                    <button className="btn-secondary h-full">Payment details</button>
                  </ActionForm>
                )}
                <ActionForm action={startCheckout.bind(null, slug)}>
                  <button className="btn">Subscribe</button>
                </ActionForm>
              </>
            )}
          </div>
        )}
      </section>

      <section className="card overflow-hidden p-0">
        <h2 className="px-5 pt-5 pb-3 font-bold">
          Invoices <span className="font-semibold text-muted tabular-nums">{invoices.length}</span>
        </h2>
        {invoices.length === 0 ? (
          <p className="border-t border-line px-5 py-4 text-sm text-muted">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-5 py-2.5">Number</th>
                  <th className="px-5 py-2.5 text-right">Amount</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5"><span className="sr-only">Links</span></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 whitespace-nowrap">{date.format(inv.createdAt)}</td>
                    <td className="px-5 py-3 text-muted">{inv.number ?? "–"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatMoney(inv.amountDue, inv.currency)}</td>
                    <td className="px-5 py-3">
                      <span className={`pill ${inv.status === "paid" ? "pill-ok" : inv.status === "open" ? "pill-warn" : "pill-neutral"}`}>
                        {inv.status === "paid" ? "Paid" : inv.status === "open" ? "Due" : inv.status === "void" ? "Void" : "Uncollectible"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {inv.hostedInvoiceUrl && (
                        <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                          {inv.status === "open" ? "Pay" : "View"}
                        </a>
                      )}
                      {inv.invoicePdfUrl && (
                        <a href={inv.invoicePdfUrl} target="_blank" rel="noreferrer" className="ml-4 font-semibold text-brand hover:underline">
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
