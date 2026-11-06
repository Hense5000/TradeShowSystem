import Link from "next/link";
import { countryName } from "@/lib/countries";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { showStatus, STATUS_LABEL, STATUS_PILL } from "@/lib/trade-shows";
import { sortOtherShows } from "./other-shows";

/** The other trade shows the same company exhibits at, as a card under one exhibitor's details. */
export async function OtherShowsCard({ slug, companyKey, exceptShowId }: { slug: string; companyKey: string; exceptShowId: string }) {
  const rows = await db.exhibitor.findMany({
    where: { companyKey, tradeShowId: { not: exceptShowId } },
    select: {
      id: true,
      boothNumber: true,
      tradeShow: { select: { id: true, name: true, startDate: true, endDate: true, city: true, country: true, center: { select: { name: true } } } },
    },
  });
  // One line per show, even if the company is listed twice at it.
  const shows = sortOtherShows(rows.map((r) => ({ ...r.tradeShow, boothNumber: r.boothNumber }))).filter(
    (s, i, all) => all.findIndex((o) => o.id === s.id) === i,
  );
  const companyHref = `/a/${slug}/exhibitors/company?key=${encodeURIComponent(companyKey)}`;

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="font-bold">Also exhibits at</h2>
          <p className="mt-0.5 text-sm text-muted">
            {shows.length === 0
              ? "This company is not listed at any other trade show yet."
              : `The same company at ${shows.length} other ${shows.length === 1 ? "trade show" : "trade shows"}.`}
          </p>
        </div>
        {shows.length > 0 && (
          <Link href={companyHref} className="btn-secondary">
            Company page
          </Link>
        )}
      </div>
      {shows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                <th className="px-5 py-2.5">Trade show</th>
                <th className="px-5 py-2.5">Dates</th>
                <th className="px-5 py-2.5">Exhibition center</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Booth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shows.map((s) => {
                const status = showStatus(s);
                const place = [s.city, s.country && countryName(s.country)].filter(Boolean).join(", ");
                return (
                  <tr key={s.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="min-w-48">
                        <Link href={`/a/${slug}/exhibitors?show=${s.id}`} className="font-semibold hover:text-brand">
                          {s.name}
                        </Link>
                        {place && <p className="text-xs text-muted">{place}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums">{formatDateRange(s.startDate, s.endDate)}</td>
                    <td className="px-5 py-3">
                      {s.center ? <span className="block min-w-40">{s.center.name}</span> : <span className="text-faint">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`pill ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{s.boothNumber ?? <span className="text-faint">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
