import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/tenant";
import { deleteOrganizer, updateOrganizer } from "../actions";
import { OrganizerFields } from "../organizer-fields";

export default async function EditOrganizerPage({ params }: PageProps<"/a/[slug]/organizers/[id]">) {
  const { slug, id } = await params;
  await requirePlatformAdmin(slug);
  const organizer = await db.exhibitionOrganizer.findUnique({ where: { id } });
  if (!organizer) notFound();

  return (
    <>
      <PageHeader
        title={organizer.name}
        description="Changes are seen by every account in the system."
        action={<Link href={`/a/${slug}/organizers`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={updateOrganizer.bind(null, slug, id)} title="Organizer details" description="Only the company name is required." submitLabel="Save changes" readOnly={false}>
        <OrganizerFields organizer={organizer} />
      </SaveForm>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Delete organizer</h2>
          <p className="mt-0.5 text-sm text-muted">Removes it from the list for everyone.</p>
        </div>
        <ActionForm action={deleteOrganizer.bind(null, slug, id)} confirmMessage={`Delete ${organizer.name}? This cannot be undone.`}>
          <button className="btn-danger">Delete</button>
        </ActionForm>
      </section>
    </>
  );
}
