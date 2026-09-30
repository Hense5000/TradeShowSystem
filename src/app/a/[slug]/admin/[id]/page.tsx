import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { deleteFeature, updateFeature } from "../actions";
import { FeatureFields } from "../feature-fields";

export default async function EditFeaturePage({ params }: PageProps<"/a/[slug]/admin/[id]">) {
  const { slug, id } = await params;
  await requirePlatformAdmin(slug);
  const [feature, accounts] = await Promise.all([
    db.feature.findUnique({ where: { id }, include: { access: { select: { organizationId: true } } } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
  if (!feature) notFound();

  return (
    <>
      <PageHeader
        title={feature.name}
        description={`Code key: ${feature.key}`}
        action={<Link href={`/a/${slug}/admin`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={updateFeature.bind(null, slug, id)} title="Feature details" description="Changes apply to customer accounts right away." submitLabel="Save changes" readOnly={false}>
        <FeatureFields feature={feature} accounts={accounts} selected={feature.access.map((a) => a.organizationId)} />
      </SaveForm>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Delete feature</h2>
          <p className="mt-0.5 text-sm text-muted">Removes it from the list and from every account.</p>
        </div>
        <ActionForm action={deleteFeature.bind(null, slug, id)} confirmMessage={`Delete ${feature.name}? This cannot be undone.`}>
          <button className="btn-danger">Delete</button>
        </ActionForm>
      </section>
    </>
  );
}
