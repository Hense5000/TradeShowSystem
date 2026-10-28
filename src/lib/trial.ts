// Pure rules for the free trial. Kept free of Stripe and database access so
// they are easy to test.
//
// An account signed up on its own gets TRIAL_DAYS days to look around before
// it must subscribe. During the trial every page works, but nothing can be
// downloaded: no Excel, CSV or CRM files, no calendar file and no printing.
// When the trial is over the account is blocked like an unpaid one, and the
// owners get one email with a link to subscribe.

export const TRIAL_DAYS = 7;

/** What the "not part of the free trial" dialog shows when a download is tried. */
export type TrialLockInfo = { error: "trial"; canSubscribe: boolean };

const DAY = 24 * 60 * 60 * 1000;

/** When a trial started now ends. */
export function trialEnd(start = new Date()): Date {
  return new Date(start.getTime() + TRIAL_DAYS * DAY);
}

/** Whether the account is in its free trial right now. */
export function inTrial(trialEndsAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());
}

/** Whole days left of the trial, counting a started day as one: 7 right after sign-up, 1 on the last day. */
export function trialDaysLeft(trialEndsAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY));
}

/** "7 days left", "1 day left". */
export function daysLeftLabel(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The email to an account's owners when the trial has ended. */
export function trialEndedEmailContent({ accountName, price, url }: { accountName: string; price: string | null; url: string }) {
  const priceLine = price ? `The subscription is ${price} per user per month.` : "";
  return {
    subject: "Your free trial of Trade Show System has ended",
    text:
      `Thank you for trying Trade Show System with ${accountName}.\n\n` +
      `Your ${TRIAL_DAYS} day free trial has ended. Subscribe to keep using the system and to download exhibitor lists to Excel, CSV and your CRM.` +
      (priceLine ? ` ${priceLine}` : "") +
      `\n\nSubscribe here: ${url}\n\nEverything you saved during the trial, such as favorites and notes, is kept.`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">` +
      `<p>Thank you for trying Trade Show System with ${escape(accountName)}.</p>` +
      `<p>Your ${TRIAL_DAYS} day free trial has ended. Subscribe to keep using the system and to download exhibitor lists to Excel, CSV and your CRM.` +
      (priceLine ? ` ${escape(priceLine)}` : "") +
      `</p>` +
      `<p style="margin:16px 0"><a href="${escape(url)}" style="background:#287bbf;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:bold">Subscribe now</a></p>` +
      `<p style="color:#64748b">Everything you saved during the trial, such as favorites and notes, is kept.</p>` +
      `</div>`,
  };
}
