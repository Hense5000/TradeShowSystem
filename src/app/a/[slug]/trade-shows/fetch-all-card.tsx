"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { ProgressBar } from "@/components/progress-bar";
import { bulkFetchSummary, type BulkFetchTotals, MAX_PAGES } from "@/lib/exhibitor-fetch";
import { findShowDirectoryUrl, listShowsWithoutExhibitors, markExhibitorsTried } from "./actions";
import { readDirectory } from "./read-directory";

type Progress = {
  done: number;
  total: number;
  show: string;
  step: { kind: "url" } | { kind: "pages"; read: number; known: number; added: number };
  added: number;
};

/** What happened to one show, listed under the bar so it is clear why a show got no exhibitors. */
type LogLine = { show: string; text: string; ok: boolean };

/**
 * A card above the trade show list that fetches exhibitors for every show
 * that has none yet, one show at a time while the page stays open. A show
 * without an Exhibitor directory URL gets one found by AI on the web first.
 * Each show is tried once, so a show without a public list is not searched
 * again on the next run; a show whose lookup failed is tried again. Under
 * the bar it lists what happened to each show. Company profiles and contact persons are left to the
 * nightly run.
 */
export function FetchAllCard({ slug, missing }: { slug: string; missing: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>();
  const [message, setMessage] = useState<string>();
  const [log, setLog] = useState<LogLine[]>([]);
  const running = progress !== undefined;

  // Leaving the page stops the fetch; ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function run() {
    setMessage(undefined);
    setLog([]);
    const totals: BulkFetchTotals = { filled: 0, added: 0, noDirectory: 0, empty: 0, failed: 0, urlsFound: 0, left: 0 };
    const note = (show: string, text: string, ok = false) => setLog((l) => [...l, { show, text, ok }]);
    let done = 0;
    let total = 0;
    let lostInARow = 0;
    try {
      const shows = await listShowsWithoutExhibitors(slug);
      total = shows.length;
      for (const show of shows) {
        const base = { done, total, show: show.name, added: totals.added };
        let tried = true;
        try {
          let directoryUrl = show.directoryUrl;
          if (!directoryUrl) {
            setProgress({ ...base, step: { kind: "url" } });
            const found = await findShowDirectoryUrl(slug, show.id);
            if (found.stop) {
              totals.stoppedBy = found.error;
              break;
            }
            if (found.directoryUrl) {
              directoryUrl = found.directoryUrl;
              totals.urlsFound++;
            } else if (found.error) {
              // The lookup itself failed; try the show again next time.
              tried = false;
              totals.failed++;
              note(show.name, `Could not look for the exhibitor list: ${found.error}`);
            } else {
              totals.noDirectory++;
              note(show.name, "AI found no exhibitor list on the web.");
            }
          }
          if (directoryUrl) {
            const r = await readDirectory(slug, show.id, directoryUrl, (read, known, added) =>
              setProgress({ ...base, added: totals.added + added, step: { kind: "pages", read, known, added } }),
            );
            totals.added += r.totals.added;
            if (r.totals.added > 0) {
              totals.filled++;
              note(show.name, `${r.totals.added} ${r.totals.added === 1 ? "exhibitor" : "exhibitors"} added.`, true);
            }
            if (r.stopped) {
              // Nothing is wrong with the show itself; leave it for the next run.
              totals.stoppedBy = r.firstError;
              break;
            }
            if (r.totals.added === 0 && r.totals.pages === 0) {
              tried = false;
              totals.failed++;
              note(show.name, `The exhibitor list could not be read: ${r.firstError ?? "no answer"}`);
            } else if (r.totals.added === 0) {
              totals.empty++;
              note(show.name, "The exhibitor list was read, but no exhibitors were on it.");
            }
          }
          lostInARow = 0;
        } catch {
          // The page lost its connection to the server, or the server timed out on this show; go on with the next.
          tried = false;
          totals.failed++;
          note(show.name, "The server took too long or the connection was lost.");
          if (++lostInARow >= 3) {
            totals.stoppedBy = "The connection was lost three times in a row.";
            break;
          }
        }
        if (tried) await markExhibitorsTried(slug, show.id).catch(() => undefined);
        done++;
      }
      totals.left = total - done;
      setMessage(bulkFetchSummary(totals));
    } catch {
      totals.left = total - done;
      setMessage(`${bulkFetchSummary(totals)} It stopped because the connection was lost; press the button again to carry on.`);
    } finally {
      setProgress(undefined);
      router.refresh();
    }
  }

  return (
    <section className="card flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name="sparkle" className="size-5" />
        </span>
        <div className="min-w-56 flex-1 text-sm">
          <p className="font-semibold">
            {missing} upcoming {missing === 1 ? "trade show has" : "trade shows have"} no exhibitors yet
          </p>
          <p className="text-muted">
            {message ??
              "AI reads each show's exhibitor list and adds the exhibitors to the Exhibitors section. A show without an Exhibitor directory URL gets one found on the web first. Company profiles and contact persons are written by the nightly run."}
          </p>
        </div>
        {missing > 0 && (
          <button type="button" className="btn" onClick={() => void run()} disabled={running}>
            {running ? "Fetching exhibitors…" : "Fetch exhibitors for all"}
          </button>
        )}
      </div>
      {progress && <AllProgress progress={progress} />}
      {log.length > 0 && (
        <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm" aria-label="Results per trade show">
          {log.map((l, i) => (
            <li key={i} className="flex flex-wrap gap-x-2 px-3 py-1.5">
              <span className="font-semibold">{l.show}</span>
              <span className={l.ok ? "text-brand" : "text-muted"}>{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AllProgress({ progress: p }: { progress: Progress }) {
  // Each show is an equal part of the bar; the pages read move it within the show's part.
  let within = 0;
  let step = "finding the exhibitor list";
  if (p.step.kind === "pages") {
    const pages = Math.min(p.step.known, MAX_PAGES);
    within = Math.min(0.99, p.step.read / pages);
    step = `reading page ${Math.min(p.step.read + 1, pages)} of ${pages}`;
  }
  const percent = p.total === 0 ? 0 : Math.min(99, Math.floor(((p.done + within) / p.total) * 100));
  const label = `Show ${Math.min(p.done + 1, p.total)} of ${p.total}: ${p.show}, ${step} · ${p.added} added`;
  return <ProgressBar label={label} percent={percent} ariaLabel="Progress" />;
}
