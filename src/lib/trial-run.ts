import "server-only";
import { appUrl } from "@/lib/app-url";
import { currentSubscription, formatMoney, hasPaidAccess } from "@/lib/billing";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { billingConfigured, planPrice } from "@/lib/stripe";
import { trialEndedEmailContent } from "@/lib/trial";

/**
 * Emails the owners of each account whose free trial has ended and that has
 * not subscribed, once, with a link that opens Stripe's payment page for that
 * account. Accounts that subscribed during the trial get nothing.
 */
export async function runTrialEndedEmails() {
  if (!billingConfigured()) return { skipped: "Payments are not set up." };
  if (!isEmailConfigured()) return { skipped: "No email service is set up (RESEND_API_KEY and EMAIL_FROM)." };

  const organizations = await db.organization.findMany({
    where: { trialEndsAt: { lte: new Date() }, trialEndedEmailAt: null },
    include: {
      subscriptions: true,
      memberships: { where: { role: "OWNER" }, include: { user: { select: { email: true } } } },
    },
  });
  if (!organizations.length) return { sent: 0 };

  const price = await planPrice();
  const priceText = price?.amount != null ? formatMoney(price.amount, price.currency) : null;
  let sent = 0;
  for (const org of organizations) {
    if (!hasPaidAccess(currentSubscription(org.subscriptions))) {
      const mail = trialEndedEmailContent({ accountName: org.name, price: priceText, url: `${appUrl()}/a/${org.slug}/billing/checkout` });
      for (const owner of org.memberships) {
        try {
          await sendEmail({ to: owner.user.email, ...mail });
          sent++;
        } catch (error) {
          console.error(`Could not send the trial ended email for ${org.slug}`, error);
        }
      }
    }
    // Marked either way, so a paying account isn't emailed if it later cancels.
    await db.organization.update({ where: { id: org.id }, data: { trialEndedEmailAt: new Date() } });
  }
  return { accounts: organizations.length, sent };
}
