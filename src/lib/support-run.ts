import "server-only";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { supportNotifyEmail, supportNotifyEmailContent, supportReplyEmailContent } from "@/lib/support";

/** A link to the ticket that works for both the customer and support; /support/<id> sends each to their own page. */
export function ticketUrl(ticketId: string): string {
  return `${appUrl()}/support/${ticketId}`;
}

// A failed email must not lose the message, which is already saved, so
// errors are only logged.

/** Tells support about a new ticket or a customer's reply. */
export async function notifySupport(ticketId: string, author: string, body: string, isReply: boolean) {
  if (!isEmailConfigured()) return;
  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    include: { organization: { select: { name: true } } },
  });
  if (!ticket) return;
  try {
    await sendEmail({
      to: supportNotifyEmail(),
      ...supportNotifyEmailContent({
        accountName: ticket.organization.name,
        author,
        subject: ticket.subject,
        body,
        url: ticketUrl(ticket.id),
        isReply,
      }),
    });
  } catch (e) {
    console.error("Support notification failed", e);
  }
}

/** Tells the customer who opened the ticket (or the account owners, if they are gone) that support answered. */
export async function notifyCustomer(ticketId: string, body: string) {
  if (!isEmailConfigured()) return;
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, include: { createdBy: { select: { email: true } } } });
  if (!ticket) return;
  const to = ticket.createdBy
    ? [ticket.createdBy.email]
    : (
        await db.membership.findMany({
          where: { organizationId: ticket.organizationId, role: "OWNER" },
          include: { user: { select: { email: true } } },
        })
      ).map((m) => m.user.email);
  for (const email of to) {
    try {
      await sendEmail({ to: email, ...supportReplyEmailContent({ subject: ticket.subject, body, url: ticketUrl(ticket.id) }) });
    } catch (e) {
      console.error("Support reply email failed", e);
    }
  }
}
