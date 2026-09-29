import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { PageHeader } from "@/components/page-header";
import { requirePlatformAdmin } from "@/lib/tenant";
import { importCenters } from "../actions";

export default async function ImportCentersPage({ params }: PageProps<"/a/[slug]/centers/import">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);

  return (
    <>
      <PageHeader
        title="Import exhibition centers"
        description="Add many centers at once from a spreadsheet saved as CSV."
        action={<Link href={`/a/${slug}/centers`} className="btn-secondary">Back to list</Link>}
      />
      <section className="card text-sm">
        <h2 className="font-bold">How the file should look</h2>
        <p className="mt-1 text-muted">
          The first row holds the column names. Only <strong className="text-ink">Name</strong> is required; the other
          columns can be left out or empty. Commas and semicolons both work as separators.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left">
            <thead className="bg-subtle text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Website</th>
                <th className="px-3 py-2">Local events URL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="px-3 py-2">Messe Berlin</td>
                <td className="px-3 py-2">Berlin</td>
                <td className="px-3 py-2">Germany</td>
                <td className="px-3 py-2">messe-berlin.de</td>
                <td className="px-3 py-2">messe-berlin.de/events</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-muted">
          Country can be a name (Germany) or a code (DE). Centers already in the list, with the same name and city, are
          skipped, so it is safe to import the same file again.
        </p>
      </section>
      <ImportForm action={importCenters.bind(null, slug)} noun={["center", "centers"]} />
    </>
  );
}
