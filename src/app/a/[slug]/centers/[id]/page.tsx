import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { deleteCenter, updateCenter } from "../actions";
import { CenterFields } from "../center-fields";

export default async function EditCenterPage({ params }: PageProps<"/a/[slug]/centers/[id]">) {
  const { slug, id } = await params;
  await requirePlatformAdmin(slug);
  const center = await db.exhibitionCenter.findUnique({ where: { id } });
  if (!center) notFound();

  return (
    <>
      <PageHeader
        title={center.name}
        description="Changes are seen by every account in the system."
        action={<Link href={`/a/${slug}/centers`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={updateCenter.bind(null, slug, id)} title="Center details" description="Only the name is required." submitLabel="Save changes" readOnly={false}>
        <CenterFields center={center} />
      </SaveForm>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Delete center</h2>
          <p className="mt-0.5 text-sm text-muted">Removes it from the list for everyone.</p>
        </div>
        <ActionForm action={deleteCenter.bind(null, slug, id)} confirmMessage={`Delete ${center.name}? This cannot be undone.`}>
          <button className="btn-danger">Delete</button>
        </ActionForm>
      </section>
    </>
  );
}
