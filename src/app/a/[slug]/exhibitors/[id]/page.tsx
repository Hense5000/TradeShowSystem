import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { db } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai-run";
import { canEditExhibitor, isPlatformAdmin } from "@/lib/platform-admin";
import { requireMembership } from "@/lib/tenant";
import { deleteExhibitor, findAndSaveExhibitorContact, updateExhibitor } from "../actions";
import { ExhibitorFields } from "../exhibitor-fields";
import { tradeShowOptions } from "../show-select";

// Finding a contact with AI can take up to a minute or two.
export const maxDuration = 300;

export default async function EditExhibitorPage({ params }: PageProps<"/a/[slug]/exhibitors/[id]">) {
  const { slug, id } = await params;
  const { user, organization } = await requireMembership(slug);
  const [exhibitor, shows] = await Promise.all([db.exhibitor.findUnique({ where: { id } }), tradeShowOptions()]);
  // Customers may only edit the exhibitors their own account added.
  if (!exhibitor || !canEditExhibitor(user.email, organization.id, exhibitor)) notFound();
  const useAi = isPlatformAdmin(user.email) && isAiConfigured();

  return (
    <>
      <PageHeader
        title={exhibitor.name}
        description="Changes are seen by every account in the system."
        action={<Link href={`/a/${slug}/exhibitors?show=${exhibitor.tradeShowId}`} className="btn-secondary">Back to list</Link>}
      />
      <SaveForm action={updateExhibitor.bind(null, slug, id)} title="Exhibitor details" description="Company name and trade show are required." submitLabel="Save changes" readOnly={false}>
        <ExhibitorFields findContact={useAi ? findAndSaveExhibitorContact.bind(null, slug, id) : undefined} exhibitor={exhibitor} shows={shows} />
      </SaveForm>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Delete exhibitor</h2>
          <p className="mt-0.5 text-sm text-muted">Removes it from the list for everyone.</p>
        </div>
        <ActionForm action={deleteExhibitor.bind(null, slug, id)} confirmMessage={`Delete ${exhibitor.name}? This cannot be undone.`}>
          <button className="btn-danger">Delete</button>
        </ActionForm>
      </section>
    </>
  );
}
