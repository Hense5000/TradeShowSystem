import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { countryName } from "@/lib/countries";
import { addMonths, formatDateRange, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireMembership } from "@/lib/tenant";
import { showStatus } from "@/lib/trade-shows";

// How far ahead the upcoming list looks, in months. The first is the default.
const RANGES = [2, 3, 6] as const;
type Range = (typeof RANGES)[number];

function Stat({ icon, label, value, note, href }: { icon: IconName; label: string; value: number; note: string; href?: string }) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="eyebrow block">{label}</span>
        <span className="mt-1 block text-3xl font-bold tabular-nums">{value.toLocaleString("en-US")}</span>
        <span className="mt-0.5 block text-sm text-muted">{note}</span>
      </span>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon name={icon} className="size-5.5" />
      </span>
    </>
  );
  const cls = "card flex items-start justify-between gap-3";
  return href ? (
    <Link href={href} className={`${cls} hover:border-brand`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function Dashboard({ params, searchParams }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  await requireMembership(slug);
  const sp = await searchParams;
  const range: Range = RANGES.find((r) => String(r) === sp.months) ?? RANGES[0];
  const day = today();
  const until = addMonths(day, range);

  const [showCount, runningCount, exhibitorCount, centerCount, upcoming] = await Promise.all([
    db.tradeShow.count(),
    db.tradeShow.count({ where: { startDate: { lte: day }, endDate: { gte: day } } }),
    db.exhibitor.count(),
    db.exhibitionCenter.count(),
    // Shows still to come or running now, starting within the chosen range.
    db.tradeShow.findMany({
      where: { endDate: { gte: day }, startDate: { lte: until } },
      include: { center: { select: { name: true } }, _count: { select: { exhibitors: true } } },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
    }),
  ]);

  const tab = "rounded-lg border px-3 py-1.5 text-sm font-semibold whitespace-nowrap";

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your trade show operations." />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon="calendar" label="Total trade shows" value={showCount} note={`${runningCount} currently running`} href={`/a/${slug}/trade-shows`} />
        <Stat icon="store" label="Exhibitors" value={exhibitorCount} note="Total registered" href={`/a/${slug}/exhibitors`} />
        <Stat icon="pin" label="Exhibition centers" value={centerCount} note="Total venues" href={`/a/${slug}/centers`} />
        <Stat icon="users" label="Lead retrieval active" value={0} note="Coming soon" />
      </div>

      <section className="card">
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
    </>
  );
}
