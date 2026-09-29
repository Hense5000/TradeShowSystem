import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { requirePlatformAdmin } from "@/lib/tenant";
import { createExhibitor } from "../actions";
import { ExhibitorFields } from "../exhibitor-fields";
import { tradeShowOptions } from "../show-select";

export default async function NewExhibitorPage({ params, searchParams }: PageProps<"/a/[slug]/exhibitors/new">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const { show } = await searchParams;
  const shows = await tradeShowOptions();

  return (
    <>
      <PageHeader
        title="Add exhibitor"
        description="Exhibitors are shared by every account in the system."
        action={<Link href={`/a/${slug}/exhibitors`} className="btn-secondary">Back to list</Link>}
      />
      {shows.length === 0 ? (
        <p className="card text-sm">
          An exhibitor belongs to a trade show, so <Link href={`/a/${slug}/trade-shows/new`} className="font-semibold text-brand">add a trade show</Link> first.
        </p>
      ) : (
        <SaveForm action={createExhibitor.bind(null, slug)} title="Exhibitor details" description="Company name, trade show and email are required." submitLabel="Add exhibitor" readOnly={false}>
          <ExhibitorFields shows={shows} showId={typeof show === "string" ? show : undefined} />
        </SaveForm>
      )}
    </>
  );
}
