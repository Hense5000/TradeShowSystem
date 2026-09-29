import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { PageHeader } from "@/components/page-header";
import { requirePlatformAdmin } from "@/lib/tenant";
import { importExhibitors } from "../actions";
import { ShowSelect, tradeShowOptions } from "../show-select";

const COLUMNS = [
  "Company name",
  "Contact person",
  "Contact position",
  "Email",
  "Phone",
  "Website",
  "Country",
  "Industry",
  "Booth no.",
  "Stand location URL",
  "Company profile",
];

export default async function ImportExhibitorsPage({ params, searchParams }: PageProps<"/a/[slug]/exhibitors/import">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const { show } = await searchParams;
  const shows = await tradeShowOptions();

  return (
    <>
      <PageHeader
        title="Import exhibitors"
        description="Add the exhibitors of one trade show at once from a spreadsheet saved as CSV."
        action={<Link href={`/a/${slug}/exhibitors`} className="btn-secondary">Back to list</Link>}
      />
      <section className="card text-sm">
        <h2 className="font-bold">How the file should look</h2>
        <p className="mt-1 text-muted">
          One file per trade show; you choose the show below. The first row holds the column names.{" "}
          <strong className="text-ink">Company name</strong> and <strong className="text-ink">Email</strong> are required;
          the other columns can be left out or empty. Commas and semicolons both work as separators.
        </p>
        <p className="mt-3 flex flex-wrap gap-1.5">
          {COLUMNS.map((c) => (
            <span key={c} className="pill pill-neutral">{c}</span>
          ))}
        </p>
        <p className="mt-3 text-muted">
          Country can be a name (Denmark) or a code (DK). Companies already listed at the chosen show are skipped, so it is
          safe to import the same file again.
        </p>
      </section>
      {shows.length === 0 ? (
        <p className="card text-sm">
          Exhibitors belong to a trade show, so <Link href={`/a/${slug}/trade-shows/new`} className="font-semibold text-brand">add a trade show</Link> first.
        </p>
      ) : (
        <ImportForm action={importExhibitors.bind(null, slug)} noun={["exhibitor", "exhibitors"]}>
          <ShowSelect shows={shows} defaultValue={typeof show === "string" ? show : undefined} />
        </ImportForm>
      )}
    </>
  );
}
