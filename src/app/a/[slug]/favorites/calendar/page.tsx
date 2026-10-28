import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { isOn, monthParam, monthWeeks, parseMonth, shiftMonth } from "@/lib/calendar";
import { syncCompanyKeys } from "@/lib/company-run";
import { countryName } from "@/lib/countries";
import { formatDateRange, isoDate, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { countByShow, favoriteRowsAt } from "@/lib/favorite-companies";
import { hasRole } from "@/lib/permissions";
import { accountAccess, requireMembership } from "@/lib/tenant";
import { showStatus, STATUS_LABEL, STATUS_PILL } from "@/lib/trade-shows";
import { TrialLockedButton } from "../../exhibitors/export-button";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthName = (month: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(month);

// The account's favorite trade shows in a month calendar. On a phone the
// month is shown as a list.
export default async function FavoritesCalendarPage({ params, searchParams }: PageProps<"/a/[slug]/favorites/calendar">) {
  const { slug } = await params;
  const { user, membership, organization } = await requireMembership(slug);
  const trial = accountAccess(organization, user.email) === "trial";
  const sp = await searchParams;
  const day = today();
  const month = parseMonth(sp.month, day);
  const weeks = monthWeeks(month);
  const monthEnd = new Date(shiftMonth(month, 1).getTime() - 1);

  await syncCompanyKeys();
  const favorites = await db.favoriteShow.findMany({
    where: { organizationId: organization.id },
    include: { tradeShow: { include: { center: { select: { name: true } } } } },
  });
  // A favorite company counts at every one of these shows it exhibits at.
  const leadsAt = countByShow(await favoriteRowsAt(organization.id, favorites.map((f) => f.tradeShowId)));
  const shows = favorites
    .map((f) => ({ ...f.tradeShow, status: showStatus(f.tradeShow) }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime() || a.name.localeCompare(b.name));

  const inGrid = shows.filter((s) => s.startDate <= weeks.at(-1)!.at(-1)! && s.endDate >= weeks[0][0]);
  const inMonth = shows.filter((s) => s.startDate <= monthEnd && s.endDate >= month);
  const next = shows.find((s) => s.startDate > monthEnd);
  const base = `/a/${slug}/favorites`;
  const monthHref = (m: Date) => `${base}/calendar?month=${monthParam(m)}`;
  const planHref = (id: string) => `${base}/plan?show=${id}`;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your favorite trade shows by month. Star a trade show on the Trade shows page to add it here."
        action={
          shows.length > 0 &&
          (trial ? (
            <TrialLockedButton slug={slug} canSubscribe={hasRole(membership.role, "OWNER")} title="Downloads are not part of the free trial">
              Add to calendar (.ics)
            </TrialLockedButton>
          ) : (
            <a href={`${base}/calendar.ics`} download className="btn-secondary py-2" title="Download all favorite trade shows as a calendar file for Outlook, Google Calendar or Apple Calendar">
              <Icon name="download" className="size-4" /> Add to calendar (.ics)
            </a>
          ))
        }
      />

      <section className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-lg font-bold">{monthName(month)}</h2>
          <nav className="flex items-center gap-2" aria-label="Months">
            <Link href={monthHref(shiftMonth(month, -1))} className="btn-secondary px-2.5 py-1.5" aria-label="Previous month">
              <Icon name="chevron" className="size-4 rotate-90" />
            </Link>
            <Link href={`${base}/calendar`} className="btn-secondary py-1.5">Today</Link>
            <Link href={monthHref(shiftMonth(month, 1))} className="btn-secondary px-2.5 py-1.5" aria-label="Next month">
              <Icon name="chevron" className="size-4 -rotate-90" />
            </Link>
          </nav>
        </div>

        {/* The month grid; on a phone only the list below is shown. */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 border-b border-line bg-subtle text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2.5 py-2">{w}</div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={isoDate(week[0])} className="grid grid-cols-7 border-b border-line last:border-b-0">
              {week.map((d) => {
                const outside = d.getUTCMonth() !== month.getUTCMonth();
                const isToday = d.getTime() === day.getTime();
                const on = inGrid.filter((s) => isOn(s, d));
                return (
                  <div key={isoDate(d)} className={`min-h-28 border-r border-line p-1.5 last:border-r-0 ${outside ? "bg-subtle/60" : ""}`}>
                    <p className={`mb-1 flex h-6 items-center px-1 text-xs font-semibold tabular-nums ${outside ? "text-faint" : "text-muted"}`}>
                      <span className={isToday ? "-ml-1.5 grid size-6 place-items-center rounded-full bg-brand text-white" : ""}>{d.getUTCDate()}</span>
                    </p>
                    <div className="flex flex-col gap-1">
                      {on.map((s) => (
                        <Link
                          key={s.id}
                          href={planHref(s.id)}
                          title={`${s.name} · ${formatDateRange(s.startDate, s.endDate)} · open the meeting plan`}
                          className={`block truncate rounded-md px-1.5 py-1 text-xs font-semibold ${
                            s.status === "finished" ? "bg-subtle text-muted hover:text-ink" : "bg-brand-soft text-brand hover:bg-brand hover:text-white"
                          }`}
                        >
                          {s.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="border-t border-line px-4 py-4 sm:px-5">
          {inMonth.length === 0 ? (
            <p className="text-sm text-muted">
              No favorite trade shows in {monthName(month)}.
              {next && (
                <>
                  {" "}Next is{" "}
                  <Link href={monthHref(new Date(Date.UTC(next.startDate.getUTCFullYear(), next.startDate.getUTCMonth(), 1)))} className="font-semibold text-brand hover:underline">
                    {next.name}
                  </Link>{" "}
                  on {formatDateRange(next.startDate, next.endDate)}.
                </>
              )}
              {shows.length === 0 && (
                <>
                  {" "}
                  <Link href={`/a/${slug}/trade-shows`} className="font-semibold text-brand hover:underline">Star a trade show</Link> to see it here.
                </>
              )}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {inMonth.map((s) => {
                const place = [s.center?.name, s.city, s.country && countryName(s.country)].filter(Boolean).join(" · ");
                const n = leadsAt.get(s.id) ?? 0;
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line px-4 py-3">
                    <div className="min-w-48 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {s.name}
                        <span className={`pill ${STATUS_PILL[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-muted">{[formatDateRange(s.startDate, s.endDate), place].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={planHref(s.id)} className="pill pill-soft gap-1 hover:underline">
                        <Icon name="check" className="size-3.5" /> Meeting plan{n > 0 ? ` · ${n}` : ""}
                      </Link>
                      <Link href={`/a/${slug}/exhibitors?show=${s.id}`} className="pill pill-soft gap-1 hover:underline">
                        <Icon name="store" className="size-3.5" /> Exhibitors
                      </Link>
                      {s.website && (
                        <a href={s.website} target="_blank" rel="noopener noreferrer" className="pill pill-soft gap-1 hover:underline">
                          <Icon name="globe" className="size-3.5" /> Website
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
