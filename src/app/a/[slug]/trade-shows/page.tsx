import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { countryName, isCountryCode } from "@/lib/countries";
import { formatDateRange, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { isExhibitorFetchConfigured, withoutExhibitorsWhere } from "@/lib/exhibitor-fetch-run";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { requireMembership } from "@/lib/tenant";
import { showStatus, STATUS_LABEL, STATUS_PILL } from "@/lib/trade-shows";
import { isOrganizerFinderConfigured, missingOrganizerWhere } from "@/lib/organizer-finder-run";
import { FavoriteShowStar } from "./favorite-show-star";
import { FetchAllCard } from "./fetch-all-card";
import { OrganizerCard } from "./organizer-card";
import { SearchButton, SearchForm } from "@/components/search-form";

// "Fetch exhibitors for all" reads one page of an exhibitor directory per call to this page.
export const maxDuration = 300;

// "" (the default) hides finished shows, which is what people look for most.
const VIEWS = [
  { value: "", label: "Upcoming and running" },
  { value: "upcoming", label: "Upcoming" },
  { value: "running", label: "Running" },
  { value: "finished", label: "Finished" },
  { value: "all", label: "All trade shows" },
] as const;
type View = (typeof VIEWS)[number]["value"];

function whereForView(view: View, day: Date): Prisma.TradeShowWhereInput {
  switch (view) {
    case "upcoming":
      return { startDate: { gt: day } };
    case "running":
      return { startDate: { lte: day }, endDate: { gte: day } };
    case "finished":
      return { endDate: { lt: day } };
    case "all":
      return {};
    default:
      return { endDate: { gte: day } };
  }
}

function LinkOut({ href, icon, children }: { href: string; icon: "globe" | "store"; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-brand hover:underline">
      <Icon name={icon} className="size-4" /> {children}
    </a>
  );
}

export default async function TradeShowsPage({ params, searchParams }: PageProps<"/a/[slug]/trade-shows">) {
  const { slug } = await params;
  const { user, organization } = await requireMembership(slug);
  const canEdit = isPlatformAdmin(user.email);

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const country = typeof sp.country === "string" && isCountryCode(sp.country) ? sp.country : "";
  const view: View = VIEWS.find((v) => v.value === sp.view)?.value ?? "";
  const day = today();

  const where: Prisma.TradeShowWhereInput = {
    ...whereForView(view, day),
    ...(country && { country }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { organizer: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const useAi = canEdit && isExhibitorFetchConfigured();
  const [shows, total, countries, withoutExhibitors, withoutOrganizer, favorites] = await Promise.all([
    db.tradeShow.findMany({
      where,
      include: { center: { select: { name: true } }, organizer: { select: { id: true, name: true } }, _count: { select: { exhibitors: true } } },
      // Finished shows: most recent first. Everything else: soonest first.
      orderBy: view === "finished" ? [{ startDate: "desc" }, { name: "asc" }] : [{ startDate: "asc" }, { name: "asc" }],
    }),
    db.tradeShow.count(),
    db.tradeShow.findMany({ where: { country: { not: null } }, distinct: ["country"], select: { country: true } }),
    useAi ? db.tradeShow.count({ where: withoutExhibitorsWhere(day) }) : 0,
    canEdit && isOrganizerFinderConfigured() ? db.tradeShow.count({ where: missingOrganizerWhere }) : 0,
    db.favoriteShow.findMany({ where: { organizationId: organization.id }, select: { tradeShowId: true } }),
  ]);
  const favoriteIds = new Set(favorites.map((f) => f.tradeShowId));
  const countryOptions = countries
    .map((c) => c.country!)
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const narrowed = Boolean(q || country || view !== "all");

  return (
    <>
      <PageHeader
        title="Trade shows"
        description="Trade shows around the world, shared by every account."
        action={
          canEdit && (
            <div className="flex gap-2">
              <Link href={`/a/${slug}/trade-shows/import`} className="btn-secondary py-2">
                <Icon name="upload" className="size-4" /> Import
              </Link>
              <Link href={`/a/${slug}/trade-shows/new`} className="btn">
                <Icon name="plus" className="size-4" /> Add trade show
              </Link>
            </div>
          )
        }
      />

      {withoutExhibitors > 0 && <FetchAllCard slug={slug} missing={withoutExhibitors} />}
      {withoutOrganizer > 0 && <OrganizerCard slug={slug} missing={withoutOrganizer} />}

      {total === 0 ? (
        <section className="card flex flex-col items-center gap-2 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon name="calendar" className="size-6" />
          </span>
          <h2 className="mt-1 font-bold">No trade shows yet</h2>
          <p className="text-sm text-muted">
            {canEdit ? "Add the first trade show, or import a list you already have." : "Trade shows will show up here once they are added."}
          </p>
          {canEdit && (
            <Link href={`/a/${slug}/trade-shows/new`} className="btn mt-2">
              <Icon name="plus" className="size-4" /> Add trade show
            </Link>
          )}
        </section>
      ) : (
        <section className="card overflow-hidden p-0">
          <SearchForm className="flex flex-wrap items-center gap-2 p-4">
            <div className="relative min-w-56 flex-1">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input className="input pl-9" name="q" defaultValue={q} placeholder="Search by name, city or organizer" aria-label="Search trade shows" />
            </div>
            <select className="input w-auto" name="view" defaultValue={view} aria-label="Status">
              {VIEWS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
            <select className="input w-auto" name="country" defaultValue={country} aria-label="Country">
              <option value="">All countries</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <SearchButton />
            {narrowed && (
              <Link href={`/a/${slug}/trade-shows?view=all`} className="px-2 text-sm font-semibold text-muted hover:text-ink">
                Show all
              </Link>
            )}
          </SearchForm>
          <p className="border-t border-line px-5 py-2.5 text-sm text-muted">
            {view === "all" && !q && !country
              ? `${total} ${total === 1 ? "trade show" : "trade shows"}`
              : `Showing ${shows.length} of ${total} trade shows`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-5 py-2.5">Dates</th>
                  <th className="px-5 py-2.5">Where</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Links</th>
                  <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shows.map((s) => {
                  const status = showStatus(s);
                  const place = [s.city, s.country && countryName(s.country)].filter(Boolean).join(", ");
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3">
                        <div className="flex min-w-44 items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                            <Icon name="calendar" className="size-4" />
                          </span>
                          <div>
                            <p className="font-semibold">{s.name}</p>
                            {s.organizer && (
                              <Link href={`/a/${slug}/organizers/${s.organizer.id}`} className="text-xs text-muted hover:text-brand hover:underline">
                                {s.organizer.name}
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums">{formatDateRange(s.startDate, s.endDate)}</td>
                      <td className="px-5 py-3">
                        {s.center && <p className="font-medium">{s.center.name}</p>}
                        <p className={s.center ? "text-xs text-muted" : ""}>{place || (!s.center && <span className="text-faint">—</span>)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`pill ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          {s.website && <LinkOut href={s.website} icon="globe">Website</LinkOut>}
                          {s.exhibitorDirectoryUrl && <LinkOut href={s.exhibitorDirectoryUrl} icon="store">Exhibitor list</LinkOut>}
                          {s._count.exhibitors > 0 && (
                            <Link href={`/a/${slug}/exhibitors?show=${s.id}`} className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-brand hover:underline">
                              <Icon name="users" className="size-4" /> {s._count.exhibitors} {s._count.exhibitors === 1 ? "exhibitor" : "exhibitors"}
                            </Link>
                          )}
                          {!s.website && !s.exhibitorDirectoryUrl && s._count.exhibitors === 0 && <span className="text-faint">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <FavoriteShowStar slug={slug} tradeShowId={s.id} name={s.name} on={favoriteIds.has(s.id)} />
                          {canEdit && <Link href={`/a/${slug}/trade-shows/${s.id}`} className="btn-secondary">Edit</Link>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted">
                      No trade shows match. <Link href={`/a/${slug}/trade-shows?view=all`} className="font-semibold text-brand">Show all</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
