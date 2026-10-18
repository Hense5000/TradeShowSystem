import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { MAX_SUPPORT_MESSAGE, MAX_SUPPORT_SUBJECT } from "@/lib/support";
import { requireMembership } from "@/lib/tenant";
import { createTicket } from "./actions";
import { shortDate, TicketStatus } from "./thread";

export default async function SupportPage({ params }: PageProps<"/a/[slug]/support">) {
  const { slug } = await params;
  const { organization } = await requireMembership(slug, "MEMBER", { allowUnpaid: true });
  const tickets = await db.supportTicket.findMany({
    where: { organizationId: organization.id },
    include: { createdBy: { select: { name: true, email: true } }, _count: { select: { messages: true } } },
    orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
  });

  return (
    <>
      <PageHeader title="Support" description={`Questions or problems? Write to us here. Everyone in ${organization.name} sees the account's support requests.`} />

      <section className="card">
        <h2 className="font-bold">New support request</h2>
        <p className="mt-0.5 text-sm text-muted">We get an email right away and answer here. You get an email when we do.</p>
        <ActionForm action={createTicket.bind(null, slug)} className="mt-4 flex flex-col gap-3">
          <div>
            <label htmlFor="subject" className="label">Subject</label>
            <input id="subject" name="subject" className="input" required maxLength={MAX_SUPPORT_SUBJECT} placeholder="For example: The exhibitor import stops" />
          </div>
          <div>
            <label htmlFor="body" className="label">Message</label>
            <textarea id="body" name="body" className="input resize-y leading-relaxed" rows={5} required maxLength={MAX_SUPPORT_MESSAGE} placeholder="What happened, and on which page?" />
          </div>
          <div>
            <button className="btn">
              <Icon name="mail" className="size-4" /> Send request
            </button>
          </div>
        </ActionForm>
      </section>

      {tickets.length > 0 && (
        <section className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                <th className="px-5 py-2.5">Request</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="hidden px-5 py-2.5 sm:table-cell">Last message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3">
                    <Link href={`/a/${slug}/support/${t.id}`} className="font-semibold hover:text-brand">
                      {t.subject}
                    </Link>
                    <p className="text-xs text-muted">
                      {t.createdBy ? (t.createdBy.name ?? t.createdBy.email) : "Former user"} · {t._count.messages}{" "}
                      {t._count.messages === 1 ? "message" : "messages"}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <TicketStatus status={t.status} waitingOnSupport={t.waitingOnSupport} forSupport={false} />
                  </td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">{shortDate(t.lastMessageAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
