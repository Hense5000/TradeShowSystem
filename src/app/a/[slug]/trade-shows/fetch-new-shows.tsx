"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { runSummary } from "@/lib/show-finder";
import { fetchNewShowsRound } from "./actions";

type Totals = { checked: number; found: number; failed: number; left: number };

/**
 * The Trade shows page header for a platform admin, with a "Fetch all new
 * trade shows" button next to Import and Add trade show. It runs the AI trade
 * show finder on every chosen exhibition center right away, the same check
 * the weekly update makes. The server checks as many centers as it can per
 * call; the page keeps calling until all are done and shows the progress
 * under the header.
 */
export function FetchNewShowsHeader({
  slug,
  title,
  description,
  centers,
  children,
}: {
  slug: string;
  title: string;
  description: string;
  /** Chosen centers with an events page: what the finder will check. */
  centers: number;
  /** The other header buttons (Import, Add trade show). */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<Totals>();
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const running = progress !== undefined;

  // Leaving the page stops the run; ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function run() {
    setMessage(undefined);
    const totals: Totals = { checked: 0, found: 0, failed: 0, left: centers };
    setProgress({ ...totals });
    let startedAt: string | undefined;
    try {
      for (;;) {
        const r = await fetchNewShowsRound(slug, startedAt);
        if (r.error !== undefined) {
          setMessage({ text: `${runSummary(totals)} ${r.error}`, ok: false });
          return;
        }
        startedAt = r.startedAt;
        totals.checked += r.totals.checked;
        totals.found += r.totals.found;
        totals.failed += r.totals.failed;
        totals.left = r.totals.left;
        setProgress({ ...totals });
        router.refresh();
        // Done, or a round got nothing done (then stop rather than loop).
        if (r.totals.left === 0 || r.totals.checked === 0) break;
      }
      setMessage({ text: totals.checked === 0 && totals.found === 0 ? "All chosen centers were already checked just now." : runSummary(totals), ok: true });
    } catch {
      setMessage({ text: `${runSummary(totals)} It stopped because the connection was lost; press the button again to carry on with the rest.`, ok: false });
    } finally {
      setProgress(undefined);
      router.refresh();
    }
  }

  const total = progress ? Math.max(centers, progress.checked + progress.left) : centers;
  const percent = progress && total > 0 ? Math.min(99, Math.floor((progress.checked / total) * 100)) : 0;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary py-2"
              onClick={() => void run()}
              disabled={running || centers === 0}
              title={centers === 0 ? "Choose exhibition centers in the AI trade show finder first." : `Check the events pages of all ${centers} chosen exhibition centers now`}
            >
              <Icon name="sparkle" className="size-4" /> {running ? "Fetching new trade shows…" : "Fetch all new trade shows"}
            </button>
            {children}
          </div>
        }
      />
      {(progress || message) && (
        <section className="card flex flex-col gap-3 py-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <Icon name="sparkle" className="size-5" />
            </span>
            <div className="min-w-56 flex-1 text-sm">
              <p className="font-semibold">{running ? "Fetching new trade shows" : "New trade shows fetched"}</p>
              <p className={message && !message.ok ? "text-bad" : "text-muted"}>
                {message?.text ??
                  "AI reads the events page of each chosen exhibition center and adds the trade shows in the next 6 months that are not in the list yet. With many centers this takes a while."}
              </p>
            </div>
          </div>
          {progress && (
            <ProgressBar
              label={`Checked ${progress.checked} of ${total} centers · ${progress.found} new ${progress.found === 1 ? "trade show" : "trade shows"} added`}
              percent={percent}
              ariaLabel="Progress"
            />
          )}
        </section>
      )}
    </>
  );
}
