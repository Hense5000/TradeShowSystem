import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { countryName } from "@/lib/countries";
import { addMonths, formatDateRange, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { ACTIVE_LEAD_STATUSES, FOLLOW_UP_PILL, FOLLOW_UP_SOON_DAYS, followUpLabel, followUpState, mineOrUnassigned } from "@/lib/leads";
import { formatMoney } from "@/lib/project-value";
import { recommendedShows } from "@/lib/show-recommendations-run";
import { requireMembership } from "@/lib/tenant";
import { showStatus } from "@/lib/trade-shows";
import { RecommendedShows } from "./favorites/recommended-shows";

// The follow-ups card under "Lead retrieval active" lists at most this many.
const FOLLOW_UPS_SHOWN = 8;

// Henrik's pale green for the lead cards ("Lead retrieval active" and "Project value").
const LEAD_CARD = "border-[#7FE07F] bg-[#98FB98]";
const LEAD_ICON = "bg-white/60 text-ink";

// How far ahead the upcoming list looks, in months. The first is the default.
const RANGES = [2, 3, 6] as const;
type Range = (typeof RANGES)[number];

function Stat({
  icon,
  label,
  value,
  note,
  href,
  highlight,
}: {
  icon: IconName;
  label: string;
  value: number;
  note: string;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="eyebrow block">{label}</span>
        <span className="mt-1 block text-3xl font-bold tabular-nums">{value.toLocaleString("en-US")}</span>
        <span className={`mt-0.5 block text-sm ${highlight ? "text-ink/70" : "text-muted"}`}>{note}</span>
      </span>
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${highlight ? LEAD_ICON : "bg-brand-soft text-brand"}`}>
        <Icon name={icon} className="size-5.5" />
      </span>
    </>
  );
  const cls = `card flex items-start justify-between gap-3 ${highlight ? LEAD_CARD : ""}`;
  return href ? (
    <Link href={href} className={`${cls} hover:border-brand`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function Dashboard({ params, searchParams }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const { user, organization } = await requireMembership(slug);
  const sp = await searchParams;
  const range: Range = RANGES.find((r) => String(r) === sp.months) ?? RANGES[0];
  const day = today();
  const until = addMonths(day, range);

  // The follow-ups card shows the user's own leads and the ones no one is responsible for.
  const myLeads = { list: { organizationId: organization.id, favorites: true }, ...mineOrUnassigned(user.id) };
  const followUpWhere = { ...myLeads, followUpAt: { lte: new Date(day.getTime() + FOLLOW_UP_SOON_DAYS * 86_400_000) } };
  const [showCount, runningCount, exhibitorCount, centerCount, openLeads, favoriteShows, followUps, followUpCount, dueCount, upcoming, recommended, values] = await Promise.all([
    db.tradeShow.count(),
    db.tradeShow.count({ where: { startDate: { lte: day }, endDate: { gte: day } } }),
    db.exhibitor.count(),
    db.exhibitionCenter.count(),
    // Favorite exhibitors still being worked on (New, Contacted or Meeting booked).
    db.savedListItem.count({ where: { list: { organizationId: organization.id, favorites: true }, leadStatus: { in: ACTIVE_LEAD_STATUSES } } }),
    db.favoriteShow.count({ where: { organizationId: organization.id } }),
    // Follow-ups that are overdue, due today or due within a week, soonest first.
    db.savedListItem.findMany({
      where: followUpWhere,
      select: { followUpAt: true, followUpNote: true, exhibitor: { select: { name: true, tradeShow: { select: { name: true } } } } },
      orderBy: [{ followUpAt: "asc" }, { exhibitor: { name: "asc" } }],
      take: FOLLOW_UPS_SHOWN,
    }),
    db.savedListItem.count({ where: followUpWhere }),
    db.savedListItem.count({ where: { ...myLeads, followUpAt: { lte: day } } }),
    // Shows still to come or running now, starting within the chosen range.
    db.tradeShow.findMany({
      where: { endDate: { gte: day }, startDate: { lte: until } },
      include: { center: { select: { name: true } }, _count: { select: { exhibitors: true } } },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
    }),
    recommendedShows(organization.id, day, 3),
    // The project values on the favorite exhibitors, per status.
    db.savedListItem.groupBy({
      by: ["leadStatus"],
      where: { list: { organizationId: organization.id, favorites: true }, projectValue: { not: null } },
      _sum: { projectValue: true },
      _count: true,
    }),
  ]);

  // Running projects are the leads still being worked on; won ones are shown apart.
  const openValues = values.filter((v) => ACTIVE_LEAD_STATUSES.includes(v.leadStatus));
  const openValue = openValues.reduce((sum, v) => sum + (v._sum.projectValue ?? 0), 0);
  const openValueCount = openValues.reduce((sum, v) => sum + v._count, 0);
  const wonValue = values.find((v) => v.leadStatus === "WON")?._sum.projectValue ?? 0;
  const money = (n: number) => formatMoney(n, organization.currency);

  const tab = "rounded-lg border px-3 py-1.5 text-sm font-semibold whitespace-nowrap";

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your trade show operations." />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon="calendar" label="Total trade shows" value={showCount} note={`${runningCount} currently running`} href={`/a/${slug}/trade-shows`} />
        <Stat icon="store" label="Exhibitors" value={exhibitorCount} note="Total registered" href={`/a/${slug}/exhibitors`} />
        <Stat icon="pin" label="Exhibition centers" value={centerCount} note="Total venues" href={`/a/${slug}/centers`} />
        <Stat
          icon="users"
          label="Lead retrieval active"
          value={openLeads}
          note={`Open leads · ${favoriteShows} ${favoriteShows === 1 ? "show" : "shows"}`}
          href={`/a/${slug}/favorites/exhibitors`}
          highlight
        />
      </div>

      {/* The follow-ups sit right under "Lead retrieval active", next to the upcoming trade shows. */}
      <div className="grid items-start gap-3.5 xl:grid-cols-4">
        <div className="flex flex-col gap-3.5 xl:col-start-4 xl:row-start-1">
          <Link href={`/a/${slug}/favorites/exhibitors`} className={`card flex items-start justify-between gap-3 hover:border-brand ${LEAD_CARD}`}>
            <span className="min-w-0">
              <span className="eyebrow block">Project value</span>
              <span className="mt-1 block truncate text-3xl font-bold tabular-nums">{money(openValue)}</span>
              <span className="mt-0.5 block text-sm text-ink/70">
                {openValueCount === 0
                  ? "Add a project value to your favorite exhibitors"
                  : `${openValueCount} running ${openValueCount === 1 ? "project" : "projects"}`}
              </span>
              {wonValue > 0 && <span className="mt-0.5 block text-xs text-ink/60">Won: {money(wonValue)}</span>}
            </span>
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${LEAD_ICON}`}>
              <Icon name="briefcase" className="size-5.5" />
            </span>
          </Link>
          <section className="card flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-bold">Follow-ups</h2>
                <p className="text-sm text-muted">
                  {dueCount > 0 ? `${dueCount} due today or overdue` : `Nothing due today`}
                </p>
                <p className="text-xs text-faint">Your leads and unassigned ones</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name="calendar" className="size-4.5" />
              </span>
            </div>
            {followUps.length === 0 ? (
              <p className="text-sm text-muted">
                No follow-ups in the next {FOLLOW_UP_SOON_DAYS} days. Set a follow-up date on a lead on the{" "}
                <Link href={`/a/${slug}/favorites/exhibitors`} className="font-semibold text-brand hover:underline">Favorites page</Link>.
              </p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {followUps.map((f, i) => (
                  <li key={i}>
                    <Link
                      href={`/a/${slug}/favorites/exhibitors?q=${encodeURIComponent(f.exhibitor.name)}`}
                      className="flex flex-col gap-0.5 rounded-lg px-2 py-2 hover:bg-subtle"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{f.exhibitor.name}</span>
                        <span className={`pill shrink-0 ${FOLLOW_UP_PILL[followUpState(f.followUpAt!, day)]}`}>{followUpLabel(f.followUpAt!, day)}</span>
                      </span>
                      <span className="truncate text-xs text-muted">{f.followUpNote ?? f.exhibitor.tradeShow.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {followUpCount > 0 && (
              <Link href={`/a/${slug}/favorites/exhibitors?followup=set`} className="text-sm font-semibold text-brand hover:underline">
                {followUpCount > followUps.length ? `See all ${followUpCount} follow-ups` : "Open in Favorites"}
              </Link>
            )}
          </section>
          {/* Only once the account has favorites to recommend from. */}
          {openLeads + favoriteShows > 0 && <RecommendedShows slug={slug} items={recommended} compact />}
        </div>

        <section className="card xl:col-span-3 xl:col-start-1 xl:row-start-1">
          <h2 className="text-lg font-bold">Upcoming trade shows</h2>
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Period">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={r === RANGES[0] ? `/a/${slug}` : `/a/${slug}?months=${r}`}
                aria-current={r === range ? "page" : undefined}
                scroll={false}
                className={`${tab} ${r === range ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-subtle"}`}
              >
                Next {r} months
              </Link>
            ))}
            <Link href={`/a/${slug}/trade-shows`} className={`${tab} border-line-strong bg-surface text-ink hover:bg-subtle`}>
              View all trade shows
            </Link>
          </nav>

          <p className="mt-4 text-sm text-muted">
            {upcoming.length === 0
              ? `No trade shows in the next ${range} months.`
              : `${upcoming.length} ${upcoming.length === 1 ? "trade show" : "trade shows"} in the next ${range} months`}
          </p>

          {upcoming.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2.5">
              {upcoming.map((s) => {
                const place = [s.center?.name, s.city, s.country && countryName(s.country)].filter(Boolean).join(" · ");
                const running = showStatus(s) === "running";
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line px-4 py-3">
                    <div className="min-w-48 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {s.name}
                        {running && <span className="pill pill-ok">Running</span>}
                      </p>
                      {place && <p className="mt-0.5 text-sm text-muted">{place}</p>}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted">Exhibitors</p>
                      {s._count.exhibitors > 0 ? (
                        <Link href={`/a/${slug}/exhibitors?show=${s.id}`} className="font-bold tabular-nums text-brand hover:underline">
                          {s._count.exhibitors}
                        </Link>
                      ) : (
                        <p className="font-bold tabular-nums">0</p>
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
          )}
        </section>
      </div>
    </>
  );
}
