import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { countryName } from "@/lib/countries";
import { db } from "@/lib/db";
import { FAVORITES_NAME, MAX_LIST_NAME } from "@/lib/saved-lists";
import { requireMembership } from "@/lib/tenant";
import { deleteList, renameList, setListMembership, toggleFavorite } from "../actions";

const PAGE_SIZE = 50;

export default async function SavedListPage({ params, searchParams }: PageProps<"/a/[slug]/lists/[id]">) {
  const { slug, id } = await params;
  const { organization } = await requireMembership(slug);

  // "favorites" opens the account's Favorites list, even before it has been created.
  const isFavorites = id === "favorites";
  const list = await db.savedList.findFirst({
    where: { organizationId: organization.id, ...(isFavorites ? { favorites: true } : { id }) },
  });
  if (!list && !isFavorites) notFound();
  const listId = list?.id ?? "";

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);
  const where = { savedIn: { some: { listId } } };
  const [exhibitors, count] = list
    ? await Promise.all([
        db.exhibitor.findMany({
          where,
          include: { tradeShow: { select: { id: true, name: true } } },
          orderBy: [{ name: "asc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        db.exhibitor.count({ where }),
      ])
    : [[], 0];
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const base = `/a/${slug}/lists/${id}`;
  const exportHref = (format: "xlsx" | "csv") => `/a/${slug}/exhibitors/export?list=${listId}&format=${format}`;
  const name = list?.name ?? FAVORITES_NAME;

  return (
    <>
      <PageHeader
        title={name}
        description={`${count} ${count === 1 ? "exhibitor" : "exhibitors"} · saved list for everyone in ${organization.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            {count > 0 && (
              <>
                <a href={exportHref("xlsx")} download className="btn-secondary py-2" title={`Download the ${count} exhibitors on this list as an Excel file`}>
                  <Icon name="download" className="size-4" /> Excel
                </a>
                <a href={exportHref("csv")} download className="btn-secondary py-2" title={`Download the ${count} exhibitors on this list as a CSV file`}>
                  <Icon name="download" className="size-4" /> CSV
                </a>
              </>
            )}
            <Link href={`/a/${slug}/lists`} className="btn-secondary py-2">All lists</Link>
          </div>
        }
      />

      {count === 0 ? (
        <section className="card flex flex-col items-center gap-2 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon name={isFavorites || list?.favorites ? "star" : "bookmark"} className="size-6" />
          </span>
          <h2 className="mt-1 font-bold">This list is empty</h2>
          <p className="text-sm text-muted">
            {list?.favorites || isFavorites
              ? "Click the star next to an exhibitor on the Exhibitors page to add it here."
              : "Use the Save button next to an exhibitor on the Exhibitors page to add it here."}
          </p>
          <Link href={`/a/${slug}/exhibitors`} className="btn mt-2">
            <Icon name="store" className="size-4" /> Go to exhibitors
          </Link>
        </section>
      ) : (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                  <th className="px-5 py-2.5">Company</th>
                  <th className="px-5 py-2.5">Trade show</th>
                  <th className="px-5 py-2.5">Contact</th>
                  <th className="px-5 py-2.5">Country</th>
                  <th className="px-5 py-2.5">Booth</th>
                  <th className="px-5 py-2.5"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {exhibitors.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="min-w-52">
                        <p className="font-semibold">{e.name}</p>
                        {e.industry && <p className="text-xs text-muted">{e.industry}</p>}
                        {e.website && (
                          <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand hover:underline">
                            {e.website.replace(/^https?:\/\/(www\.)?/, "")}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/a/${slug}/exhibitors?show=${e.tradeShow.id}`} className="font-medium hover:text-brand">
                        {e.tradeShow.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="min-w-44">
                        {e.contactName && <p className="font-medium">{e.contactName}</p>}
                        {e.contactTitle && <p className="text-xs text-muted">{e.contactTitle}</p>}
                        {e.email && <a href={`mailto:${e.email}`} className="block text-xs font-medium text-brand hover:underline">{e.email}</a>}
                        {e.phone && <p className="text-xs text-muted">{e.phone}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{e.country ? countryName(e.country) : <span className="text-faint">—</span>}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{e.boothNumber ?? <span className="text-faint">—</span>}</td>
                    <td className="px-5 py-3 text-right">
                      <form action={list!.favorites ? toggleFavorite.bind(null, slug, e.id, false) : setListMembership.bind(null, slug, e.id)}>
                        <button name="change" value={`remove:${listId}`} className="btn-secondary" title={`Remove ${e.name} from this list`}>
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-sm" aria-label="Pages">
              {page > 1 ? <Link href={page > 2 ? `${base}?page=${page - 1}` : base} className="btn-secondary">Previous</Link> : <span />}
              <span className="text-muted">Page {page} of {pages}</span>
              {page < pages ? <Link href={`${base}?page=${page + 1}`} className="btn-secondary">Next</Link> : <span />}
            </nav>
          )}
        </section>
      )}

      {list && !list.favorites && (
        <>
          <SaveForm action={renameList.bind(null, slug, list.id)} title="List name" description="Everyone in the account sees the new name." submitLabel="Save name" readOnly={false}>
            <Field id="name" label="Name" defaultValue={list.name} required maxLength={MAX_LIST_NAME} />
          </SaveForm>
          <section className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Delete list</h2>
              <p className="mt-0.5 text-sm text-muted">The exhibitors stay in the system. Only this list goes.</p>
            </div>
            <ActionForm action={deleteList.bind(null, slug, list.id)} confirmMessage={`Delete the list ${list.name}? This cannot be undone.`}>
              <button className="btn-danger">Delete list</button>
            </ActionForm>
          </section>
        </>
      )}
    </>
  );
}
