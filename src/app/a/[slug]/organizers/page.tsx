import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { countryName, isCountryCode } from "@/lib/countries";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { requireMembership } from "@/lib/tenant";

export default async function OrganizersPage({ params, searchParams }: PageProps<"/a/[slug]/organizers">) {
  const { slug } = await params;
  const { user } = await requireMembership(slug);
  const canEdit = isPlatformAdmin(user.email);

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const country = typeof sp.country === "string" && isCountryCode(sp.country) ? sp.country : "";

  const where: Prisma.ExhibitionOrganizerWhereInput = {
    ...(country && { country }),
    ...(q && { name: { contains: q, mode: "insensitive" } }),
  };
  const [organizers, total, countries] = await Promise.all([
    db.exhibitionOrganizer.findMany({ where, orderBy: { name: "asc" } }),
    db.exhibitionOrganizer.count(),
    db.exhibitionOrganizer.findMany({ where: { country: { not: null } }, distinct: ["country"], select: { country: true } }),
  ]);
  const countryOptions = countries
    .map((c) => c.country!)
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const filtered = Boolean(q || country);

  return (
    <>
      <PageHeader
        title="Exhibition organizers"
        description="Companies that organize trade shows, shared by every account."
        action={
          canEdit && (
            <div className="flex gap-2">
              <Link href={`/a/${slug}/organizers/import`} className="btn-secondary py-2">
                <Icon name="upload" className="size-4" /> Import
              </Link>
              <Link href={`/a/${slug}/organizers/new`} className="btn">
                <Icon name="plus" className="size-4" /> Add organizer
              </Link>
            </div>
          )
        }
      />

      {total === 0 ? (
        <section className="card flex flex-col items-center gap-2 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon name="briefcase" className="size-6" />
          </span>
          <h2 className="mt-1 font-bold">No organizers yet</h2>
          <p className="text-sm text-muted">
            {canEdit ? "Add the first organizer, or import a list you already have." : "Organizers will show up here once they are added."}
          </p>
          {canEdit && (
            <Link href={`/a/${slug}/organizers/new`} className="btn mt-2">
              <Icon name="plus" className="size-4" /> Add organizer
            </Link>
          )}
        </section>
      ) : (
        <section className="card overflow-hidden p-0">
          <form className="flex flex-wrap items-center gap-2 p-4" role="search">
            <div className="relative min-w-56 flex-1">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input className="input pl-9" name="q" defaultValue={q} placeholder="Search by company name" aria-label="Search organizers" />
            </div>
            <select className="input w-auto" name="country" defaultValue={country} aria-label="Country">
              <option value="">All countries</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <button className="btn-secondary py-2">Search</button>
            {filtered && (
              <Link href={`/a/${slug}/organizers`} className="px-2 text-sm font-semibold text-muted hover:text-ink">
                Clear
              </Link>
            )}
          </form>
          <p className="border-t border-line px-5 py-2.5 text-sm text-muted">
            {filtered ? `${organizers.length} of ${total} organizers match` : `${total} ${total === 1 ? "organizer" : "organizers"}`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                  <th className="px-5 py-2.5">Organizer company</th>
                  <th className="px-5 py-2.5">Country</th>
                  <th className="px-5 py-2.5">Website</th>
                  {canEdit && <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {organizers.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3">
                      <div className="flex min-w-48 items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                          <Icon name="briefcase" className="size-4" />
                        </span>
                        <span className="font-semibold">{o.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{o.country ? countryName(o.country) : <span className="text-faint">—</span>}</td>
                    <td className="px-5 py-3">
                      {o.website ? (
                        <a href={o.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-brand hover:underline">
                          <Icon name="globe" className="size-4" /> Visit site
                        </a>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <Link href={`/a/${slug}/organizers/${o.id}`} className="btn-secondary">Edit</Link>
                      </td>
                    )}
                  </tr>
                ))}
                {organizers.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="px-5 py-8 text-center text-muted">
                      No organizers match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
