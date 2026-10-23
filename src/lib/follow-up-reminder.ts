// On the day a follow-up reminder on a favorite exhibitor is due, the user
// responsible for that exhibitor gets an email about it. This file holds the
// email text; the morning list digest run sends it.

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type ReminderLead = { exhibitor: string; tradeShow: string; note: string | null };

/** The email to a user with one or more of their leads' follow-ups due today. */
export function followUpReminderEmail({ accountName, leads, url }: { accountName: string; leads: ReminderLead[]; url: string }) {
  const subject =
    leads.length === 1 ? `Reminder today: ${leads[0].note ?? "Follow up"} – ${leads[0].exhibitor}` : `Reminder today: ${leads.length} follow-ups`;
  const intro =
    leads.length === 1
      ? `You have a follow-up today on a lead you are responsible for in ${accountName}'s Favorites.`
      : `You have ${leads.length} follow-ups today on leads you are responsible for in ${accountName}'s Favorites.`;
  return {
    subject,
    text:
      `${intro}\n\n` +
      leads.map((l) => `${l.exhibitor} (${l.tradeShow})${l.note ? `\nReminder: ${l.note}` : ""}`).join("\n\n") +
      `\n\nSee your leads: ${url}`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">` +
      `<p>${escape(intro)}</p>` +
      leads
        .map(
          (l) =>
            `<div style="border-left:3px solid #287bbf;padding:8px 12px;margin:12px 0;background:#f5f8fb">` +
            `<div style="font-weight:bold">${escape(l.exhibitor)}</div>` +
            `<div style="color:#64748b;font-size:12px">${escape(l.tradeShow)}</div>` +
            (l.note ? `<div style="margin-top:4px">${escape(l.note)}</div>` : "") +
            `</div>`,
        )
        .join("") +
      `<p style="margin:16px 0"><a href="${escape(url)}" style="background:#287bbf;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:bold">See your leads</a></p>` +
      `</div>`,
  };
}
