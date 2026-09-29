import Link from "next/link";
import { ImportForm } from "@/components/import-form";
import { PageHeader } from "@/components/page-header";
import { requirePlatformAdmin } from "@/lib/tenant";
import { importOrganizers } from "../actions";

export default async function ImportOrganizersPage({ params }: PageProps<"/a/[slug]/organizers/import">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);

  return (
    <>
      <PageHeader
        title="Import exhibition organizers"
        description="Add many organizers at once from a spreadsheet saved as CSV."
        action={<Link href={`/a/${slug}/organizers`} className="btn-secondary">Back to list</Link>}
      />
      <section className="card text-sm">
        <h2 className="font-bold">How the file should look</h2>
        <p className="mt-1 text-muted">
          The first row holds the column names. Only <strong className="text-ink">Organizer company</strong> is required;
          the other columns can be left out or empty. Commas and semicolons both work as separators.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left">
            <thead className="bg-subtle text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
              <tr>
                <th className="px-3 py-2">Organizer company</th>
                <th className="px-3 py-2">Website</th>
                <th className="px-3 py-2">Country</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="px-3 py-2">Messe Düsseldorf GmbH</td>
                <td className="px-3 py-2">messe-duesseldorf.de</td>
                <td className="px-3 py-2">Germany</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-muted">
          Country can be a name (Germany) or a code (DE). Organizers already in the list, with the same company name, are
          skipped, so it is safe to import the same file again.
        </p>
      </section>
      <ImportForm action={importOrganizers.bind(null, slug)} noun={["organizer", "organizers"]} />
    </>
  );
}
