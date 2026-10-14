import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { formatDateRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { isShowFinderConfigured } from "@/lib/show-finder-run";
import { requirePlatformAdmin } from "@/lib/tenant";
import {
  checkCenterNow,
  checkGroupNow,
  createGroup,
  deleteGroup,
  removeAddedShow,
  removeCenterFromFinder,
  renameGroup,
  runFinderNow,
  setCenterChosen,
  setCenterGroup,
  setFinderEnabled,
} from "./actions";
import { CenterRow } from "./center-row";
import { GroupRow } from "./group-row";
import { RunButton } from "./run-button";

// "Check now" reads several pages with the AI, which takes a while.
export const maxDuration = 300;

const when = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(date);

/** How many of the latest added shows are listed. */
const ADDED_LIMIT = 30;

/** How many centers the list shows at once; search to find the rest. */
const LIST_LIMIT = 100;

export default async function ShowFinderPage({ params, searchParams }: PageProps<"/a/[slug]/admin/show-finder">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const [settings, chosen, added, addedCount, groups, tickedByGroup] = await Promise.all([
    db.showFinderSettings.findUnique({ where: { id: 1 } }),
    db.exhibitionCenter.count({ where: { findShows: true } }),
    db.suggestedShow.findMany({
      where: { status: "APPROVED", tradeShowId: { not: null } },
      orderBy: { decidedAt: "desc" },
      take: ADDED_LIMIT,
      include: { center: { select: { name: true } } },
    }),
    db.suggestedShow.count({ where: { status: "APPROVED", tradeShowId: { not: null } } }),
    db.showFinderGroup.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { centers: true } } } }),
    db.exhibitionCenter.groupBy({ by: ["showsGroupId"], where: { findShows: true, showsGroupId: { not: null } }, _count: true }),
  ]);
  const groupFilter = typeof sp.group === "string" ? groups.find((g) => g.id === sp.group) : undefined;
  const enabled = settings?.enabled ?? false;
  const keyMissing = !isShowFinderConfigured();
  const cronMissing = !process.env.CRON_SECRET;
  // Without a search the list shows the chosen centers; a search looks through all of them.
  const showAll = sp.show === "all" || Boolean(q) || chosen === 0 || Boolean(groupFilter);
  const where = {
    ...(!showAll && { findShows: true }),
    ...(groupFilter && { showsGroupId: groupFilter.id }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { city: { contains: q, mode: "insensitive" as const } }] }),
  };
  const [centers, matching] = await Promise.all([
    db.exhibitionCenter.findMany({ where, orderBy: [{ findShows: "desc" }, { name: "asc" }], take: LIST_LIMIT }),
    db.exhibitionCenter.count({ where }),
  ]);
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <>
      <PageHeader
        title="AI trade show finder"
        description="Reads the events pages of the centers you choose once a month and adds the new trade shows starting in the next 6 months to the trade show list. Shows already in the system are skipped."
        action={<Link href={`/a/${slug}/admin`} className="btn-secondary">Back to Feature control</Link>}
      />

      <section className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              Automatic check <span className={`pill ${enabled ? "pill-ok" : "pill-neutral"}`}>{enabled ? "On" : "Off"}</span>
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {enabled
                ? "Every chosen center is checked on the 1st of each month, and new shows are added to the trade show list at once. With many centers, the ones not reached on the 1st are checked on the following days."
                : "Switch it on to check the chosen centers on the 1st of each month. You can still check by hand while it is off."}
            </p>
          </div>
          <ActionForm action={setFinderEnabled.bind(null, slug, !enabled)}>
            <button className={enabled ? "btn-secondary" : "btn"}>{enabled ? "Switch off" : "Switch on"}</button>
          </ActionForm>
        </div>

        {(keyMissing || cronMissing) && (
          <div className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            <p className="font-semibold">Setup needed in Vercel (Settings → Environment Variables):</p>
            <ul className="mt-1 list-disc pl-5">
              {keyMissing && <li>ANTHROPIC_API_KEY: the key for the AI service. Without it nothing can be checked.</li>}
              {cronMissing && <li>CRON_SECRET: any long random text. Without it the check on the 1st does not start by itself.</li>}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-sm text-muted">
            {settings?.lastRunAt ? (
              <>
                Last check {when(settings.lastRunAt)}: {settings.lastRunSummary}
              </>
            ) : (
              "No check has run yet."
            )}
          </p>
          {!keyMissing && chosen > 0 && chosen <= 20 && <RunButton action={runFinderNow.bind(null, slug)} />}
          {chosen > 20 && (
            <p className="text-sm text-muted">With {chosen} centers chosen, check them one at a time with &quot;Check now&quot; in the list below.</p>
          )}
          {chosen === 0 && <p className="text-sm text-muted">Choose at least one center below to start.</p>}
        </div>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="p-5">
          <h2 className="font-bold">Added by the finder ({addedCount})</h2>
          <p className="mt-0.5 text-sm text-muted">
            The latest trade shows the finder added to the list. If one is wrong, remove it here; the finder will not add it again. To
            correct a name or date, edit the show in Trade shows.
          </p>
        </div>
        {added.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">Nothing added yet.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {added.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 text-sm">
                <div className="flex min-w-0 flex-1 basis-64 flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/a/${slug}/trade-shows/${s.tradeShowId}`} className="font-semibold hover:text-brand hover:underline">
                    {s.name}
                  </Link>
                  <span className="text-muted">{formatDateRange(s.startDate, s.endDate)}</span>
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Icon name="pin" className="size-4" /> {s.center.name}
                  </span>
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                    Found on this page
                  </a>
                  {s.decidedAt && <span className="text-xs text-faint">Added {when(s.decidedAt)}</span>}
                </div>
                <ActionForm
                  action={removeAddedShow.bind(null, slug, s.id)}
                  confirmMessage={`Remove ${s.name} from the trade show list? The finder will not add it again.`}
                >
                  <button className="btn-danger">Remove</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden p-0">
        <div className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-bold">Check groups ({groups.length})</h2>
            <p className="mt-0.5 text-sm text-muted">
              Put centers in named groups, such as Europe, USA or Asia, to keep them apart and check a whole group at once. Pick the group
              on each center in the list below.
            </p>
          </div>
          <ActionForm action={createGroup.bind(null, slug)} className="flex flex-wrap items-center gap-2">
            <input className="input max-w-xs" name="name" placeholder="New group, e.g. Europe" required maxLength={60} aria-label="Group name" />
            <button className="btn-secondary py-2">Add group</button>
          </ActionForm>
        </div>
        {groups.length > 0 && (
          <ul className="divide-y divide-line border-t border-line">
            {groups.map((g) => (
              <GroupRow
                key={g.id}
                name={g.name}
                centers={g._count.centers}
                ticked={tickedByGroup.find((t) => t.showsGroupId === g.id)?._count ?? 0}
                href={`/a/${slug}/admin/show-finder?group=${g.id}`}
                canCheck={!keyMissing}
                checkNow={checkGroupNow.bind(null, slug, g.id)}
                rename={renameGroup.bind(null, slug, g.id)}
                remove={deleteGroup.bind(null, slug, g.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden p-0">
        <div className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-bold">
              {groupFilter ? `Centers in ${groupFilter.name}` : `Centers to check (${chosen} chosen)`}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Tick a center to check it automatically on the 1st of each month, and pick its group if you like. &quot;Check now&quot; checks one
              center right away, ticked or not.
            </p>
          </div>
          <form className="flex flex-wrap items-center gap-2" role="search">
            <div className="relative min-w-56 flex-1">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input className="input pl-9" name="q" defaultValue={q} placeholder="Find a center by name or city" aria-label="Search centers" />
            </div>
            <button className="btn-secondary py-2">Search</button>
            {groupFilter && <input type="hidden" name="group" value={groupFilter.id} />}
            {(q || showAll) && chosen > 0 && (
              <Link href={`/a/${slug}/admin/show-finder`} className="px-2 text-sm font-semibold text-muted hover:text-ink">
                Show chosen only
              </Link>
            )}
            {(!showAll || groupFilter) && (
              <Link href={`/a/${slug}/admin/show-finder?show=all`} className="px-2 text-sm font-semibold text-muted hover:text-ink">
                Show all centers
              </Link>
            )}
          </form>
        </div>
        <p className="border-t border-line px-5 py-2.5 text-sm text-muted">
          {matching > centers.length
            ? `Showing ${centers.length} of ${matching} centers. Search to find the others.`
            : `${matching} ${matching === 1 ? "center" : "centers"}${showAll ? "" : " chosen"}${groupFilter ? ` in ${groupFilter.name}` : ""}`}
        </p>
        {centers.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">
            {q
              ? "No centers match your search."
              : groupFilter
                ? "No centers in this group yet. Show all centers and pick the group on the ones you want."
                : "There are no exhibition centers yet."}
          </p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {centers.map((c) => (
              <CenterRow
                key={c.id}
                name={c.name}
                eventsUrl={c.eventsUrl}
                chosen={c.findShows}
                groupId={c.showsGroupId}
                groups={groupOptions}
                status={
                  c.showsCheckError
                    ? `Last check: ${c.showsCheckError}`
                    : c.showsCheckedAt
                      ? `Last check ${when(c.showsCheckedAt)}: ${c.showsCheckNote ?? `${c.showsFoundLast ?? 0} new`}`
                      : null
                }
                statusIsError={Boolean(c.showsCheckError)}
                canCheck={!keyMissing}
                setChosen={setCenterChosen.bind(null, slug, c.id)}
                setGroup={setCenterGroup.bind(null, slug, c.id)}
                checkNow={checkCenterNow.bind(null, slug, c.id)}
                remove={removeCenterFromFinder.bind(null, slug, c.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
