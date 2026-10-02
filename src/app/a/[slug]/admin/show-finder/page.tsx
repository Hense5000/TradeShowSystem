import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { SaveForm } from "@/components/save-form";
import { formatDateRange, isoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { isShowFinderConfigured } from "@/lib/show-finder-run";
import { requirePlatformAdmin } from "@/lib/tenant";
import { approveSuggestion, rejectSuggestion, runFinderNow, saveFinderCenters, setFinderEnabled } from "./actions";
import { ApproveForm } from "./approve-form";
import { RunButton } from "./run-button";

// "Check now" reads several pages with the AI, which takes a while.
export const maxDuration = 300;

const when = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(date);

export default async function ShowFinderPage({ params }: PageProps<"/a/[slug]/admin/show-finder">) {
  const { slug } = await params;
  await requirePlatformAdmin(slug);
  const [settings, centers, pending, decided] = await Promise.all([
    db.showFinderSettings.findUnique({ where: { id: 1 } }),
    db.exhibitionCenter.findMany({ orderBy: { name: "asc" } }),
    db.suggestedShow.findMany({ where: { status: "PENDING" }, orderBy: { startDate: "asc" }, include: { center: true } }),
    db.suggestedShow.groupBy({ by: ["status"], where: { status: { not: "PENDING" } }, _count: true }),
  ]);
  const enabled = settings?.enabled ?? false;
  const keyMissing = !isShowFinderConfigured();
  const cronMissing = !process.env.CRON_SECRET;
  const chosen = centers.filter((c) => c.findShows).length;
  const count = (status: string) => decided.find((d) => d.status === status)?._count ?? 0;

  return (
    <>
      <PageHeader
        title="AI trade show finder"
        description="Reads the events pages of the centers you choose and suggests new trade shows. Nothing joins the list until you approve it."
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
                ? "Each chosen center is checked about once a month. New finds wait below for your approval."
                : "Switch it on to check the chosen centers about once a month. You can still check by hand while it is off."}
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
              {cronMissing && <li>CRON_SECRET: any long random text. Without it the monthly check does not start by itself.</li>}
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
          {!keyMissing && chosen > 0 && <RunButton action={runFinderNow.bind(null, slug)} />}
          {chosen === 0 && <p className="text-sm text-muted">Choose at least one center below to start.</p>}
        </div>
      </section>

      <section className="card overflow-hidden p-0">
        <div className="p-5">
          <h2 className="font-bold">Waiting for your approval ({pending.length})</h2>
          <p className="mt-0.5 text-sm text-muted">
            Check the name and dates against the events page, correct them if needed, then approve. So far {count("APPROVED")} approved and{" "}
            {count("REJECTED")} rejected; rejected shows are not suggested again.
          </p>
        </div>
        {pending.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">Nothing to review right now.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-muted">{formatDateRange(s.startDate, s.endDate)}</span>
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Icon name="pin" className="size-4" /> {s.center.name}
                  </span>
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                    Found on this page
                  </a>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <ApproveForm action={approveSuggestion.bind(null, slug, s.id)}>
                    <label className="min-w-48 flex-[2]">
                      <span className="label">Name</span>
                      <input className="input" name="name" defaultValue={s.name} required maxLength={150} />
                    </label>
                    <label className="min-w-36 flex-1">
                      <span className="label">Start date</span>
                      <input className="input" type="date" name="startDate" defaultValue={isoDate(s.startDate)} required />
                    </label>
                    <label className="min-w-36 flex-1">
                      <span className="label">End date</span>
                      <input className="input" type="date" name="endDate" defaultValue={isoDate(s.endDate)} required />
                    </label>
                    <label className="min-w-48 flex-[2]">
                      <span className="label">Website</span>
                      <input className="input" name="website" defaultValue={s.website ?? ""} maxLength={300} />
                    </label>
                    <button className="btn">
                      <Icon name="check" className="size-4" /> Approve
                    </button>
                  </ApproveForm>
                  <ActionForm action={rejectSuggestion.bind(null, slug, s.id)}>
                    <button className="btn-danger py-2">Reject</button>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SaveForm
        action={saveFinderCenters.bind(null, slug)}
        title={`Centers to check (${chosen} chosen)`}
        description="Tick the centers whose events page should be read. The page is the center's Local events URL."
        submitLabel="Save centers"
        readOnly={false}
      >
        {centers.length === 0 ? (
          <p className="text-sm text-muted">
            There are no exhibition centers yet. <Link href={`/a/${slug}/centers/new`} className="font-semibold text-brand hover:underline">Add one</Link>.
          </p>
        ) : (
          <div className="max-h-[28rem] divide-y divide-line overflow-y-auto rounded-lg border border-line-strong">
            {centers.map((c) => (
              <label
                key={c.id}
                className={`flex items-start gap-2.5 px-3 py-2.5 text-sm ${c.eventsUrl ? "cursor-pointer hover:bg-subtle" : "text-faint"}`}
              >
                <input
                  type="checkbox"
                  name="centers"
                  value={c.id}
                  defaultChecked={c.findShows}
                  disabled={!c.eventsUrl}
                  className="mt-0.5 accent-brand"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted">{c.eventsUrl ?? "No Local events URL. Add one on the center to check it."}</span>
                  {c.showsCheckError ? (
                    <span className="mt-0.5 block text-xs text-bad">Last check: {c.showsCheckError}</span>
                  ) : c.showsCheckedAt ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      Last check {when(c.showsCheckedAt)}: {c.showsCheckNote ?? `${c.showsFoundLast ?? 0} new`}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        )}
      </SaveForm>
    </>
  );
}
