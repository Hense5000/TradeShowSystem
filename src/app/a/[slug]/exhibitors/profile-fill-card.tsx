"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { MAX_PROFILE_CHARS, type ProfileRunResult, profileRunSummary } from "@/lib/company-profile";
import { listEmptyProfiles, writeProfilesFor } from "./actions";

/** How many exhibitors one call writes, side by side; a few at a time keeps the bar moving. */
const PER_CALL = 5;

/**
 * A card above the exhibitor list that finds every exhibitor with an empty
 * company profile and lets AI write it, a few at a time while the page stays
 * open. Exhibitors the AI tried before are tried again, and those without a
 * website are looked up on the web.
 */
export function ProfileFillCard({ slug, tradeShowId, missing }: { slug: string; tradeShowId?: string; missing: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number; written: number }>();
  const [message, setMessage] = useState<string>();
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
    const totals: ProfileRunResult = { written: 0, noInfo: 0, failed: 0, websitesFound: 0 };
    let ids: string[] = [];
    let done = 0;
    let lostInARow = 0;
    try {
      ids = await listEmptyProfiles(slug, tradeShowId);
      setProgress({ done, total: ids.length, written: 0 });
      while (done < ids.length) {
        const batch = ids.slice(done, done + PER_CALL);
        try {
          const r = await writeProfilesFor(slug, batch);
          totals.written += r.written;
          totals.noInfo += r.noInfo;
          totals.failed += r.failed;
          totals.websitesFound += r.websitesFound;
          lostInARow = 0;
          if (r.stoppedBy) {
            totals.stoppedBy = r.stoppedBy;
            break;
          }
        } catch {
          // The server timed out or the connection dropped on this batch; go on with the next.
          totals.failed += batch.length;
          if (++lostInARow >= 3) {
            totals.stoppedBy = "The connection was lost three times in a row.";
            done += batch.length;
            break;
          }
        }
        done += batch.length;
        setProgress({ done, total: ids.length, written: totals.written });
      }
      setMessage(profileRunSummary(totals, ids.length - totals.written - totals.noInfo));
    } catch {
      setMessage(`${profileRunSummary(totals, ids.length - totals.written - totals.noInfo)} It stopped because the connection was lost.`);
    } finally {
      setProgress(undefined);
      router.refresh();
    }
  }

  const percent = progress && progress.total > 0 ? Math.min(99, Math.floor((progress.done / progress.total) * 100)) : 0;
  return (
    <section className="card flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name="sparkle" className="size-5" />
        </span>
        <div className="min-w-56 flex-1 text-sm">
          <p className="font-semibold">
            {missing} {missing === 1 ? "exhibitor has" : "exhibitors have"} no company profile
          </p>
          <p className="text-muted">
            {message ??
              `AI writes a short description in English, up to ${MAX_PROFILE_CHARS} characters, from each company's website. Companies without a website are looked up on the web, and get their website filled in too.`}
          </p>
        </div>
        {missing > 0 && (
          <button type="button" className="btn" onClick={() => void run()} disabled={running}>
            {running ? "Writing profiles…" : "Fill missing profiles"}
          </button>
        )}
      </div>
      {progress && (
        <ProgressBar
          label={`${progress.done} of ${progress.total} looked up · ${progress.written} profiles written`}
          percent={percent}
          ariaLabel="Progress"
        />
      )}
    </section>
  );
}
