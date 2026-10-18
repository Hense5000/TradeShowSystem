import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { requireMembership } from "@/lib/tenant";
import { replyToTicket, setTicketStatus } from "../actions";
import { shortDate, Thread, TicketStatus } from "../thread";

export default async function TicketPage({ params }: PageProps<"/a/[slug]/support/[id]">) {
  const { slug, id } = await params;
  const { user, organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const ticket = await db.supportTicket.findFirst({
    where: { id, organizationId: organization.id },
    include: { messages: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!ticket) notFound();
  const closed = ticket.status === "CLOSED";

  return (
    <>
      <Link href={`/a/${slug}/support`} className="text-sm font-semibold text-muted hover:text-brand">
        ← All support requests
      </Link>
      <PageHeader
        title={ticket.subject}
        description={`Opened ${shortDate(ticket.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <TicketStatus status={ticket.status} waitingOnSupport={ticket.waitingOnSupport} forSupport={false} />
            <ActionForm action={setTicketStatus.bind(null, slug, ticket.id, closed ? "OPEN" : "CLOSED")}>
              <button className="btn-secondary">{closed ? "Open again" : "Close – it is solved"}</button>
            </ActionForm>
          </div>
        }
      />
      {closed && <p className="rounded-lg bg-brand-soft px-3 py-2.5 text-sm">This request is closed. Write a reply below to open it again.</p>}
      <Thread messages={ticket.messages} viewerId={user.id} forSupport={isPlatformAdmin(user.email)} reply={replyToTicket.bind(null, slug, ticket.id)} />
    </>
  );
}
