import type { FeatureRollout } from "@prisma/client";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { ROLLOUT_LABEL } from "@/lib/features";
import { requirePlatformAdmin } from "@/lib/tenant";

const ROLLOUT_PILL: Record<FeatureRollout, string> = {
  OFF: "pill-neutral",
  SELECTED: "pill-warn",
  EVERYONE: "pill-ok",
};

export default async function FeatureControlPage({ params }: PageProps<"/a/[slug]/admin">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const [features, finder, waiting] = await Promise.all([
    db.feature.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { access: true } } } }),
    db.showFinderSettings.findUnique({ where: { id: 1 } }),
    db.suggestedShow.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Feature control"
        description="Only super admins see this page. Add upcoming features and decide which customers can see them."
        action={
          <Link href={`/a/${slug}/admin/new`} className="btn">
            <Icon name="plus" className="size-4" /> Add feature
          </Link>
        }
      />

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-56 flex-1 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon name="search" className="size-4" />
          </span>
          <span>
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              AI trade show finder
              <span className={`pill ${finder?.enabled ? "pill-ok" : "pill-neutral"}`}>{finder?.enabled ? "On" : "Off"}</span>
              {waiting > 0 && <span className="pill pill-warn">{waiting} waiting for approval</span>}
            </span>
            <span className="block text-sm text-muted">
              Checks chosen exhibition centers' events pages each month and suggests new trade shows for you to approve.
            </span>
          </span>
        </div>
        <Link href={`/a/${slug}/admin/show-finder`} className="btn-secondary">Open</Link>
      </section>

      {features.length === 0 ? (
        <section className="card flex flex-col items-center gap-2 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon name="shield" className="size-6" />
          </span>
          <h2 className="mt-1 font-bold">No features yet</h2>
          <p className="text-sm text-muted">Add the first upcoming feature. It stays hidden until you switch it on.</p>
          <Link href={`/a/${slug}/admin/new`} className="btn mt-2">
            <Icon name="plus" className="size-4" /> Add feature
          </Link>
        </section>
      ) : (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-left text-[0.7rem] font-semibold tracking-wider text-muted uppercase">
                  <th className="px-5 py-2.5">Feature</th>
                  <th className="px-5 py-2.5">Who can see it</th>
                  <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {features.map((f) => (
                  <tr key={f.id}>
                    <td className="px-5 py-3">
                      <div className="flex min-w-56 items-start gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                          <Icon name="grid" className="size-4" />
                        </span>
                        <span>
                          <span className="block font-semibold">{f.name}</span>
                          {f.description && <span className="block text-muted">{f.description}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`pill ${ROLLOUT_PILL[f.rollout]}`}>{ROLLOUT_LABEL[f.rollout]}</span>
                      {f.rollout === "SELECTED" && (
                        <span className="ml-2 text-muted">
                          {f._count.access} {f._count.access === 1 ? "account" : "accounts"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/a/${slug}/admin/${f.id}`} className="btn-secondary">Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
