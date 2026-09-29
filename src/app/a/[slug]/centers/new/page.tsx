import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { requirePlatformAdmin } from "@/lib/tenant";
import { createCenter } from "../actions";
import { CenterFields } from "../center-fields";

export default async function NewCenterPage({ params }: PageProps<"/a/[slug]/centers/new">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);

  return (
    <>
      <PageHeader
        title="Add exhibition center"
        description="Centers are shared by every account in the system."
        action={<Link href={`/a/${slug}/centers`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={createCenter.bind(null, slug)} title="Center details" description="Only the name is required." submitLabel="Add center" readOnly={false}>
        <CenterFields />
      </SaveForm>
    </>
  );
}
