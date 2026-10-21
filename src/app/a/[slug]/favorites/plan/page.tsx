import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { countryName } from "@/lib/countries";
import { syncCompanyKeys } from "@/lib/company-run";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { favoriteRowsAt } from "@/lib/favorite-companies";
import { byBooth, LEAD_LABEL, LEAD_PILL } from "@/lib/leads";
import { requireMembership } from "@/lib/tenant";
import { showStatus, STATUS_LABEL, STATUS_PILL } from "@/lib/trade-shows";
import { PrintButton, VisitedBox } from "./visited-box";

// The meeting plan for one trade show: the account's favorite exhibitors at
// the show in booth order, to tick off on the show floor or print.
export default async function MeetingPlanPage({ params, searchParams }: PageProps<"/a/[slug]/favorites/plan">) {
  const { slug } = await params;
  const { organization } = await requireMembership(slug);
  const sp = await searchParams;
  const showId = typeof sp.show === "string" ? sp.show : "";
  const show = showId ? await db.tradeShow.findUnique({ where: { id: showId }, include: { center: { select: { name: true } } } }) : null;
  if (!show) notFound();

  // A favorite company is on the plan of every show it exhibits at, with its
  // booth at this show, though the favorite itself is its latest show's row.
  await syncCompanyKeys();
  const atShow = await favoriteRowsAt(organization.id, [show.id]);
  const ids = atShow.map((r) => r.id);
  const keys = [...new Set(atShow.flatMap((r) => (r.companyKey ? [r.companyKey] : [])))];
  const [exhibitors, items, visits] = await Promise.all([
    db.exhibitor.findMany({ where: { id: { in: ids } } }),
    db.savedListItem.findMany({
      where: { list: { organizationId: organization.id, favorites: true }, exhibitor: { OR: [{ id: { in: ids } }, { companyKey: { in: keys } }] } },
      include: { exhibitor: { select: { id: true, companyKey: true } }, assignee: { select: { name: true, email: true } } },
    }),
    db.boothVisit.findMany({
      where: { organizationId: organization.id, exhibitorId: { in: ids } },
      include: { visitedBy: { select: { name: true, email: true } } },
    }),
  ]);
  const company = (e: { id: string; companyKey: string | null }) => e.companyKey ?? e.id;
  const itemOf = new Map(items.map((i) => [company(i.exhibitor), i]));
  const visitOf = new Map(visits.map((v) => [v.exhibitorId, v]));
  // One row per company, also if it was imported twice for the show.
  const seen = new Set<string>();
  const rows = exhibitors
    .sort((a, b) => Number(itemOf.get(company(b))?.exhibitorId === b.id) - Number(itemOf.get(company(a))?.exhibitorId === a.id))
    .flatMap((e) => {
      const item = itemOf.get(company(e));
      if (!item || seen.has(company(e))) return [];
      seen.add(company(e));
      const visit = visitOf.get(e.id);
      return [{ ...item, exhibitor: e, visitedAt: visit?.visitedAt ?? null, visitedBy: visit?.visitedBy ?? null }];
    })
    .sort((a, b) => byBooth(a.exhibitor, b.exhibitor));
  const visitedCount = rows.filter((r) => r.visitedAt).length;
  const place = [show.center?.name, show.city, show.country && countryName(show.country)].filter(Boolean).join(" · ");
  const status = showStatus(show);

  return (
    <>
      <Link href={`/a/${slug}/favorites/trade-shows`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink print:hidden">
        <Icon name="chevron" className="size-4 rotate-90" /> Favorite trade shows
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">Meeting plan</p>
          <h1 className="page-title flex flex-wrap items-center gap-2">
            {show.name}
            <span className={`pill ${STATUS_PILL[status]} print:hidden`}>{STATUS_LABEL[status]}</span>
          </h1>
          <p className="mt-0.5 text-muted">{[formatDateRange(show.startDate, show.endDate), place].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold tabular-nums">
            {visitedCount} of {rows.length} visited
          </p>
          {rows.length > 0 && <PrintButton />}
        </div>
      </div>

      {rows.length === 0 ? (
        <section className="card flex flex-col items-center gap-2 py-12 text-center">
          <h2 className="font-bold">No favorite exhibitors at this show yet</h2>
          <p className="max-w-md text-sm text-muted">Star the exhibitors you want to meet on the Exhibitors page, and they show up here in booth order.</p>
          <Link href={`/a/${slug}/exhibitors?show=${show.id}`} className="btn mt-2">
            <Icon name="store" className="size-4" /> Go to exhibitors
          </Link>
        </section>
      ) : (
        <section className="card overflow-hidden p-0 print:border-0 print:shadow-none">
          <ul className="divide-y divide-line">
            {rows.map(({ exhibitor: e, leadStatus, leadNote, followUpNote, assignee, visitedAt, visitedBy }) => {
              const notes = [followUpNote, leadNote].filter(Boolean).join(" · ");
              return (
                <li key={e.id} className={`flex gap-3 px-4 py-3 break-inside-avoid sm:px-5 ${visitedAt ? "bg-subtle" : ""}`}>
                  <VisitedBox slug={slug} exhibitorId={e.id} name={e.name} visited={Boolean(visitedAt)} />
                  <div className="grid min-w-0 flex-1 gap-x-5 gap-y-1.5 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[6rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] print:grid-cols-[4.5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <p className="text-lg leading-6 font-bold tabular-nums">{e.boothNumber?.trim() || <span className="text-base font-normal text-faint">No booth</span>}</p>
                    <div className="min-w-0">
                      <p className={`font-semibold ${visitedAt ? "text-muted line-through" : ""}`}>{e.name}</p>
                      {(e.industry || e.country) && (
                        <p className="text-xs text-muted">{[e.industry, e.country && countryName(e.country)].filter(Boolean).join(" · ")}</p>
                      )}
                      {e.standLocationUrl && (
                        <a href={e.standLocationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline print:hidden">
                          <Icon name="pin" className="size-3.5" /> Find on floor plan
                        </a>
                      )}
                    </div>
                    <div className="min-w-0 text-sm">
                      {e.contactName ? <p className="font-medium">{e.contactName}</p> : <p className="text-faint">No contact</p>}
                      {e.contactTitle && <p className="text-xs text-muted">{e.contactTitle}</p>}
                      {e.phone && <a href={`tel:${e.phone.replace(/\s/g, "")}`} className="block text-xs text-muted hover:text-brand">{e.phone}</a>}
                      {e.email && <a href={`mailto:${e.email}`} className="block truncate text-xs font-medium text-brand hover:underline">{e.email}</a>}
                    </div>
                    <div className="min-w-0 text-sm md:col-start-2 md:col-end-4 lg:col-auto print:col-auto">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className={`pill ${LEAD_PILL[leadStatus]}`}>{LEAD_LABEL[leadStatus]}</span>
                        {assignee && <span className="text-xs text-muted">{assignee.name ?? assignee.email}</span>}
                      </p>
                      {notes && <p className="mt-1 line-clamp-3 text-xs text-muted print:line-clamp-none">{notes}</p>}
                      {visitedAt && visitedBy && (
                        <p className="mt-1 text-xs font-medium text-ok">
                          <Icon name="check" className="inline size-3.5" /> Visited by {visitedBy.name ?? visitedBy.email}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
