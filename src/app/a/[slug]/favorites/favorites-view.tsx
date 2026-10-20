import type { LeadStatus } from "@prisma/client";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { isCompanyProfileConfigured } from "@/lib/company-profile-run";
import { countryName } from "@/lib/countries";
import { formatDateRange, isoDate, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { defaultDraftLanguage } from "@/lib/email-draft";
import { favoriteFilters, favoriteQuery, favoriteWhere, followUpState, LEAD_LABEL, LEAD_PILL, LEAD_STATUSES } from "@/lib/leads";
import { recommendedShows } from "@/lib/show-recommendations-run";
import { requireMembership } from "@/lib/tenant";
import { showStatus, STATUS_LABEL, STATUS_PILL } from "@/lib/trade-shows";
import { FavoriteStar } from "../exhibitors/favorite-star";
import { FavoriteShowStar } from "../trade-shows/favorite-show-star";
import { EmailDraftButton } from "./email-draft";
import { LeadAssigneeSelect, LeadFollowUp, LeadNote, LeadStatusSelect } from "./lead-controls";
import { RecommendedShows } from "./recommended-shows";
import { SearchButton, SearchForm } from "@/components/search-form";

const PAGE_SIZE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

/** Favorites -> Exhibitors and Favorites -> Trade shows: the same page with the tabs on top, each tab its own menu sub-page. */
export async function FavoritesView({ slug, tab, sp }: { slug: string; tab: "exhibitors" | "shows"; sp: SearchParams }) {
  const { user, organization } = await requireMembership(slug);
  const filters = favoriteFilters(sp);
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const list = await db.savedList.findFirst({ where: { organizationId: organization.id, favorites: true }, select: { id: true } });
  const listId = list?.id ?? "";
  const day = today();
  const where = favoriteWhere(listId, filters, { today: day, userId: user.id });

  const [byStatus, shownCount, items, leadShows, favoriteShows, memberships, myCount, recommended] = await Promise.all([
    db.savedListItem.groupBy({ by: ["leadStatus"], where: { listId }, _count: true }),
    db.savedListItem.count({ where }),
    tab === "exhibitors"
      ? db.savedListItem.findMany({
          where,
          include: { exhibitor: { include: { tradeShow: { select: { id: true, name: true, startDate: true, endDate: true } } } } },
          // With a follow-up filter, the soonest follow-up first.
          orderBy: filters.followUp ? [{ followUpAt: "asc" }, { exhibitor: { name: "asc" } }] : [{ exhibitor: { name: "asc" } }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : [],
    // The trade shows of the favorite exhibitors, for the trade show filter and the counts on the Trade shows tab.
    db.exhibitor.groupBy({ by: ["tradeShowId"], where: { savedIn: { some: { listId } } }, _count: true }),
    db.favoriteShow.findMany({
      where: { organizationId: organization.id },
      include: { tradeShow: { include: { center: { select: { name: true } }, _count: { select: { exhibitors: true } } } } },
    }),
    // The users a lead can be assigned to.
    db.membership.findMany({ where: { organizationId: organization.id }, select: { user: { select: { id: true, name: true, email: true } } } }),
    db.savedListItem.count({ where: { listId, assigneeId: user.id } }),
    tab === "shows" ? recommendedShows(organization.id, day) : [],
  ]);
  const members = memberships
    .map((m) => ({ id: m.user.id, name: m.user.id === user.id ? `${m.user.name ?? m.user.email} (you)` : (m.user.name ?? m.user.email) }))
    .sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : a.name.localeCompare(b.name)));

  const statusCount = (s: LeadStatus) => byStatus.find((b) => b.leadStatus === s)?._count ?? 0;
  const exhibitorTotal = byStatus.reduce((sum, b) => sum + b._count, 0);
  const leadsAtShow = new Map(leadShows.map((s) => [s.tradeShowId, s._count]));
  const filterShows = await db.tradeShow.findMany({
    where: { id: { in: [...leadsAtShow.keys()] } },
    select: { id: true, name: true },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
  });

  // Upcoming and running shows first, soonest first; finished shows after them, latest first.
  const shows = favoriteShows
    .map((f) => ({ ...f.tradeShow, status: showStatus(f.tradeShow) }))
    .sort((a, b) => {
      const aDone = a.status === "finished";
      const bDone = b.status === "finished";
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (aDone ? -1 : 1) * (a.startDate.getTime() - b.startDate.getTime());
    });

  const fav = `/a/${slug}/favorites`;
  const base = `${fav}/exhibitors`;
  const canDraft = isCompanyProfileConfigured();
  const pages = Math.max(1, Math.ceil(shownCount / PAGE_SIZE));
  const narrowed = Boolean(filters.q || filters.show || filters.status || filters.followUp || filters.owner);
  const mine = tab === "exhibitors" && filters.owner === "me";
  const exportHref = (format: "xlsx" | "csv") => `/a/${slug}/exhibitors/export${favoriteQuery(filters, { list: listId, format })}`;
  const tabCls = "rounded-lg border px-3 py-1.5 text-sm font-semibold whitespace-nowrap";
  const tabOn = "border-brand bg-brand text-white";
  const tabOff = "border-line-strong bg-surface text-ink hover:bg-subtle";

  return (
    <>
      <PageHeader
        title={tab === "shows" ? "Favorite trade shows" : "Favorite exhibitors"}
        description={`The ${tab === "shows" ? "trade shows" : "exhibitors"} you have starred. Everyone in ${organization.name} works the same favorites.`}
        action={
          tab === "exhibitors" &&
          shownCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.show && (
                <Link href={`${fav}/plan?show=${filters.show}`} className="btn-secondary py-2" title="The favorite exhibitors at this show in booth order, to tick off at the show">
                  <Icon name="check" className="size-4" /> Meeting plan
                </Link>
              )}
              <a href={exportHref("xlsx")} download className="btn-secondary py-2" title={`Download the ${shownCount} exhibitors shown, with status and notes, as an Excel file`}>
                <Icon name="download" className="size-4" /> Excel
              </a>
              <a href={exportHref("csv")} download className="btn-secondary py-2" title={`Download the ${shownCount} exhibitors shown, with status and notes, as a CSV file`}>
                <Icon name="download" className="size-4" /> CSV
              </a>
              <a
                href={`/a/${slug}/exhibitors/export${favoriteQuery(filters, { list: listId, format: "xlsx", layout: "crm" })}`}
                download
                className="btn-secondary py-2"
                title={`Download the ${shownCount} leads shown as an Excel file ready to import into a CRM such as HubSpot, Pipedrive or Salesforce`}
              >
                <Icon name="download" className="size-4" /> Export for CRM
              </a>
            </div>
          )
        }
      />

      <nav className="flex flex-wrap gap-2" aria-label="Favorites">
        <Link href={base} aria-current={tab === "exhibitors" && !mine ? "page" : undefined} className={`${tabCls} ${tab === "exhibitors" && !mine ? tabOn : tabOff}`}>
          Exhibitors · {exhibitorTotal}
        </Link>
        <Link href={`${base}?owner=me`} aria-current={mine ? "page" : undefined} className={`${tabCls} ${mine ? tabOn : tabOff}`}>
          My leads · {myCount}
        </Link>
        <Link href={`${fav}/trade-shows`} aria-current={tab === "shows" ? "page" : undefined} className={`${tabCls} ${tab === "shows" ? tabOn : tabOff}`}>
          Trade shows · {shows.length}
        </Link>
      </nav>

      {tab === "exhibitors" ? (
        exhibitorTotal === 0 ? (
          <Empty
            icon="store"
            text="Click the star next to an exhibitor on the Exhibitors page to add it here. Then follow up on it with a status and notes."
            href={`/a/${slug}/exhibitors`}
            label="Go to exhibitors"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {LEAD_STATUSES.map((s) => {
                const on = filters.status === s;
                return (
                  <Link
                    key={s}
                    href={`${base}${favoriteQuery({ ...filters, status: on ? "" : s })}`}
                    aria-current={on ? "true" : undefined}
                    className={`card flex items-center justify-between gap-2 px-4 py-3 ${on ? "border-brand ring-3 ring-brand-soft" : "hover:border-brand"}`}
                  >
                    <span className={`pill ${LEAD_PILL[s]}`}>{LEAD_LABEL[s]}</span>
                    <span className="text-xl font-bold tabular-nums">{statusCount(s)}</span>
                  </Link>
                );
              })}
            </div>

            <section className="card overflow-hidden p-0">
              <SearchForm className="flex flex-wrap items-center gap-2 p-4">
                <div className="relative min-w-56 flex-1">
                  <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
                  <input className="input pl-9" name="q" defaultValue={filters.q} placeholder="Search by company, contact or industry" aria-label="Search favorites" />
                </div>
                <select className="input w-auto max-w-72" name="show" defaultValue={filters.show} aria-label="Trade show">
                  <option value="">All trade shows</option>
                  {filterShows.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select className="input w-auto" name="status" defaultValue={filters.status} aria-label="Status">
                  <option value="">All statuses</option>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>{LEAD_LABEL[s]}</option>
                  ))}
                </select>
                <select className="input w-auto max-w-56" name="owner" defaultValue={filters.owner} aria-label="Responsible">
                  <option value="">Everyone's leads</option>
                  <option value="me">My leads</option>
                  <option value="none">Unassigned</option>
                  {members
                    .filter((m) => m.id !== user.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                <select className="input w-auto" name="followup" defaultValue={filters.followUp} aria-label="Follow-up">
                  <option value="">All follow-ups</option>
                  <option value="due">Due today or overdue</option>
                  <option value="set">With a follow-up date</option>
                </select>
                <SearchButton />
                {narrowed && (
                  <Link href={base} className="px-2 text-sm font-semibold text-muted hover:text-ink">
                    Show all
                  </Link>
                )}
              </SearchForm>
              <p className="border-t border-line px-5 py-2.5 text-sm text-muted">
                {narrowed ? `Showing ${shownCount} of ${exhibitorTotal} favorite exhibitors` : `${exhibitorTotal} favorite ${exhibitorTotal === 1 ? "exhibitor" : "exhibitors"}`}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                      <th className="px-5 py-2.5">Company</th>
                      <th className="px-5 py-2.5">Trade show</th>
                      <th className="px-5 py-2.5">Contact</th>
                      <th className="px-5 py-2.5">Lead</th>
                      <th className="px-5 py-2.5">Notes</th>
                      <th className="px-5 py-2.5"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map(({ exhibitor: e, leadStatus, leadNote, followUpAt, followUpNote, assigneeId }) => (
                      <tr key={e.id} className="align-top">
                        <td className="px-5 py-3">
                          <div className="min-w-48">
                            {e.companyKey ? (
                              <Link href={`/a/${slug}/exhibitors/company?key=${encodeURIComponent(e.companyKey)}`} className="block font-semibold hover:text-brand">
                                {e.name}
                              </Link>
                            ) : (
                              <p className="font-semibold">{e.name}</p>
                            )}
                            {(e.industry || e.country) && (
                              <p className="text-xs text-muted">{[e.industry, e.country && countryName(e.country)].filter(Boolean).join(" · ")}</p>
                            )}
                            {e.website && (
                              <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand hover:underline">
                                {e.website.replace(/^https?:\/\/(www\.)?/, "")}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="min-w-40">
                            <Link href={`${base}${favoriteQuery({ ...filters, show: e.tradeShow.id })}`} className="font-medium hover:text-brand" title="Show only this trade show">
                              {e.tradeShow.name}
                            </Link>
                            <p className="text-xs whitespace-nowrap text-muted tabular-nums">
                              {formatDateRange(e.tradeShow.startDate, e.tradeShow.endDate)}
                              {e.boothNumber && ` · Booth ${e.boothNumber}`}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="min-w-44">
                            {e.contactName ? <p className="font-medium">{e.contactName}</p> : <span className="text-faint">—</span>}
                            {e.contactTitle && <p className="text-xs text-muted">{e.contactTitle}</p>}
                            {e.email && <a href={`mailto:${e.email}`} className="block text-xs font-medium text-brand hover:underline">{e.email}</a>}
                            {e.phone && <a href={`tel:${e.phone.replace(/\s/g, "")}`} className="block text-xs text-muted hover:text-brand">{e.phone}</a>}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-1.5">
                            <LeadAssigneeSelect slug={slug} exhibitorId={e.id} name={e.name} assigneeId={assigneeId} members={members} />
                            <LeadStatusSelect slug={slug} exhibitorId={e.id} name={e.name} status={leadStatus} />
                            <LeadFollowUp
                              key={`${followUpAt ? isoDate(followUpAt) : ""}:${followUpNote ?? ""}`}
                              slug={slug}
                              exhibitorId={e.id}
                              name={e.name}
                              date={followUpAt ? isoDate(followUpAt) : ""}
                              note={followUpNote}
                              overdue={followUpAt ? followUpState(followUpAt, day) === "overdue" : false}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <LeadNote key={leadNote ?? ""} slug={slug} exhibitorId={e.id} name={e.name} note={leadNote} />
                          {canDraft && <EmailDraftButton slug={slug} exhibitorId={e.id} name={e.name} email={e.email} language={defaultDraftLanguage(e.country)} />}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end">
                            <FavoriteStar slug={slug} exhibitorIds={e.id} name={e.name} on />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-muted">
                          No favorites match. <Link href={base} className="font-semibold text-brand">Show all</Link>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-sm" aria-label="Pages">
                  {page > 1 ? (
                    <Link href={`${base}${favoriteQuery(filters, page > 2 ? { page: String(page - 1) } : {})}`} className="btn-secondary">Previous</Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-muted">Page {page} of {pages}</span>
                  {page < pages ? <Link href={`${base}${favoriteQuery(filters, { page: String(page + 1) })}`} className="btn-secondary">Next</Link> : <span />}
                </nav>
              )}
            </section>
          </>
        )
      ) : (
        <>
          {exhibitorTotal > 0 && <RecommendedShows slug={slug} items={recommended} />}
          {shows.length === 0 ? (
            <Empty icon="calendar" text="Click the star next to a trade show on the Trade shows page to add it here." href={`/a/${slug}/trade-shows`} label="Go to trade shows" />
          ) : (
            <section className="card">
              <ul className="flex flex-col gap-2.5">
                {shows.map((s) => {
                  const place = [s.center?.name, s.city, s.country && countryName(s.country)].filter(Boolean).join(" · ");
                  const leads = leadsAtShow.get(s.id) ?? 0;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line px-4 py-3">
                      <FavoriteShowStar slug={slug} tradeShowId={s.id} name={s.name} on />
                      <div className="min-w-48 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {s.name}
                          <span className={`pill ${STATUS_PILL[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                        </p>
                        {place && <p className="mt-0.5 text-sm text-muted">{place}</p>}
                      </div>
                      <div className="w-24 text-center">
                        <p className="text-xs text-muted">Exhibitors</p>
                        {s._count.exhibitors > 0 ? (
                          <Link href={`/a/${slug}/exhibitors?show=${s.id}`} className="font-bold tabular-nums text-brand hover:underline">
                            {s._count.exhibitors}
                          </Link>
                        ) : (
                          <p className="font-bold tabular-nums">0</p>
                        )}
                      </div>
                      <div className="w-24 text-center">
                        <p className="text-xs text-muted">Favorites</p>
                        {leads > 0 ? (
                          <Link href={`${base}?show=${s.id}`} className="font-bold tabular-nums text-brand hover:underline">
                            {leads}
                          </Link>
                        ) : (
                          <p className="font-bold tabular-nums">0</p>
                        )}
                      </div>
                      <div className="w-28">
                        {leads > 0 && (
                          <Link href={`${fav}/plan?show=${s.id}`} className="pill pill-soft gap-1 hover:underline" title="Your favorite exhibitors at this show in booth order, to tick off at the show">
                            <Icon name="check" className="size-3.5" /> Meeting plan
                          </Link>
                        )}
                      </div>
                      <div className="w-20">
                        {s.website && (
                          <a href={s.website} target="_blank" rel="noopener noreferrer" className="pill pill-soft gap-1 hover:underline">
                            <Icon name="globe" className="size-3.5" /> Website
                          </a>
                        )}
                      </div>
                      <p className="w-44 text-right text-sm font-semibold whitespace-nowrap tabular-nums">{formatDateRange(s.startDate, s.endDate)}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

function Empty({ icon, text, href, label }: { icon: "store" | "calendar"; text: string; href: string; label: string }) {
  return (
    <section className="card flex flex-col items-center gap-2 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon name="star" className="size-6" />
      </span>
      <h2 className="mt-1 font-bold">No favorites yet</h2>
      <p className="max-w-md text-sm text-muted">{text}</p>
      <Link href={href} className="btn mt-2">
        <Icon name={icon} className="size-4" /> {label}
      </Link>
    </section>
  );
}
