import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { requireUser } from "@/lib/tenant";

// The link in support emails. It sends support to the ticket in the Super
// admin pages and a customer to it in their own account.
export default async function SupportLinkPage({ params }: PageProps<"/support/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/support/${id}`);
  const ticket = await db.supportTicket.findUnique({ where: { id }, select: { id: true, organizationId: true, organization: { select: { slug: true } } } });
  if (!ticket) notFound();

  if (isPlatformAdmin(user.email)) {
    const own = await db.membership.findFirst({ where: { userId: user.id }, include: { organization: { select: { slug: true } } }, orderBy: { createdAt: "asc" } });
    if (own) redirect(`/a/${own.organization.slug}/admin/support/${ticket.id}`);
  }
  const member = await db.membership.findFirst({ where: { userId: user.id, organizationId: ticket.organizationId }, select: { id: true } });
  if (!member) notFound();
  redirect(`/a/${ticket.organization.slug}/support/${ticket.id}`);
}
