import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { companyDomain, summarizeCompany } from "@/lib/company";
import { syncCompanyKeys } from "@/lib/company-run";
import { countryName } from "@/lib/countries";
import { db } from "@/lib/db";
import { formatDateRange } from "@/lib/dates";
import { hasOwnHunter, searchedDomains, withOwnContacts } from "@/lib/own-contacts-run";
import { canManageMembers } from "@/lib/permissions";
import { canEditExhibitor } from "@/lib/platform-admin";
import { requireMembership } from "@/lib/tenant";
import { type ShowStatus, showStatus, STATUS_LABEL } from "@/lib/trade-shows";
import { setListMembership } from "../../lists/actions";
import { findOwnHunterContact } from "../actions";
import { FavoriteStar } from "../favorite-star";
import { ListMenu } from "../list-menu";
import { OwnContactTag, OwnHunterButton } from "../own-hunter-button";

// The Hunter.io lookup waits for an answer on this page.
export const maxDuration = 300;

const STATUS_PILL: Record<ShowStatus, string> = { upcoming: "pill-soft", running: "pill-ok", finished: "pill-neutral" };

/** One company and every trade show it exhibits at. */
export default async function CompanyPage({ params, searchParams }: PageProps<"/a/[slug]/exhibitors/company">) {
  const { slug } = await params;
  const { user, membership, organization } = await requireMembership(slug);
  const sp = await searchParams;
  const key = typeof sp.key === "string" ? sp.key : "";
  if (!key) notFound();

  await syncCompanyKeys();
  const shared = await db.exhibitor.findMany({
    where: { companyKey: key },
    include: { tradeShow: { select: { id: true, name: true, startDate: true, endDate: true, city: true, country: true, center: { select: { name: true } } } } },
    orderBy: [{ tradeShow: { startDate: "desc" } }, { name: "asc" }],
  });
  // With the contact this account found with its own Hunter.io key on top.
  const [rows, ownHunter, searched] = await Promise.all([
    withOwnContacts(organization.id, shared),
    hasOwnHunter(organization.id),
    searchedDomains(organization.id, shared.map((r) => r.website)),
  ]);
  if (rows.length === 0) notFound();
  const { main, first, shows } = summarizeCompany(rows);

  const [lists, saved] = await Promise.all([
    db.savedList.findMany({ where: { organizationId: organization.id }, select: { id: true, name: true, favorites: true }, orderBy: { name: "asc" } }),
    db.savedListItem.findMany({
      where: { exhibitorId: { in: rows.map((r) => r.id) }, list: { organizationId: organization.id } },
      select: { listId: true, exhibitorId: true },
    }),
  ]);
  const favoritesId = lists.find((l) => l.favorites)?.id;
  const ownLists = lists.filter((l) => !l.favorites);
  const savedIn = new Set(saved.map((s) => `${s.listId}:${s.exhibitorId}`));

  const website = first("website");
  const hunterRow = rows.find((r) => companyDomain(r.website));
  const hunterDomainOf = hunterRow && companyDomain(hunterRow.website);
  const industry = first("industry");
  const country = first("country");
  const otherNames = [...new Set(rows.map((r) => r.name))].filter((n) => n !== main.name);

  return (
    <>
      <PageHeader
        title={main.name}
        description={`Exhibits at ${shows.length} ${shows.length === 1 ? "trade show" : "trade shows"}.`}
        action={<Link href={`/a/${slug}/exhibitors`} className="btn-secondary">Back to exhibitors</Link>}
      />

      <section className="card space-y-3">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {website && (
            <p>
              <span className="block text-xs text-muted">Website</span>
              <a href={website} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                {website.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </p>
          )}
          {industry && (
            <p>
              <span className="block text-xs text-muted">Industry</span>
              <span className="font-medium">{industry}</span>
            </p>
          )}
          {country && (
            <p>
              <span className="block text-xs text-muted">Country</span>
              <span className="font-medium">{countryName(country)}</span>
            </p>
          )}
          {otherNames.length > 0 && (
            <p>
              <span className="block text-xs text-muted">Also listed as</span>
              <span className="font-medium">{otherNames.join(", ")}</span>
            </p>
          )}
        </div>
        {hunterRow && hunterDomainOf && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-subtle px-4 py-3 text-sm">
            {ownHunter ? (
              <>
                <p className="min-w-56 flex-1 text-muted">
                  Look up a contact person at {hunterDomainOf} with your own Hunter.io account (one credit). Only your account sees what is found.
                </p>
                <OwnHunterButton action={findOwnHunterContact.bind(null, slug, hunterRow.id)} again={searched.has(hunterDomainOf)} />
              </>
            ) : (
              <p className="min-w-56 flex-1 text-muted">
                Want the contact person here?{" "}
                {canManageMembers(membership.role) ? (
                  <Link href={`/a/${slug}/profile`} className="font-semibold text-brand hover:underline">Connect Hunter.io</Link>
                ) : (
                  "An owner or admin can connect Hunter.io on Company profile"
                )}{" "}
                to look up contacts with your own Hunter.io account. Only your account sees them.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card overflow-hidden p-0">
        <div className="px-5 py-4">
          <h2 className="font-bold">Trade shows ({shows.length})</h2>
          <p className="mt-0.5 text-sm text-muted">Every trade show this company exhibits at, newest first.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Trade show</th>
                <th className="px-4 py-2.5">Dates</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Booth</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const status = showStatus(e.tradeShow);
                const place = [e.tradeShow.center?.name, [e.tradeShow.city, e.tradeShow.country && countryName(e.tradeShow.country)].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={e.id} className="align-top">
                    {/* The name as listed at that show, which can differ a little between shows. */}
                    <td className="px-4 py-3">
                      <p className="min-w-36 font-semibold">{e.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-40">
                        <Link href={`/a/${slug}/exhibitors?show=${e.tradeShow.id}`} className="font-medium hover:text-brand">
                          {e.tradeShow.name}
                        </Link>
                        {place && <p className="text-xs text-muted">{place}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatDateRange(e.tradeShow.startDate, e.tradeShow.endDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`pill ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {e.boothNumber ?? (!e.standLocationUrl && <span className="text-faint">—</span>)}
                      {e.standLocationUrl && (
                        <a href={e.standLocationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                          <Icon name="pin" className="size-3.5" /> Floor plan
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-36">
                        {e.contactName && <p className="font-medium">{e.contactName}</p>}
                        {e.contactTitle && <p className="text-xs text-muted">{e.contactTitle}</p>}
                        {e.email && <a href={`mailto:${e.email}`} className="block text-xs font-medium text-brand hover:underline">{e.email}</a>}
                        {e.phone && <p className="text-xs text-muted">{e.phone}</p>}
                        {e.ownContact && <OwnContactTag />}
                        {!e.contactName && !e.email && !e.phone && <span className="text-faint">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <FavoriteStar slug={slug} exhibitorIds={e.id} name={`${e.name} at ${e.tradeShow.name}`} on={savedIn.has(`${favoritesId}:${e.id}`)} />
                        <ListMenu
                          action={setListMembership.bind(null, slug, e.id)}
                          lists={ownLists.map((l) => ({ id: l.id, name: l.name, inList: savedIn.has(`${l.id}:${e.id}`) }))}
                          newListHref={`/a/${slug}/lists`}
                        />
                        {canEditExhibitor(user.email, organization.id, e) && <Link href={`/a/${slug}/exhibitors/${e.id}`} className="btn-secondary">Edit</Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
