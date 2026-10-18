"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { type OrganizerFillResult, organizerSummary } from "@/lib/organizer-finder";
import { countMissingOrganizers, findOrganizerBatch } from "./actions";

/**
 * A card above the trade show list with a button that lets AI find the
 * missing organizers, a few shows at a time, with a progress bar while the
 * page stays open.
 */
export function OrganizerCard({ slug, missing }: { slug: string; missing: number }) {
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
    const totals: OrganizerFillResult = { filled: 0, notFound: 0, failed: 0, left: await countMissingOrganizers(slug) };
    let done = 0;
    let total = totals.left;
    setProgress({ done, total });
    try {
      while (totals.left > 0 && !totals.stoppedBy) {
        const batch = await findOrganizerBatch(slug);
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
      setMessage(organizerSummary(totals));
    } catch (error) {
      const why = error instanceof Error && error.message ? error.message : "The connection was lost.";
      setMessage(`${organizerSummary(totals)} It stopped: ${why} Press the button again to go on.`);
    } finally {
      setProgress(undefined);
      router.refresh();
    }
  }

  const percent = progress && progress.total > 0 ? Math.min(100, Math.floor((progress.done / progress.total) * 100)) : 0;
  return (
    <section className="card flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name="sparkle" className="size-5" />
        </span>
        <div className="min-w-56 flex-1 text-sm">
          <p className="font-semibold">
            {missing} trade {missing === 1 ? "show has" : "shows have"} no organizer
          </p>
          <p className="text-muted">
            {message ??
              "AI searches the web for the company that organizes each show and links it. Organizers that are not in the list yet are added to it. Shows that already have an organizer are not changed."}
          </p>
        </div>
        {missing > 0 && (
          <button type="button" className="btn" onClick={() => void run()} disabled={running}>
            {running ? "Finding organizers…" : "Find missing organizers"}
          </button>
        )}
      </div>
      {progress && <ProgressBar label={`AI is finding organizers: ${progress.done} of ${progress.total} trade shows`} percent={percent} ariaLabel="Progress" />}
    </section>
  );
}
