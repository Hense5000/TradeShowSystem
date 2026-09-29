import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { deleteTradeShow, updateTradeShow } from "../actions";
import { TradeShowFields } from "../trade-show-fields";

export default async function EditTradeShowPage({ params }: PageProps<"/a/[slug]/trade-shows/[id]">) {
  const { slug, id } = await params;
  await requirePlatformAdmin(slug);
  const [show, centers] = await Promise.all([
    db.tradeShow.findUnique({ where: { id } }),
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
