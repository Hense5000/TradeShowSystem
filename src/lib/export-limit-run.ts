import "server-only";
import type { Organization, Role, Subscription, User } from "@prisma/client";
import { currentSubscription, formatMoney, isLive } from "@/lib/billing";
import { db } from "@/lib/db";
import { checkExport, exportDay, type Plan, planOf, SHOWS_PER_DAY } from "@/lib/export-limit";
import { hasRole } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { billingConfigured, planPrice, planPriceId, proPriceId } from "@/lib/stripe";

/** What the "download limit reached" dialog shows. */
export type ExportLimitInfo = {
  error: "limit";
  plan: Plan;
  limit: number;
  /** Names of the trade shows already downloaded today. */
  used: string[];
  /** How many new trade shows the download would add. */
  needed: number;
  proLimit: number;
  /** The signed-in user may press Upgrade (owner, on the basic plan, with the upgraded price set up). */
  canUpgrade: boolean;
  /** Who to ask when the user can't upgrade themselves. */
  ownerName: string | null;
  /** Prices per user per month, e.g. "€49.00" and "€99.00". */
  basicPrice: string | null;
  proPrice: string | null;
};

type Account = Organization & { subscriptions: Subscription[] };

/** The account's plan, from its current subscription. */
export function accountPlan(organization: Account): Plan {
  return planOf(currentSubscription(organization.subscriptions)?.priceId, proPriceId());
}

async function priceText(id: string | undefined) {
  const price = id ? await planPrice(id) : null;
  return price?.amount != null ? formatMoney(price.amount, price.currency) : null;
}

/**
 * Checks that the user may download exhibitors from these trade shows today
 * and, if so, records them. Returns what the limit dialog needs when not.
 * There is no limit while payments aren't set up, and none for platform admins.
 */
export async function claimExport(
  user: User,
  role: Role,
  organization: Account,
  showIds: Iterable<string>,
): Promise<{ ok: true } | ExportLimitInfo> {
  if (!billingConfigured() || isPlatformAdmin(user.email)) return { ok: true };

  const plan = accountPlan(organization);
  const day = exportDay();
  const done = await db.exportedShow.findMany({ where: { userId: user.id, day }, select: { tradeShowId: true } });
  const check = checkExport(showIds, done.map((d) => d.tradeShowId), SHOWS_PER_DAY[plan]);
  if (check.ok) {
    if (check.newShows.length) {
      await db.exportedShow.createMany({
        data: check.newShows.map((tradeShowId) => ({ userId: user.id, tradeShowId, day })),
        skipDuplicates: true,
      });
    }
    return { ok: true };
  }

  const sub = currentSubscription(organization.subscriptions);
  const isOwner = hasRole(role, "OWNER");
  const [used, owner, basicPrice, proPrice] = await Promise.all([
    db.tradeShow.findMany({ where: { id: { in: check.used } }, select: { name: true }, orderBy: { name: "asc" } }),
    isOwner
      ? null
      : db.membership.findFirst({ where: { organizationId: organization.id, role: "OWNER" }, include: { user: { select: { name: true, email: true } } } }),
    priceText(planPriceId()),
    priceText(proPriceId()),
  ]);
  return {
    error: "limit",
    plan,
    limit: check.limit,
    used: used.map((s) => s.name),
    needed: check.needed.length,
    proLimit: SHOWS_PER_DAY.pro,
    canUpgrade: isOwner && plan === "basic" && Boolean(proPriceId()) && Boolean(sub && isLive(sub.status)),
    ownerName: owner ? (owner.user.name ?? owner.user.email) : null,
    basicPrice,
    proPrice,
  };
}
