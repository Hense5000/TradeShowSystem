import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { PageHeader } from "@/components/page-header";
import { requirePlatformAdmin } from "@/lib/tenant";
import { importTradeShows } from "../actions";

const EXAMPLE = [
  ["Trade show name", "InnoTrans"],
  ["Start date", "22.09.2026"],
  ["End date", "25.09.2026"],
  ["City", "Berlin"],
  ["Country", "Germany"],
  ["Website", "innotrans.de"],
  ["Exhibition center", "Messe Berlin"],
  ["Exhibitor directory URL", "innotrans.de/exhibitors"],
];

export default async function ImportTradeShowsPage({ params }: PageProps<"/a/[slug]/trade-shows/import">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);

  return (
    <>
      <PageHeader
        title="Import trade shows"
        description="Add many trade shows at once from a spreadsheet saved as CSV."
        action={<Link href={`/a/${slug}/trade-shows`} className="btn-secondary">Back to list</Link>}
      />
      <section className="card text-sm">
        <h2 className="font-bold">How the file should look</h2>
        <p className="mt-1 text-muted">
          The first row holds the column names. <strong className="text-ink">Trade show name</strong>,{" "}
          <strong className="text-ink">Start date</strong> and <strong className="text-ink">End date</strong> are required;
          the other columns can be left out or empty. Commas and semicolons both work as separators.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left">
            <thead className="bg-subtle text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
              <tr>
                {EXAMPLE.map(([h]) => (
                  <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                {EXAMPLE.map(([h, v]) => (
                  <td key={h} className="px-3 py-2 whitespace-nowrap">{v}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-muted">
          Dates can be written as 2026-09-22, 22.09.2026 or 22/09/2026 (day first). Country can be a name (Germany) or a
          code (DE). The exhibition center must be written as it is in the centers list. A Status column is ignored, because the status follows from the dates. Shows already in the list,
          with the same name and start date, are skipped, so it is safe to import the same file again.
        </p>
      </section>
      <ImportForm action={importTradeShows.bind(null, slug)} noun={["trade show", "trade shows"]} />
    </>
  );
}
