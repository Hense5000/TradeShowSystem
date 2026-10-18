// Pure rules for an account's subscription. Kept free of Stripe and database
// access so they are easy to test. Stripe's status strings are stored as is.

type SubscriptionLike = { status: string; createdAt: Date };

export const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  incomplete: "Awaiting payment",
  incomplete_expired: "Expired",
  paused: "Paused",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/** Badge colour for a status: green when paid up, amber when payment is needed. */
export function statusPill(status: string): "pill-ok" | "pill-warn" | "pill-neutral" {
  if (status === "active" || status === "trialing") return "pill-ok";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "pill-warn";
  return "pill-neutral";
}

/** Statuses where the account already has a subscription, so it must not start a second one. */
const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

export function isLive(status: string): boolean {
  return LIVE.has(status);
}

/**
 * Whether an account may use the app. A failed payment (past_due) keeps
 * access while Stripe retries the card; Stripe then moves the subscription to
 * unpaid or canceled, which blocks it.
 */
export function hasPaidAccess(subscription: { status: string } | null): boolean {
  return subscription?.status === "active" || subscription?.status === "trialing" || subscription?.status === "past_due";
}

/** The subscription to show: the newest live one, otherwise the newest of all. */
export function currentSubscription<T extends SubscriptionLike>(subscriptions: T[]): T | null {
  const newest = [...subscriptions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return newest.find((s) => isLive(s.status)) ?? newest[0] ?? null;
}

/** An amount in the smallest currency unit (øre, cents) as text, e.g. "DKK 1,250.00". */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
}

const INTERVAL: Record<string, string> = { day: "day", week: "week", month: "month", year: "year" };

/** "per month", "every 3 months" and so on. */
export function intervalLabel(interval: string, count = 1): string {
  const unit = INTERVAL[interval] ?? interval;
  return count === 1 ? `per ${unit}` : `every ${count} ${unit}s`;
}
