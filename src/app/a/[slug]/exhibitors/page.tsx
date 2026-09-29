import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { countryName, isCountryCode } from "@/lib/countries";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { requireMembership } from "@/lib/tenant";
import { tradeShowOptions } from "./show-select";

const PAGE_SIZE = 50;

export default async function ExhibitorsPage({ params, searchParams }: PageProps<"/a/[slug]/exhibitors">) {
  const { slug } = await params;
  const { user } = await requireMembership(slug);
  const canEdit = isPlatformAdmin(user.email);

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const show = typeof sp.show === "string" ? sp.show : "";
  const country = typeof sp.country === "string" && isCountryCode(sp.country) ? sp.country : "";
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const where: Prisma.ExhibitorWhereInput = {
    ...(show && { tradeShowId: show }),
    ...(country && { country }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { industry: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const [exhibitors, matching, total, shows, countries] = await Promise.all([
    db.exhibitor.findMany({
      where,
      include: { tradeShow: { select: { id: true, name: true } } },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.exhibitor.count({ where }),
    db.exhibitor.count(),
    tradeShowOptions(),
    db.exhibitor.findMany({ where: { country: { not: null } }, distinct: ["country"], select: { country: true } }),
  ]);
  const countryOptions = countries
    .map((c) => c.country!)
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const filtered = Boolean(q || show || country);
  const pages = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams({ ...(q && { q }), ...(show && { show }), ...(country && { country }), ...(p > 1 && { page: String(p) }) });
    return `/a/${slug}/exhibitors${qs.size ? `?${qs}` : ""}`;
  };
  const showParam = show ? `?show=${show}` : "";

  return (
    <>
      <PageHeader
        title="Exhibitors"
        description="Companies exhibiting at trade shows, shared by every account."
        action={
          canEdit && (
            <div className="flex gap-2">
              <Link href={`/a/${slug}/exhibitors/import${showParam}`} className="btn-secondary py-2">
                <Icon name="upload" className="size-4" /> Import
              </Link>
              <Link href={`/a/${slug}/exhibitors/new${showParam}`} className="btn">
                <Icon name="plus" className="size-4" /> Add exhibitor
              </Link>
            </div>
          )
        }
      />

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
            <button className="btn-secondary py-2">Search</button>
            {filtered && (
              <Link href={`/a/${slug}/exhibitors`} className="px-2 text-sm font-semibold text-muted hover:text-ink">
                Clear
              </Link>
            )}
          </form>
          <p className="border-t border-line px-5 py-2.5 text-sm text-muted">
            {filtered ? `${matching} of ${total} exhibitors match` : `${total} ${total === 1 ? "exhibitor" : "exhibitors"}`}
            {pages > 1 && ` · page ${page} of ${pages}`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                  <th className="px-5 py-2.5">Company</th>
                  <th className="px-5 py-2.5">Trade show</th>
                  <th className="px-5 py-2.5">Contact</th>
                  <th className="px-5 py-2.5">Country</th>
                  <th className="px-5 py-2.5">Booth</th>
                  {canEdit && <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {exhibitors.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="flex min-w-52 items-start gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                          <Icon name="store" className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold">{e.name}</p>
                          {e.industry && <p className="text-xs text-muted">{e.industry}</p>}
                          {e.website && (
                            <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand hover:underline">
                              {e.website.replace(/^https?:\/\/(www\.)?/, "")}
                            </a>
                          )}
                        </div>
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
                        <a href={`mailto:${e.email}`} className="block text-xs font-medium text-brand hover:underline">{e.email}</a>
                        {e.phone && <p className="text-xs text-muted">{e.phone}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{e.country ? countryName(e.country) : <span className="text-faint">—</span>}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {e.boothNumber ?? (!e.standLocationUrl && <span className="text-faint">—</span>)}
                      {e.standLocationUrl && (
                        <a href={e.standLocationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                          <Icon name="pin" className="size-3.5" /> Floor plan
                        </a>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <Link href={`/a/${slug}/exhibitors/${e.id}`} className="btn-secondary">Edit</Link>
                      </td>
                    )}
                  </tr>
                ))}
                {exhibitors.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="px-5 py-8 text-center text-muted">
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
