import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { requirePlatformAdmin } from "@/lib/tenant";
import { createOrganizer } from "../actions";
import { OrganizerFields } from "../organizer-fields";

export default async function NewOrganizerPage({ params }: PageProps<"/a/[slug]/organizers/new">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);

  return (
    <>
      <PageHeader
        title="Add exhibition organizer"
        description="Organizers are shared by every account in the system."
        action={<Link href={`/a/${slug}/organizers`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={createOrganizer.bind(null, slug)} title="Organizer details" description="Only the company name is required." submitLabel="Add organizer" readOnly={false}>
        <OrganizerFields />
      </SaveForm>
    </>
  );
}
