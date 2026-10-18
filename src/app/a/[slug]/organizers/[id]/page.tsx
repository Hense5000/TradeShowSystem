import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { countryName } from "@/lib/countries";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { requireMembership } from "@/lib/tenant";
import { showStatus, STATUS_LABEL, STATUS_PILL } from "@/lib/trade-shows";
import { deleteOrganizer, updateOrganizer } from "../actions";
import { OrganizerFields } from "../organizer-fields";

/** An organizer with all its trade shows. Platform admins can also edit or delete it here. */
export default async function OrganizerPage({ params }: PageProps<"/a/[slug]/organizers/[id]">) {
  const { slug, id } = await params;
  const { user } = await requireMembership(slug);
  const canEdit = isPlatformAdmin(user.email);
  const organizer = await db.exhibitionOrganizer.findUnique({
    where: { id },
    include: {
      tradeShows: {
        include: { center: { select: { name: true } }, _count: { select: { exhibitors: true } } },
        orderBy: [{ startDate: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!organizer) notFound();

  // Upcoming and running shows first, soonest first; then finished ones, most recent first.
  const withStatus = organizer.tradeShows.map((s) => ({ ...s, status: showStatus(s) }));
  const shows = [...withStatus.filter((s) => s.status !== "finished"), ...withStatus.filter((s) => s.status === "finished").reverse()];
  const coming = shows.filter((s) => s.status !== "finished").length;

  return (
    <>
      <PageHeader
        title={organizer.name}
        description={
          shows.length === 0
            ? "No trade shows are linked to this organizer yet."
            : `${shows.length} ${shows.length === 1 ? "trade show" : "trade shows"}, ${coming} upcoming or running.`
        }
        action={<Link href={`/a/${slug}/organizers`} className="btn-secondary">Back to list</Link>}
      />

      {(organizer.website || organizer.country) && (
        <section className="card flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {organizer.website && (
            <p>
              <span className="block text-xs text-muted">Website</span>
              <a href={organizer.website} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                {organizer.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </p>
          )}
          {organizer.country && (
            <p>
              <span className="block text-xs text-muted">Country</span>
              <span className="font-medium">{countryName(organizer.country)}</span>
            </p>
          )}
        </section>
      )}

      {shows.length > 0 && (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                  <th className="px-5 py-2.5">Trade show</th>
                  <th className="px-5 py-2.5">Dates</th>
                  <th className="px-5 py-2.5">Where</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Exhibitors</th>
                  {canEdit && <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shows.map((s) => {
                  const place = [s.city, s.country && countryName(s.country)].filter(Boolean).join(", ");
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3">
                        <div className="flex min-w-44 items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                            <Icon name="calendar" className="size-4" />
                          </span>
                          {s.website ? (
                            <a href={s.website} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-brand">{s.name}</a>
                          ) : (
                            <span className="font-semibold">{s.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums">{formatDateRange(s.startDate, s.endDate)}</td>
                      <td className="px-5 py-3">
                        {s.center && <p className="font-medium">{s.center.name}</p>}
                        <p className={s.center ? "text-xs text-muted" : ""}>{place || (!s.center && <span className="text-faint">—</span>)}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`pill ${STATUS_PILL[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {s._count.exhibitors > 0 ? (
                          <Link href={`/a/${slug}/exhibitors?show=${s.id}`} className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
                            <Icon name="users" className="size-4" /> {s._count.exhibitors}
                          </Link>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-5 py-3 text-right">
                          <Link href={`/a/${slug}/trade-shows/${s.id}`} className="btn-secondary">Edit</Link>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canEdit && (
        <>
          <SaveForm
            action={updateOrganizer.bind(null, slug, id)}
            title="Organizer details"
            description="Only the company name is required. Changes are seen by every account in the system."
            submitLabel="Save changes"
            readOnly={false}
          >
            <OrganizerFields organizer={organizer} />
          </SaveForm>
          <section className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Delete organizer</h2>
              <p className="mt-0.5 text-sm text-muted">Removes it from the list for everyone. Its trade shows stay, without an organizer.</p>
            </div>
            <ActionForm action={deleteOrganizer.bind(null, slug, id)} confirmMessage={`Delete ${organizer.name}? This cannot be undone.`}>
              <button className="btn-danger">Delete</button>
            </ActionForm>
          </section>
        </>
      )}
    </>
  );
}
