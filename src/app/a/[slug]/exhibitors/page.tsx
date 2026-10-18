import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { summarizeCompany } from "@/lib/company";
import { emptyProfileWhere, isCompanyProfileConfigured } from "@/lib/company-profile-run";
import { syncCompanyKeys } from "@/lib/company-run";
import { missingContactWhere } from "@/lib/contact-finder-run";
import { countryName } from "@/lib/countries";
import { db } from "@/lib/db";
import { formatDateRange } from "@/lib/dates";
import { type ExhibitorFilters, exhibitorFilters, exhibitorQuery, exhibitorWhere, industryTerms, isFiltered } from "@/lib/exhibitor-list";
import { countCountriesFromPhones } from "@/lib/phone-country-run";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { MAX_ADD_AT_ONCE } from "@/lib/saved-lists";
import { requireMembership } from "@/lib/tenant";
import { addShownToList, setListMembership } from "../lists/actions";
import { askAiSearch, fillContacts, fillCountries } from "./actions";
import { AiFillCard } from "./ai-fill-card";
import { AiSearch } from "./ai-search";
import { FavoriteStar } from "./favorite-star";
import { ListMenu } from "./list-menu";
import { ProfileFillCard } from "./profile-fill-card";
import { tradeShowOptions } from "./show-select";

const PAGE_SIZE = 50;
// Filters set only by Ask AI (and the question itself); the search form keeps them as hidden fields.
const AI_ONLY = ["industry", "showCountry", "showCity", "from", "to", "ai"] as const;
// A company's trade shows listed in its row; the rest are on its company page.
const SHOWS_IN_ROW = 3;

// "Fill missing profiles" and "Find missing contacts" run on this page and may take a few minutes.
export const maxDuration = 300;

export default async function ExhibitorsPage({ params, searchParams }: PageProps<"/a/[slug]/exhibitors">) {
  const { slug } = await params;
  const { user, organization } = await requireMembership(slug);
  const canEdit = isPlatformAdmin(user.email);

  const sp = await searchParams;
  const filters = exhibitorFilters(sp);
  const { q, show, country } = filters;
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  // A company at several trade shows is one row here (see src/lib/company.ts).
  await syncCompanyKeys();
  const where = exhibitorWhere(filters);
  const [groups, matchingRows, total, shows, countries] = await Promise.all([
    db.exhibitor.groupBy({
      by: ["companyKey"],
      where: { AND: [where, { companyKey: { not: null } }] },
      _min: { name: true },
      orderBy: { _min: { name: "asc" } },
    }),
    db.exhibitor.count({ where }),
    db.$queryRaw<{ n: number }[]>`SELECT COUNT(DISTINCT "companyKey")::int AS n FROM "Exhibitor"`.then((r) => r[0]?.n ?? 0),
    tradeShowOptions(),
    db.exhibitor.findMany({ where: { country: { not: null } }, distinct: ["country"], select: { country: true } }),
  ]);
  const matching = groups.length;
  const pageKeys = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((g) => g.companyKey!);
  // Every row of the companies on this page, latest trade show first, and which of them the filters match.
  const [rows, matchedRows] = await Promise.all([
    db.exhibitor.findMany({
      where: { companyKey: { in: pageKeys } },
      include: { tradeShow: { select: { id: true, name: true, startDate: true } } },
      orderBy: [{ tradeShow: { startDate: "desc" } }, { name: "asc" }],
    }),
    db.exhibitor.findMany({ where: { AND: [where, { companyKey: { in: pageKeys } }] }, select: { id: true } }),
  ]);
  const matched = new Set(matchedRows.map((r) => r.id));
  const companies = pageKeys.map((key) => ({
    key,
    ...summarizeCompany(
      rows.filter((r) => r.companyKey === key),
      (r) => matched.has(r.id),
    ),
  }));
  // This account's saved lists, and which of them each company on this page is on.
  const [lists, saved] = await Promise.all([
    db.savedList.findMany({ where: { organizationId: organization.id }, select: { id: true, name: true, favorites: true }, orderBy: { name: "asc" } }),
    db.savedListItem.findMany({
      where: { exhibitorId: { in: rows.map((e) => e.id) }, list: { organizationId: organization.id } },
      select: { listId: true, exhibitorId: true },
    }),
  ]);
  const favoritesId = lists.find((l) => l.favorites)?.id;
  const ownLists = lists.filter((l) => !l.favorites);
  const savedIn = new Set(saved.map((s) => `${s.listId}:${s.exhibitorId}`));
  const isIn = (listId: string | undefined, ids: string[]) => ids.some((id) => savedIn.has(`${listId}:${id}`));
  const useAi = canEdit && isCompanyProfileConfigured();
  const [missingProfiles, missingContacts] = useAi
    ? await Promise.all([
        db.exhibitor.count({ where: emptyProfileWhere(show || undefined) }),
        db.exhibitor.count({ where: missingContactWhere(show || undefined) }),
      ])
    : [0, 0];
  const missingCountries = canEdit ? await countCountriesFromPhones() : 0;
  const countryOptions = countries
    .map((c) => c.country!)
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const filtered = isFiltered(filters);
  const chips = filterChips(filters, shows);
  const clearHref = (keys: (keyof ExhibitorFilters)[]) => {
    const rest = { ...filters, ...Object.fromEntries(keys.map((k) => [k, ""])) };
    return `/a/${slug}/exhibitors${exhibitorQuery(isFiltered(rest) ? rest : { ...rest, ai: "" })}`;
  };
  const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const pageHref = (p: number) => `/a/${slug}/exhibitors${exhibitorQuery(filters, p > 1 ? { page: String(p) } : {})}`;
  const exportHref = (format: "xlsx" | "csv") => `/a/${slug}/exhibitors/export${exhibitorQuery(filters, { format })}`;
  const showParam = show ? `?show=${show}` : "";

  return (
    <>
      <PageHeader
        title="Exhibitors"
        description="Companies exhibiting at trade shows, shared by every account."
        action={
          <div className="flex flex-wrap gap-2">
            {matchingRows > 0 && (
              <>
                <a href={exportHref("xlsx")} download className="btn-secondary py-2" title={`Download the ${matching} ${matching === 1 ? "company" : "companies"} shown below as an Excel file, one row per trade show`}>
                  <Icon name="download" className="size-4" /> Excel
                </a>
                <a href={exportHref("csv")} download className="btn-secondary py-2" title={`Download the ${matching} ${matching === 1 ? "company" : "companies"} shown below as a CSV file, one row per trade show`}>
                  <Icon name="download" className="size-4" /> CSV
                </a>
              </>
            )}
            {canEdit && (
              <>
                <Link href={`/a/${slug}/exhibitors/import${showParam}`} className="btn-secondary py-2">
                  <Icon name="upload" className="size-4" /> Import
                </Link>
                <Link href={`/a/${slug}/exhibitors/new${showParam}`} className="btn">
                  <Icon name="plus" className="size-4" /> Add exhibitor
                </Link>
              </>
            )}
          </div>
        }
      />

      {missingProfiles > 0 && <ProfileFillCard slug={slug} tradeShowId={show || undefined} missing={missingProfiles} />}
      {missingContacts > 0 && (
        <AiFillCard
          title={`${missingContacts} ${missingContacts === 1 ? "exhibitor has" : "exhibitors have"} a website but no contact person or email`}
          text="AI looks for a contact person, position, email and phone on each company's own website and fills in only the empty fields. This also happens automatically during the night."
          button="Find missing contacts"
          pendingButton="Finding contacts…"
          action={fillContacts.bind(null, slug, show || undefined)}
        />
      )}

      {missingCountries > 0 && (
        <AiFillCard
          title={`${missingCountries} ${missingCountries === 1 ? "exhibitor has" : "exhibitors have"} no country, but a phone number that shows it`}
          text="The country is read from the phone number's international prefix, for example +45 or 0045 for Denmark. New exhibitors get it automatically."
          button="Fill countries"
          pendingButton="Filling countries…"
          action={fillCountries.bind(null, slug)}
        />
      )}

      {total === 0 ? (
        <section className="card flex flex-col items-center gap-2 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon name="store" className="size-6" />
          </span>
          <h2 className="mt-1 font-bold">No exhibitors yet</h2>
          <p className="text-sm text-muted">
            {canEdit ? "Add the first exhibitor, or import a trade show's exhibitor list." : "Exhibitors will show up here once they are added."}
          </p>
          {canEdit && (
            <Link href={`/a/${slug}/exhibitors/new`} className="btn mt-2">
              <Icon name="plus" className="size-4" /> Add exhibitor
            </Link>
          )}
        </section>
      ) : (
        <section className="card overflow-hidden p-0">
          {isCompanyProfileConfigured() && <AiSearch action={askAiSearch.bind(null, slug)} question={filters.ai} />}
          <form className="flex flex-wrap items-center gap-2 p-4" role="search">
            <div className="relative min-w-56 flex-1">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input className="input pl-9" name="q" defaultValue={q} placeholder="Search by company, contact person or industry" aria-label="Search exhibitors" />
            </div>
            <select className="input w-auto max-w-72" name="show" defaultValue={show} aria-label="Trade show">
              <option value="">All trade shows</option>
              {shows.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <select className="input w-auto" name="country" defaultValue={country} aria-label="Country">
              <option value="">All countries</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            {/* Filters only Ask AI sets; they stay until their chip is removed. */}
            {AI_ONLY.map((k) =>
              filters[k] ? <input key={k} type="hidden" name={k} value={filters[k]} /> : null,
            )}
            <button className="btn-secondary py-2">Search</button>
            {filtered && (
              <Link href={`/a/${slug}/exhibitors`} className="px-2 text-sm font-semibold text-muted hover:text-ink">
                Clear
              </Link>
            )}
          </form>
          {/* What the AI understood, or filters only it can set; the drop-downs above show the rest. */}
          {chips.length > 0 && AI_ONLY.some((k) => filters[k]) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-2.5 text-sm">
              <span className="text-muted">{filters.ai ? "AI understood:" : "Filters:"}</span>
              {chips.map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1 rounded-full border border-line bg-subtle py-0.5 pr-1 pl-2.5 text-xs font-medium">
                  <span className="text-muted">{c.name}:</span> {c.label}
                  <Link href={clearHref(c.keys)} className="grid size-5 place-items-center rounded-full text-faint hover:bg-line hover:text-ink" aria-label={`Remove ${c.name} filter`} title="Remove">
                    ×
                  </Link>
                </span>
              ))}
            </div>
          )}
          <p className="border-t border-line px-5 py-2.5 text-sm text-muted">
            {filtered ? `${matching} of ${total} companies match` : `${total} ${total === 1 ? "company" : "companies"}`}
            {matchingRows > matching && ` · ${matchingRows} trade show entries`}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </p>
          {filtered && matching > 0 && (
            <ActionForm action={addShownToList.bind(null, slug, filters)} className="flex flex-wrap items-center gap-2 border-t border-line bg-subtle px-5 py-2.5 text-sm">
              <Icon name="bookmark" className="size-4 text-brand" />
              <span className="font-semibold">
                Save {matching > MAX_ADD_AT_ONCE ? `${MAX_ADD_AT_ONCE} of them` : matching === 1 ? "this company" : `all ${matching}`} to
              </span>
              <select className="input w-auto max-w-64 py-1.5" name="list" aria-label="List" required defaultValue="">
                <option value="" disabled>Choose a list</option>
                <option value="favorites">Favorites</option>
                {ownLists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <button className="btn-secondary">Save</button>
            </ActionForm>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                  <th className="px-5 py-2.5">Company</th>
                  <th className="px-5 py-2.5">{show ? "Trade show" : "Trade shows"}</th>
                  <th className="px-5 py-2.5">Contact</th>
                  <th className="px-5 py-2.5">Country</th>
                  {show && <th className="px-5 py-2.5">Booth</th>}
                  <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {companies.map(({ key, main: e, contact, first, shows: companyShows, ids }) => {
                  const companyHref = `/a/${slug}/exhibitors/company?key=${encodeURIComponent(key)}`;
                  const industry = first("industry");
                  const website = first("website");
                  const country = first("country");
                  const listed = show ? companyShows.filter((s) => s.id === show) : companyShows.slice(0, SHOWS_IN_ROW);
                  const more = companyShows.length - listed.length;
                  return (
                    <tr key={key} className="align-top">
                      <td className="px-5 py-3">
                        <div className="flex min-w-52 items-start gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                            <Icon name="store" className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <Link href={companyHref} className="block font-semibold hover:text-brand">{e.name}</Link>
                            {industry && <p className="text-xs text-muted">{industry}</p>}
                            {website && (
                              <a href={website} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand hover:underline">
                                {website.replace(/^https?:\/\/(www\.)?/, "")}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="min-w-44 space-y-0.5">
                          {listed.map((s) => (
                            <Link key={s.id} href={`/a/${slug}/exhibitors?show=${s.id}`} className="block font-medium hover:text-brand">
                              {s.name}
                            </Link>
                          ))}
                          {more > 0 && (
                            <Link href={companyHref} className="block text-xs font-semibold text-brand hover:underline">
                              {show ? `Also at ${more} other ${more === 1 ? "show" : "shows"}` : `+${more} more ${more === 1 ? "show" : "shows"}`}
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="min-w-44">
                          {contact.contactName && <p className="font-medium">{contact.contactName}</p>}
                          {contact.contactTitle && <p className="text-xs text-muted">{contact.contactTitle}</p>}
                          {contact.email && <a href={`mailto:${contact.email}`} className="block text-xs font-medium text-brand hover:underline">{contact.email}</a>}
                          {contact.phone && <p className="text-xs text-muted">{contact.phone}</p>}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">{country ? countryName(country) : <span className="text-faint">—</span>}</td>
                      {show && (
                        <td className="px-5 py-3 whitespace-nowrap">
                          {e.boothNumber ?? (!e.standLocationUrl && <span className="text-faint">—</span>)}
                          {e.standLocationUrl && (
                            <a href={e.standLocationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                              <Icon name="pin" className="size-3.5" /> Floor plan
                            </a>
                          )}
                        </td>
                      )}
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Adds the row of the company's latest (or filtered) show; taking it off removes every show's row. */}
                          <FavoriteStar slug={slug} exhibitorIds={[e.id, ...ids.filter((id) => id !== e.id)]} name={e.name} on={isIn(favoritesId, ids)} />
                          <ListMenu
                            action={setListMembership.bind(null, slug, [e.id, ...ids.filter((id) => id !== e.id)])}
                            lists={ownLists.map((l) => ({ id: l.id, name: l.name, inList: isIn(l.id, ids) }))}
                            newListHref={`/a/${slug}/lists`}
                          />
                          {canEdit && <Link href={`/a/${slug}/exhibitors/${e.id}`} className="btn-secondary">Edit</Link>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={show ? 6 : 5} className="px-5 py-8 text-center text-muted">
                      No exhibitors match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-sm" aria-label="Pages">
              {page > 1 ? <Link href={pageHref(page - 1)} className="btn-secondary">Previous</Link> : <span />}
              <span className="text-muted">Page {page} of {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} className="btn-secondary">Next</Link> : <span />}
            </nav>
          )}
        </section>
      )}
    </>
  );
}

/** The filters that are set, each as a chip the user can remove, so they see what the AI understood. */
function filterChips(f: ExhibitorFilters, shows: { id: string; label: string }[]): { name: string; label: string; keys: (keyof ExhibitorFilters)[] }[] {
  const chips: { name: string; label: string; keys: (keyof ExhibitorFilters)[] }[] = [];
  if (f.q) chips.push({ name: "Search", label: f.q, keys: ["q"] });
  if (f.country) chips.push({ name: "Company country", label: countryName(f.country), keys: ["country"] });
  const terms = industryTerms(f.industry);
  if (terms.length) chips.push({ name: "Industry", label: terms.join(", "), keys: ["industry"] });
  if (f.show) chips.push({ name: "Trade show", label: shows.find((s) => s.id === f.show)?.label ?? "Chosen show", keys: ["show"] });
  if (f.showCountry) chips.push({ name: "Show in", label: countryName(f.showCountry), keys: ["showCountry"] });
  if (f.showCity) chips.push({ name: "Show city", label: f.showCity, keys: ["showCity"] });
  if (f.from || f.to) {
    const d = (v: string) => formatDateRange(new Date(v), new Date(v));
    const label = f.from && f.to ? `${d(f.from)} – ${d(f.to)}` : f.from ? `from ${d(f.from)}` : `until ${d(f.to)}`;
    chips.push({ name: "Show dates", label, keys: ["from", "to"] });
  }
  return chips;
}
