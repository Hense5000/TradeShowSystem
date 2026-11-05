import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { today } from "@/lib/dates";
import { findDirectoryUrl } from "@/lib/directory-url-run";
import {
  addExhibitorsFromPage,
  describeFetchError,
  isExhibitorFetchConfigured,
  isServiceDown,
  withoutExhibitorsWhere,
} from "@/lib/exhibitor-fetch-run";
import {
  hasPagesLeft,
  type ListProgress,
  listProgress,
  nightlySummary,
  type NightlyTotals,
  pageFailed,
  pageRead,
  takePage,
} from "@/lib/nightly-update";
import { isDue } from "@/lib/show-finder";
import { runShowFinder } from "@/lib/show-finder-run";

// One round of the nightly update. First the AI trade show finder checks the
// chosen exhibition centers that are due (each once a month), then exhibitors
// are fetched for upcoming trade shows that have none yet, soonest first, the
// same way as the "Fetch exhibitors for all" button. A long exhibitor list
// that is not finished when the round's time is up is carried on in the next
// round, from where it stopped.

/** The finder stops starting new centers after this long, so the exhibitors get most of the round. */
const FINDER_BUDGET_MS = 60_000;
/** A new page is only started when this much of the round is left; one page can take two minutes. */
const PAGE_NEEDS_MS = 130_000;
/** A missing exhibitor list is only looked for when this much is left. */
const URL_NEEDS_MS = 100_000;
/** Shows worked on side by side. */
const PARALLEL = 3;

type Show = {
  id: string;
  name: string;
  startDate: Date;
  city: string | null;
  country: string | null;
  website: string | null;
  exhibitorDirectoryUrl: string | null;
  exhibitorFetchState: Prisma.JsonValue;
};

class ServiceDown extends Error {}

export async function runNightlyUpdate(roundMs: number): Promise<string> {
  const started = Date.now();
  const timeLeft = () => roundMs - (Date.now() - started);
  const totals: NightlyTotals = { finder: null, filled: 0, added: 0, urlsFound: 0, noDirectory: 0, empty: 0, failed: 0, left: 0 };

  // 1. New trade shows from the chosen exhibition centers.
  const finder = await db.showFinderSettings.findUnique({ where: { id: 1 } });
  if (finder?.enabled) {
    const due = (await db.exhibitionCenter.findMany({ where: { findShows: true, eventsUrl: { not: null } }, select: { showsCheckedAt: true } })).some((c) =>
      isDue(c.showsCheckedAt),
    );
    if (due) totals.finder = await runShowFinder({ onlyDue: true, timeBudgetMs: FINDER_BUDGET_MS });
  }

  // 2. Exhibitors for upcoming shows that have none yet, and lists left half read last round.
  if (!isExhibitorFetchConfigured()) {
    totals.stoppedBy = "ANTHROPIC_API_KEY is not set.";
  } else {
    const select = {
      id: true,
      name: true,
      startDate: true,
      city: true,
      country: true,
      website: true,
      exhibitorDirectoryUrl: true,
      exhibitorFetchState: true,
    } as const;
    const order = [{ startDate: "asc" as const }, { name: "asc" as const }];
    // Lists already started first, so they get finished; then shows without exhibitors, soonest first.
    const [started, waiting] = await Promise.all([
      db.tradeShow.findMany({ where: { endDate: { gte: today() }, exhibitorFetchState: { not: Prisma.AnyNull } }, orderBy: order, select }),
      db.tradeShow.findMany({ where: { ...withoutExhibitorsWhere(), exhibitorFetchState: { equals: Prisma.AnyNull } }, orderBy: order, select }),
    ]);
    const queue: Show[] = [...started, ...waiting];
    let next = 0;
    let stop = false;

    async function worker() {
      while (!stop && next < queue.length && timeLeft() > PAGE_NEEDS_MS) {
        try {
          await fetchForShow(queue[next++]);
        } catch (error) {
          if (error instanceof ServiceDown) {
            stop = true;
            totals.stoppedBy = error.message;
          } else throw error;
        }
      }
    }

    async function fetchForShow(show: Show): Promise<void> {
      let directoryUrl = show.exhibitorDirectoryUrl;
      if (!directoryUrl) {
        if (timeLeft() < URL_NEEDS_MS) {
          totals.left++;
          return;
        }
        try {
          const found = await findDirectoryUrl(show, undefined, timeLeft() - 30_000);
          if (!found) {
            totals.noDirectory++;
            await db.tradeShow.update({ where: { id: show.id }, data: { exhibitorsTriedAt: new Date() } });
            return;
          }
          await db.tradeShow.updateMany({ where: { id: show.id, exhibitorDirectoryUrl: null }, data: { exhibitorDirectoryUrl: found } });
          directoryUrl = (await db.tradeShow.findUnique({ where: { id: show.id }, select: { exhibitorDirectoryUrl: true } }))?.exhibitorDirectoryUrl ?? found;
          totals.urlsFound++;
        } catch (error) {
          if (isServiceDown(error)) throw new ServiceDown(describeFetchError(error));
          // The lookup itself failed; the show is tried again next night.
          totals.failed++;
          return;
        }
      }

      const target = { id: show.id, name: show.name, exhibitorDirectoryUrl: directoryUrl };
      let progress: ListProgress = listProgress(show.exhibitorFetchState, directoryUrl);
      const save = (p: ListProgress | null) =>
        db.tradeShow.update({ where: { id: show.id }, data: { exhibitorFetchState: p ? (p as Prisma.InputJsonValue) : Prisma.DbNull } });

      let addedNow = 0;
      while (hasPagesLeft(progress)) {
        if (timeLeft() < PAGE_NEEDS_MS) {
          // Out of time for this round; carry on from here next round.
          await save(progress);
          if (addedNow > 0) totals.filled++;
          totals.left++;
          return;
        }
        const [page, rest] = takePage(progress);
        try {
          const r = await addExhibitorsFromPage(target, page);
          progress = pageRead(rest, directoryUrl, r);
          addedNow += r.added;
          totals.added += r.added;
        } catch (error) {
          if (isServiceDown(error)) {
            // Keep the page waiting, so nothing is missed when the credit is back.
            await save(progress);
            throw new ServiceDown(describeFetchError(error));
          }
          progress = pageFailed(rest, describeFetchError(error));
        }
        await save(progress);
      }

      // The whole list is read.
      await save(null);
      if (addedNow > 0) totals.filled++;
      if (progress.pages === 0) {
        // No page could be read; leave the show to be tried again next night.
        totals.failed++;
        return;
      }
      if (progress.added === 0) totals.empty++;
      await db.tradeShow.update({ where: { id: show.id }, data: { exhibitorsTriedAt: new Date() } });
    }

    await Promise.all(Array.from({ length: PARALLEL }, worker));
    totals.left += queue.length - Math.min(next, queue.length);
  }

  const summary = nightlySummary(totals);
  await db.nightlyUpdateSettings.upsert({
    where: { id: 1 },
    create: { id: 1, lastRunAt: new Date(), lastRunSummary: summary },
    update: { lastRunAt: new Date(), lastRunSummary: summary },
  });
  return summary;
}
