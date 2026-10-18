import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { FAVORITES_NAME, MAX_LIST_NAME } from "@/lib/saved-lists";
import { requireMembership } from "@/lib/tenant";
import { createList, setListEmails } from "./actions";

export default async function SavedListsPage({ params }: PageProps<"/a/[slug]/lists">) {
  const { slug } = await params;
  const { user, organization } = await requireMembership(slug);

  const lists = await db.savedList.findMany({
    where: { organizationId: organization.id },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });
  const favorites = lists.find((l) => l.favorites);
  const rows = [
    { id: "favorites", name: FAVORITES_NAME, count: favorites?._count.items ?? 0, updatedAt: favorites?.updatedAt, favorites: true },
    ...lists.filter((l) => !l.favorites).map((l) => ({ id: l.id, name: l.name, count: l._count.items, updatedAt: l.updatedAt, favorites: false })),
  ];
  const changed = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <PageHeader
        title="Saved lists"
        description={`Lists of exhibitors you want to contact. Everyone in ${organization.name} sees the same lists.`}
      />

      <section className="card">
        <h2 className="font-bold">New list</h2>
        <p className="mt-0.5 text-sm text-muted">
          Then add exhibitors from the Exhibitors page with the <span className="font-semibold text-ink">Save</span> button, or save all the exhibitors a search shows at once.
        </p>
        <ActionForm action={createList.bind(null, slug)} className="mt-4 flex flex-wrap gap-2">
          <input className="input max-w-md flex-1" name="name" required maxLength={MAX_LIST_NAME} placeholder="For example: Contact before Medica 2026" aria-label="List name" />
          <button className="btn">
            <Icon name="plus" className="size-4" /> Create list
          </button>
        </ActionForm>
      </section>

      <section className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
              <th className="px-5 py-2.5">List</th>
              <th className="px-5 py-2.5">Exhibitors</th>
              <th className="hidden px-5 py-2.5 sm:table-cell">Last changed</th>
              <th className="px-5 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3">
                  <Link href={`/a/${slug}/lists/${l.id}`} className="flex items-center gap-2.5 font-semibold hover:text-brand">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <Icon name={l.favorites ? "star" : "bookmark"} className="size-4" filled={l.favorites} />
                    </span>
                    {l.name}
                  </Link>
                </td>
                <td className="px-5 py-3">{l.count}</td>
                <td className="hidden px-5 py-3 text-muted sm:table-cell">{l.updatedAt ? changed(l.updatedAt) : "—"}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/a/${slug}/lists/${l.id}`} className="btn-secondary">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 1 && (
          <p className="border-t border-line px-5 py-4 text-sm text-muted">
            Click the star next to an exhibitor to add it to {FAVORITES_NAME}, or create your own lists above.
          </p>
        )}
      </section>

      {isEmailConfigured() && (
        <section className="card flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon name="mail" className="size-5" />
            </span>
            <div>
              <h2 className="flex items-center gap-2 font-bold">
                Daily email {user.listEmails ? <span className="pill pill-ok">On</span> : <span className="pill pill-neutral">Off</span>}
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                Each morning you get one email to {user.email} when something is new in {FAVORITES_NAME}: exhibitors other users starred, new or changed details such as contact person, email or phone, follow-ups that are due, and new exhibitors at your favorite trade shows that look like the ones you have starred. Your other lists are not included. Only you are affected by this setting.
              </p>
            </div>
          </div>
          <form action={setListEmails.bind(null, slug, !user.listEmails)}>
            <button className={user.listEmails ? "btn-secondary" : "btn"}>{user.listEmails ? "Turn off" : "Turn on"}</button>
          </form>
        </section>
      )}
    </>
  );
}
