import Link from "next/link";
import { formatDateRange } from "@/lib/dates";
import { showStatus } from "@/lib/trade-shows";

export type OtherShow = { id: string; name: string; startDate: Date; endDate: Date };

/** Upcoming and running shows first, soonest first; finished shows after them, latest first. */
export function sortOtherShows<S extends { startDate: Date; endDate: Date }>(shows: S[]): S[] {
  return [...shows].sort((a, b) => {
    const aDone = showStatus(a) === "finished";
    const bDone = showStatus(b) === "finished";
    if (aDone !== bDone) return aDone ? 1 : -1;
    return (aDone ? -1 : 1) * (a.startDate.getTime() - b.startDate.getTime());
  });
}

/**
 * The other trade shows a company exhibits at, small under the show of a list
 * row. The first few are named with their dates; the rest are on the company page.
 */
export function AlsoAtShows({ slug, shows, companyHref, max = 3 }: { slug: string; shows: OtherShow[]; companyHref?: string; max?: number }) {
  if (shows.length === 0) return null;
  const listed = sortOtherShows(shows).slice(0, max);
  const more = shows.length - listed.length;
  return (
    <div className="mt-2 border-t border-line pt-1.5">
      <p className="text-[0.7rem] font-semibold tracking-wider text-muted uppercase">Also exhibits at</p>
      <ul className="mt-0.5 space-y-0.5">
        {listed.map((s) => (
          <li key={s.id} className="text-xs leading-snug">
            <Link href={`/a/${slug}/exhibitors?show=${s.id}`} className="font-medium hover:text-brand">
              {s.name}
            </Link>
            <span className={`block whitespace-nowrap tabular-nums ${showStatus(s) === "finished" ? "text-faint" : "text-muted"}`}>
              {formatDateRange(s.startDate, s.endDate)}
            </span>
          </li>
        ))}
      </ul>
      {more > 0 && companyHref && (
        <Link href={companyHref} className="mt-0.5 block text-xs font-semibold text-brand hover:underline">
          +{more} more {more === 1 ? "show" : "shows"}
        </Link>
      )}
    </div>
  );
}
