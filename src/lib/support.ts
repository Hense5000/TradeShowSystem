// Support tickets: customers write to the platform admins in a simple thread.
// This file holds the rules and the email texts; support-run.ts sends them.

export const MAX_SUPPORT_SUBJECT = 150;
export const MAX_SUPPORT_MESSAGE = 5000;

/** Where new tickets and customer replies are announced: SUPPORT_NOTIFY_EMAIL, or Henrik's address. */
export function supportNotifyEmail(value = process.env.SUPPORT_NOTIFY_EMAIL): string {
  return (value ?? "").trim() || "henrik1000@gmail.com";
}

/** Checks a new ticket's subject and message; an error text, or the cleaned values. */
export function checkTicket(subject: unknown, body: unknown): { error: string } | { subject: string; body: string } {
  const s = typeof subject === "string" ? subject.trim().replace(/\s+/g, " ") : "";
  if (!s) return { error: "Write a subject." };
  if (s.length > MAX_SUPPORT_SUBJECT) return { error: `The subject can be at most ${MAX_SUPPORT_SUBJECT} characters.` };
  const message = checkMessage(body);
  if ("error" in message) return message;
  return { subject: s, body: message.body };
}

/** Checks a message in a ticket's thread. */
export function checkMessage(body: unknown): { error: string } | { body: string } {
  const b = typeof body === "string" ? body.replace(/\r\n/g, "\n").trim() : "";
  if (!b) return { error: "Write a message." };
  if (b.length > MAX_SUPPORT_MESSAGE) return { error: `The message can be at most ${MAX_SUPPORT_MESSAGE} characters.` };
  return { body: b };
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function message(body: string) {
  return `<div style="border-left:3px solid #287bbf;padding:8px 12px;margin:12px 0;background:#f5f8fb;white-space:pre-wrap">${escape(body)}</div>`;
}

function button(url: string, label: string) {
  return `<p style="margin:16px 0"><a href="${escape(url)}" style="background:#287bbf;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:bold">${escape(label)}</a></p>`;
}

/** The email to support about a new ticket, or a customer's new reply in one. */
export function supportNotifyEmailContent({
  accountName,
  author,
  subject,
  body,
  url,
  isReply,
}: {
  accountName: string;
  author: string;
  subject: string;
  body: string;
  url: string;
  isReply: boolean;
}) {
  const what = isReply ? `New reply from ${author} (${accountName})` : `New support request from ${author} (${accountName})`;
  return {
    subject: `${isReply ? "Reply" : "Support"}: ${subject} – ${accountName}`,
    text: `${what}\n\n${subject}\n\n${body}\n\nOpen the ticket: ${url}`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">` +
      `<p>${escape(what)}</p>` +
      `<p style="font-weight:bold;font-size:16px;margin:0">${escape(subject)}</p>` +
      message(body) +
      button(url, "Open the ticket") +
      `</div>`,
  };
}

/** The email to the customer when support has answered their ticket. */
export function supportReplyEmailContent({ subject, body, url }: { subject: string; body: string; url: string }) {
  return {
    subject: `Re: ${subject}`,
    text: `Trade Show System support has answered your request "${subject}":\n\n${body}\n\nRead and reply: ${url}`,
    html:
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">` +
      `<p>Trade Show System support has answered your request <strong>${escape(subject)}</strong>:</p>` +
      message(body) +
      button(url, "Read and reply") +
      `</div>`,
  };
}
