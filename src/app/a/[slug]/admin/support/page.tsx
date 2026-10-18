import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { supportNotifyEmail } from "@/lib/support";
import { requirePlatformAdmin } from "@/lib/tenant";
import { shortDate, TicketStatus } from "../../support/thread";

const FILTERS = { waiting: "Needs answer", open: "Open", closed: "Closed", all: "All" } as const;
type Filter = keyof typeof FILTERS;

function where(filter: Filter): Prisma.SupportTicketWhereInput {
  if (filter === "waiting") return { status: "OPEN", waitingOnSupport: true };
  if (filter === "open") return { status: "OPEN" };
  if (filter === "closed") return { status: "CLOSED" };
  return {};
}

export default async function SupportTicketsPage({ params, searchParams }: PageProps<"/a/[slug]/admin/support">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const sp = await searchParams;
  const filter: Filter = typeof sp.show === "string" && sp.show in FILTERS ? (sp.show as Filter) : "open";

  const [tickets, counts] = await Promise.all([
    db.supportTicket.findMany({
      where: where(filter),
      include: {
        organization: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 200,
    }),
    Promise.all((Object.keys(FILTERS) as Filter[]).map((f) => db.supportTicket.count({ where: where(f) }))),
  ]);

  return (
    <>
      <PageHeader
        title="Support"
        description={`Support requests from all customer accounts. New requests and replies are emailed to ${supportNotifyEmail()}.`}
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTERS) as Filter[]).map((f, i) => (
          <Link
            key={f}
            href={`/a/${slug}/admin/support?show=${f}`}
            className={f === filter ? "btn py-1.5" : "btn-secondary"}
            aria-current={f === filter ? "page" : undefined}
          >
            {FILTERS[f]} <span className="opacity-75">{counts[i]}</span>
          </Link>
        ))}
      </div>

      <section className="card overflow-hidden p-0">
        {tickets.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No support requests here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                <th className="px-5 py-2.5">Request</th>
                <th className="hidden px-5 py-2.5 md:table-cell">Account</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="hidden px-5 py-2.5 sm:table-cell">Last message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3">
                    <Link href={`/a/${slug}/admin/support/${t.id}`} className="font-semibold hover:text-brand">
                      {t.subject}
                    </Link>
                    <p className="text-xs text-muted">
                      <span className="md:hidden">{t.organization.name} · </span>
                      {t.createdBy ? (t.createdBy.name ?? t.createdBy.email) : "Former user"} · {t._count.messages}{" "}
                      {t._count.messages === 1 ? "message" : "messages"}
                    </p>
                  </td>
                  <td className="hidden px-5 py-3 md:table-cell">{t.organization.name}</td>
                  <td className="px-5 py-3">
                    <TicketStatus status={t.status} waitingOnSupport={t.waitingOnSupport} forSupport />
                  </td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">{shortDate(t.lastMessageAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
