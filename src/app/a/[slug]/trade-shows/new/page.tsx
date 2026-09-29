import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { createTradeShow } from "../actions";
import { TradeShowFields } from "../trade-show-fields";

export default async function NewTradeShowPage({ params }: PageProps<"/a/[slug]/trade-shows/new">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const centers = await db.exhibitionCenter.findMany({ select: { id: true, name: true, city: true }, orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title="Add trade show"
        description="Trade shows are shared by every account in the system."
        action={<Link href={`/a/${slug}/trade-shows`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={createTradeShow.bind(null, slug)} title="Trade show details" description="Name and dates are required." submitLabel="Add trade show" readOnly={false}>
        <TradeShowFields centers={centers} />
      </SaveForm>
    </>
  );
}
