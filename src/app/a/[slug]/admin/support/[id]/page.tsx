import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { answerTicket, setAnyTicketStatus } from "../../../support/actions";
import { shortDate, Thread, TicketStatus } from "../../../support/thread";

export default async function SupportTicketPage({ params }: PageProps<"/a/[slug]/admin/support/[id]">) {
  const { slug, id } = await params;
  const { user } = await requirePlatformAdmin(slug);
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true, slug: true } },
      createdBy: { select: { name: true, email: true } },
      messages: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) notFound();
  const closed = ticket.status === "CLOSED";
  const from = ticket.createdBy ? `${ticket.createdBy.name ? `${ticket.createdBy.name}, ` : ""}${ticket.createdBy.email}` : "a former user";

  return (
    <>
      <Link href={`/a/${slug}/admin/support`} className="text-sm font-semibold text-muted hover:text-brand">
        ← All support requests
      </Link>
      <PageHeader
        title={ticket.subject}
        description={`From ${from} at ${ticket.organization.name} · opened ${shortDate(ticket.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <TicketStatus status={ticket.status} waitingOnSupport={ticket.waitingOnSupport} forSupport />
            <ActionForm action={setAnyTicketStatus.bind(null, slug, ticket.id, closed ? "OPEN" : "CLOSED")}>
              <button className="btn-secondary">{closed ? "Open again" : "Close"}</button>
            </ActionForm>
          </div>
        }
      />
      <Thread messages={ticket.messages} viewerId={user.id} forSupport reply={answerTicket.bind(null, slug, ticket.id)} />
    </>
  );
}
