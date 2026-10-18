"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-form";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { checkMessage, checkTicket } from "@/lib/support";
import { notifyCustomer, notifySupport } from "@/lib/support-run";
import { requireMembership, requirePlatformAdmin } from "@/lib/tenant";

// Support works without a paid subscription, so a blocked customer can still
// ask for help. Customers reach only their own account's tickets; the
// platform admin actions further down reach every account's.

function refresh(slug: string) {
  revalidatePath(`/a/${slug}`, "layout"); // the sidebar counts the tickets waiting for support
}

/** A customer opens a new ticket. Support gets an email with a link to it. */
export async function createTicket(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const checked = checkTicket(formData.get("subject"), formData.get("body"));
  if ("error" in checked) return checked;

  const ticket = await db.supportTicket.create({
    data: {
      organizationId: organization.id,
      createdById: user.id,
      subject: checked.subject,
      messages: { create: { authorId: user.id, body: checked.body } },
    },
  });
  await notifySupport(ticket.id, user.name ?? user.email, checked.body, false);
  refresh(slug);
  redirect(`/a/${slug}/support/${ticket.id}`);
}

/** A customer writes in their ticket's thread. A closed ticket opens again. */
export async function replyToTicket(slug: string, ticketId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const checked = checkMessage(formData.get("body"));
  if ("error" in checked) return checked;
  const ticket = await db.supportTicket.findFirst({ where: { id: ticketId, organizationId: organization.id }, select: { id: true } });
  if (!ticket) return { error: "This support request no longer exists." };

  // A platform admin looking at a customer's own page answers as support.
  const asSupport = isPlatformAdmin(user.email);
  await addMessage(ticket.id, user.id, checked.body, asSupport);
  if (asSupport) await notifyCustomer(ticket.id, checked.body);
  else await notifySupport(ticket.id, user.name ?? user.email, checked.body, true);
  refresh(slug);
  return undefined;
}

/** A customer closes their ticket when it is solved, or opens it again. */
export async function setTicketStatus(slug: string, ticketId: string, status: "OPEN" | "CLOSED"): Promise<ActionState> {
  const { organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  await db.supportTicket.updateMany({ where: { id: ticketId, organizationId: organization.id }, data: { status } });
  refresh(slug);
  return undefined;
}

/** Support answers a ticket from any account. The customer gets an email. */
export async function answerTicket(slug: string, ticketId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePlatformAdmin(slug);
  const checked = checkMessage(formData.get("body"));
  if ("error" in checked) return checked;
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) return { error: "This support request no longer exists." };

  await addMessage(ticket.id, user.id, checked.body, true);
  await notifyCustomer(ticket.id, checked.body);
  refresh(slug);
  return undefined;
}

/** Support closes a ticket, or opens it again. */
export async function setAnyTicketStatus(slug: string, ticketId: string, status: "OPEN" | "CLOSED"): Promise<ActionState> {
  await requirePlatformAdmin(slug);
  await db.supportTicket.updateMany({ where: { id: ticketId }, data: { status } });
  refresh(slug);
  return undefined;
}

async function addMessage(ticketId: string, authorId: string, body: string, fromSupport: boolean) {
  const now = new Date();
  await db.$transaction([
    db.supportMessage.create({ data: { ticketId, authorId, body, fromSupport, createdAt: now } }),
    // Writing in a ticket opens it again, so a closed ticket doesn't hide a new question.
    db.supportTicket.update({ where: { id: ticketId }, data: { status: "OPEN", waitingOnSupport: !fromSupport, lastMessageAt: now } }),
  ]);
}
