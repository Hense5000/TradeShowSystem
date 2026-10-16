import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { isCompanyProfileConfigured } from "@/lib/company-profile-run";
import { db } from "@/lib/db";
import { isExhibitorFetchConfigured } from "@/lib/exhibitor-fetch-run";
import { requirePlatformAdmin } from "@/lib/tenant";
import { deleteTradeShow, updateTradeShow } from "../actions";
import { FetchExhibitors } from "../fetch-exhibitors";
import { FindDirectory } from "../find-directory";
import { TradeShowFields } from "../trade-show-fields";

// "Fetch exhibitors" reads one page of the exhibitor directory per call to this page.
export const maxDuration = 300;

export default async function EditTradeShowPage({ params }: PageProps<"/a/[slug]/trade-shows/[id]">) {
  const { slug, id } = await params;
  await requirePlatformAdmin(slug);
  const [show, centers] = await Promise.all([
    db.tradeShow.findUnique({ where: { id }, include: { _count: { select: { exhibitors: true } } } }),
    db.exhibitionCenter.findMany({ select: { id: true, name: true, city: true }, orderBy: { name: "asc" } }),
  ]);
  if (!show) notFound();

  return (
    <>
      <PageHeader
        title={show.name}
        description="Changes are seen by every account in the system."
        action={<Link href={`/a/${slug}/trade-shows`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={updateTradeShow.bind(null, slug, id)} title="Trade show details" description="Name and dates are required." submitLabel="Save changes" readOnly={false}>
        <TradeShowFields show={show} centers={centers} />
      </SaveForm>
      {show.exhibitorDirectoryUrl && isExhibitorFetchConfigured() && (
        <FetchExhibitors
          slug={slug}
          tradeShowId={show.id}
          directoryUrl={show.exhibitorDirectoryUrl}
          exhibitorCount={show._count.exhibitors}
          writeProfiles={isCompanyProfileConfigured()}
        />
      )}
      {!show.exhibitorDirectoryUrl && isExhibitorFetchConfigured() && <FindDirectory slug={slug} tradeShowId={show.id} />}
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Delete trade show</h2>
          <p className="mt-0.5 text-sm text-muted">Removes it from the list for everyone.</p>
        </div>
        <ActionForm action={deleteTradeShow.bind(null, slug, id)} confirmMessage={`Delete ${show.name}? This cannot be undone.`}>
          <button className="btn-danger">Delete</button>
        </ActionForm>
      </section>
    </>
  );
}
