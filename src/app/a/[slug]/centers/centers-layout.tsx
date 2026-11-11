"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { type EventsPageFillResult, eventsPageSummary } from "@/lib/events-page";
import { AdsTableLayout } from "../ads-table-layout";
import { countMissingEventsPages, findEventsPageBatch } from "./actions";

/**
 * The Exhibition centers page under its title: the ads, then the table. For a
 * platform admin the buttons Add center, Import and Find missing events pages
 * stand in a column right of the table (above it on a narrow screen); the
 * progress of the AI lookup shows above the table.
 */
export function CentersLayout({
  slug,
  ads,
  admin,
  children,
}: {
  slug: string;
  ads: React.ReactNode;
  /** Only for a platform admin. `missingEvents` is null when the AI lookup is not set up. */
  admin: { missingEvents: number | null } | null;
  children: React.ReactNode;
}) {
  if (!admin) return <AdsTableLayout ads={ads}>{children}</AdsTableLayout>;
  return (
    <AdminLayout slug={slug} ads={ads} missingEvents={admin.missingEvents}>
      {children}
    </AdminLayout>
  );
}

function AdminLayout({ slug, ads, missingEvents, children }: { slug: string; ads: React.ReactNode; missingEvents: number | null; children: React.ReactNode }) {
  const finder = useFindEventsPages(slug, missingEvents ?? 0);
  return (
    <AdsTableLayout
      ads={ads}
      notices={finder.panel}
      /* Wider than on the Trade shows page so "Find missing events pages" fits. */
      buttonsWidth="xl:w-60"
      buttons={
        /* Only the platform admin edits the shared list: blue buttons. */
        <>
          <Link href={`/a/${slug}/centers/new`} className="btn px-3 py-1.5">
            <Icon name="plus" className="size-4" /> Add center
          </Link>
          <Link href={`/a/${slug}/centers/import`} className="btn px-3 py-1.5">
            <Icon name="upload" className="size-4" /> Import
          </Link>
          {missingEvents !== null && (missingEvents > 0 || finder.running) && finder.button}
        </>
      }
    >
      {children}
    </AdsTableLayout>
  );
}

/**
 * "Find missing events pages": AI finds the missing Local events URLs, a few
 * centers at a time, while the page stays open. Gives the button (with how
 * many centers lack one) and the progress card, which the page places apart.
 */
function useFindEventsPages(slug: string, missing: number) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [message, setMessage] = useState<string>();
  const running = progress !== undefined;

  // Leaving the page stops the lookup; ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function run() {
    setMessage(undefined);
    const totals: EventsPageFillResult = { filled: 0, notFound: 0, failed: 0, left: await countMissingEventsPages(slug) };
    let done = 0;
    let total = totals.left;
    setProgress({ done, total });
    try {
      while (totals.left > 0 && !totals.stoppedBy) {
        const batch = await findEventsPageBatch(slug);
        const batchDone = batch.filled + batch.notFound + batch.failed;
        totals.filled += batch.filled;
        totals.notFound += batch.notFound;
        totals.failed += batch.failed;
        totals.left = batch.left;
        totals.stoppedBy = batch.stoppedBy;
        done += batchDone;
        total = Math.max(total, done + batch.left);
        setProgress({ done, total });
        if (batchDone === 0) break;
      }
      setMessage(eventsPageSummary(totals));
    } catch (error) {
      const why = error instanceof Error && error.message ? error.message : "The connection was lost.";
      setMessage(`${eventsPageSummary(totals)} It stopped: ${why} Press the button again to go on.`);
    } finally {
      setProgress(undefined);
      router.refresh();
    }
  }

  const button = (
    <button
      type="button"
      className="btn px-3 py-1.5"
      onClick={() => void run()}
      disabled={running}
      title={`${missing} ${missing === 1 ? "center has" : "centers have"} no Local events URL. AI looks on each center's website for the page that lists its upcoming events and fills in the Local events URL. Centers that already have one are not changed.`}
    >
      {running ? (
        "Finding events pages…"
      ) : (
        <>
          Find missing events pages
          <span className="rounded-full bg-white/25 px-1.5 text-xs leading-5 tabular-nums">{missing}</span>
        </>
      )}
    </button>
  );

  const percent = progress && progress.total > 0 ? Math.min(100, Math.floor((progress.done / progress.total) * 100)) : 0;
  const panel = (progress || message) && (
    <section className="card flex flex-col gap-3 py-4" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name="sparkle" className="size-5" />
        </span>
        <div className="min-w-56 flex-1 text-sm">
          <p className="font-semibold">{running ? "Finding missing events pages" : "Events pages found"}</p>
          <p className="text-muted">
            {message ?? "AI looks on each center's website for the page that lists its upcoming events and fills in the Local events URL."}
          </p>
        </div>
      </div>
      {progress && <ProgressBar label={`AI is finding events pages: ${progress.done} of ${progress.total} centers`} percent={percent} ariaLabel="Progress" />}
    </section>
  );

  return { button, panel, running };
}
