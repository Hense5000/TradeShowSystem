import Link from "next/link";
import { Icon } from "@/components/icons";
import { countryName } from "@/lib/countries";
import { formatDateRange } from "@/lib/dates";
import type { recommendedShows } from "@/lib/show-recommendations-run";
import { FavoriteShowStar } from "../trade-shows/favorite-show-star";
import { hideRecommendation } from "./actions";

type Item = Awaited<ReturnType<typeof recommendedShows>>[number];

/**
 * Trade shows recommended from the account's favorites, each with a star to
 * add it to Favorites and "Not interested" to stop recommending it. Compact
 * is the Dashboard card; otherwise it is the box on Favorites → Trade shows.
 */
export function RecommendedShows({ slug, items, compact = false }: { slug: string; items: Item[]; compact?: boolean }) {
  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">Recommended trade shows</h2>
          <p className="text-sm text-muted">Where your favorite exhibitors also go, or many like them.</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon name="sparkle" className="size-4.5" />
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">
          No recommendations yet. Star more exhibitors on the{" "}
          <Link href={`/a/${slug}/exhibitors`} className="font-semibold text-brand hover:underline">Exhibitors page</Link>, and upcoming shows where they or similar companies exhibit show up here.
        </p>
      ) : (
        <ul className={compact ? "-mx-2 flex flex-col" : "flex flex-col gap-2.5"}>
          {items.map(({ show: s, reason, tradeShowId }) => {
            const place = [s.center?.name, s.city, s.country && countryName(s.country)].filter(Boolean).join(" · ");
            return (
              <li key={tradeShowId} className={compact ? "flex items-start gap-1 rounded-lg px-2 py-2 hover:bg-subtle" : "flex flex-wrap items-start gap-x-4 gap-y-2 rounded-lg border border-line px-3 py-3"}>
                <FavoriteShowStar slug={slug} tradeShowId={s.id} name={s.name} on={false} />
                <div className="min-w-0 flex-1 pt-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
                    <Link href={`/a/${slug}/exhibitors?show=${s.id}`} className="hover:text-brand" title="See the exhibitors">
                      {s.name}
                    </Link>
                    <span className="text-xs font-normal whitespace-nowrap text-muted tabular-nums">{formatDateRange(s.startDate, s.endDate)}</span>
                  </p>
                  {!compact && place && <p className="text-xs text-muted">{place}</p>}
                  <p className="mt-0.5 text-xs text-ink">{reason}</p>
                </div>
                <form action={hideRecommendation.bind(null, slug, s.id)} className="pt-0.5">
                  <button className="rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap text-muted hover:bg-subtle hover:text-ink" title={`Don't recommend ${s.name} again`}>
                    Not interested
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      {compact && items.length > 0 && (
        <Link href={`/a/${slug}/favorites/trade-shows`} className="text-sm font-semibold text-brand hover:underline">
          Your favorite trade shows
        </Link>
      )}
    </section>
  );
}
