import type { FeatureRollout } from "@prisma/client";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { ROLLOUT_LABEL } from "@/lib/features";
import { requirePlatformAdmin } from "@/lib/tenant";
import { cleanupCutoff, oldTradeShowsWhere } from "@/lib/trade-show-cleanup";
import { setCleanupEnabled } from "./actions";

const ROLLOUT_PILL: Record<FeatureRollout, string> = {
  OFF: "pill-neutral",
  SELECTED: "pill-warn",
  EVERYONE: "pill-ok",
};

/** A check date as day/month/year, e.g. 01/11/2026. */
const updated = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Copenhagen" }).format(date);

export default async function FeatureControlPage({ params }: PageProps<"/a/[slug]/admin">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const [features, finder, waiting, groups, lastChecks, cleanup, oldShows, oldExhibitors] = await Promise.all([
    db.feature.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { access: true } } } }),
    db.showFinderSettings.findUnique({ where: { id: 1 } }),
    db.suggestedShow.count({ where: { status: "PENDING" } }),
    db.showFinderGroup.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { centers: true } } } }),
    // A group was last updated when the most recently checked of its centers was.
    db.exhibitionCenter.groupBy({ by: ["showsGroupId"], where: { showsGroupId: { not: null } }, _max: { showsCheckedAt: true } }),
    db.tradeShowCleanupSettings.findUnique({ where: { id: 1 } }),
    db.tradeShow.count({ where: oldTradeShowsWhere() }),
    db.exhibitor.count({ where: { tradeShow: oldTradeShowsWhere() } }),
  ]);
  const cleanupOn = Boolean(cleanup?.enabled);
  const cutoff = updated(cleanupCutoff());
  const lastCheck = (groupId: string) => lastChecks.find((l) => l.showsGroupId === groupId)?._max.showsCheckedAt ?? null;

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
              Checks chosen exhibition centers' events pages each month for new trade shows in the next 6 months and suggests them for you to approve.
            </span>
            {groups.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {groups.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center gap-x-2">
                    <span className="font-semibold">{g.name}</span>
                    <span className="text-muted">
                      {g._count.centers} {g._count.centers === 1 ? "center" : "centers"} ·{" "}
                      {lastCheck(g.id) ? `Updated: ${updated(lastCheck(g.id)!)}` : "Not checked yet"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              finder?.lastRunAt && <span className="mt-1 block text-sm text-muted">Updated: {updated(finder.lastRunAt)}</span>
            )}
          </span>
        </div>
        <Link href={`/a/${slug}/admin/show-finder`} className="btn-secondary">Open</Link>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-56 flex-1 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
            <Icon name="calendar" className="size-4" />
          </span>
          <span>
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              Delete old trade shows
              <span className={`pill ${cleanupOn ? "pill-ok" : "pill-neutral"}`}>{cleanupOn ? "On" : "Off"}</span>
            </span>
            <span className="block text-sm text-muted">
              Once a day, deletes trade shows that ended more than 3 years ago, together with their exhibitors. This cannot be undone.
            </span>
            <span className="mt-1 block text-sm">
              {oldShows === 0
                ? `No trade shows ended before ${cutoff}, so nothing would be deleted now.`
                : `${oldShows} ${oldShows === 1 ? "trade show" : "trade shows"} ended before ${cutoff} and would be deleted, with ${oldExhibitors} ${oldExhibitors === 1 ? "exhibitor" : "exhibitors"}.`}
            </span>
            {cleanup?.lastRunAt && (
              <span className="mt-1 block text-sm text-muted">
                Last run {updated(cleanup.lastRunAt)}: {cleanup.lastRunDeleted ?? 0} deleted
              </span>
            )}
          </span>
        </div>
        <ActionForm
          action={setCleanupEnabled.bind(null, slug, !cleanupOn)}
          confirmMessage={
            cleanupOn
              ? undefined
              : `Switch on? From the next daily run, trade shows that ended before ${cutoff} are deleted with their exhibitors (${oldShows} now). This cannot be undone.`
          }
        >
          <button className={cleanupOn ? "btn-secondary" : "btn"}>{cleanupOn ? "Switch off" : "Switch on"}</button>
        </ActionForm>
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
