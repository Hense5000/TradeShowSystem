// When someone makes another user in the account responsible for a favorite
// exhibitor, that user gets an email about it. This file holds the email text;
// the Favorites actions send it.

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The email to the user who was made responsible for a lead. */
export function leadAssignedEmailContent({
  assignedBy,
  accountName,
  exhibitor,
  tradeShow,
  url,
}: {
  assignedBy: string;
  accountName: string;
  exhibitor: string;
  tradeShow: string;
  url: string;
}) {
  const what = `${assignedBy} has made you responsible for ${exhibitor} in ${accountName}'s Favorites.`;
  return {
    subject: `You are now responsible for ${exhibitor}`,
    text: `${what}\n\nExhibitor: ${exhibitor}\nTrade show: ${tradeShow}\n\nSee your leads: ${url}`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">` +
      `<p>${escape(assignedBy)} has made you responsible for <strong>${escape(exhibitor)}</strong> in ${escape(accountName)}'s Favorites.</p>` +
      `<div style="border-left:3px solid #287bbf;padding:8px 12px;margin:12px 0;background:#f5f8fb">` +
      `<div style="font-weight:bold">${escape(exhibitor)}</div>` +
      `<div style="color:#64748b;font-size:12px">${escape(tradeShow)}</div>` +
      `</div>` +
      `<p style="margin:16px 0"><a href="${escape(url)}" style="background:#287bbf;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:bold">See your leads</a></p>` +
      `</div>`,
  };
}
