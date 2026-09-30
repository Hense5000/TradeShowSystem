import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { createFeature } from "../actions";
import { FeatureFields } from "../feature-fields";

export default async function NewFeaturePage({ params }: PageProps<"/a/[slug]/admin/new">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const accounts = await db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });

  return (
    <>
      <PageHeader
        title="Add feature"
        description="New features start switched off, so customers don't see them until you are ready."
        action={<Link href={`/a/${slug}/admin`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={createFeature.bind(null, slug)} title="Feature details" description="Only the name is required." submitLabel="Add feature" readOnly={false}>
        <FeatureFields accounts={accounts} />
      </SaveForm>
    </>
  );
}
