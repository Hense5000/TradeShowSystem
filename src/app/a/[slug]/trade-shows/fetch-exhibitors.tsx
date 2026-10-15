"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProgressBar } from "@/components/progress-bar";
import { fetchSummary, MAX_PAGES, morePages } from "@/lib/exhibitor-fetch";
import { writeMissingProfiles } from "../exhibitors/write-profiles";
import { fetchExhibitorPage } from "./actions";

type Progress = { phase: "pages"; read: number; known: number; added: number } | { phase: "profiles"; done: number; total: number };

type Result = { summary?: string; note?: string; error?: string };

/**
 * "Fetch exhibitors": AI reads the show's exhibitor directory page by page
 * (following its page 2, 3 ... or A-Z links) and adds the exhibitors it finds
 * to the show; then it writes their company profiles from their websites.
 */
export function FetchExhibitors({
  slug,
  tradeShowId,
  directoryUrl,
  exhibitorCount,
  writeProfiles,
}: {
  slug: string;
  tradeShowId: string;
  directoryUrl: string;
  exhibitorCount: number;
  writeProfiles: boolean;
}) {
  const [progress, setProgress] = useState<Progress>();
  const [result, setResult] = useState<Result>();
  const running = progress !== undefined;

  // Leaving the page stops the fetch; ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function run() {
    const queue = [directoryUrl];
    const known = new Set(queue);
    const totals = { pages: 0, found: 0, added: 0, failedPages: 0, morePagesLeft: 0 };
    let firstError: string | undefined;
    setResult(undefined);
    setProgress({ phase: "pages", read: 0, known: 1, added: 0 });
    try {
      while (queue.length > 0 && totals.pages + totals.failedPages < MAX_PAGES) {
        const page = queue.shift()!;
        const r = await fetchExhibitorPage(slug, tradeShowId, page);
        if (r.error) {
          totals.failedPages++;
          firstError ??= r.error;
          if (r.stop) break;
        } else {
          totals.pages++;
          totals.found += r.found;
          totals.added += r.added;
          for (const next of morePages(r.otherPages, directoryUrl, known)) {
            known.add(next);
            queue.push(next);
          }
        }
        setProgress({ phase: "pages", read: totals.pages + totals.failedPages, known: known.size, added: totals.added });
      }
      totals.morePagesLeft = queue.length;

      if (totals.pages === 0) {
        setResult({ error: firstError ?? "The exhibitor list could not be read." });
        return;
      }
      let note: string | undefined;
      if (writeProfiles && totals.added > 0) {
        note = await writeMissingProfiles(slug, tradeShowId, (done, total) => setProgress({ phase: "profiles", done, total }));
      }
      setResult({ summary: fetchSummary(totals), note, error: firstError && `First problem: ${firstError}` });
    } catch {
      setResult({
        error: "The fetch stopped because the connection was lost. The exhibitors added so far are kept; press the button again to carry on, as companies already listed are skipped.",
      });
    } finally {
      setProgress(undefined);
    }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">Fetch exhibitors from the exhibitor directory</h2>
          <p className="mt-0.5 text-sm text-muted">
            AI reads{" "}
            <a href={directoryUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
              {directoryUrl.replace(/^https?:\/\/(www\.)?/, "")}
            </a>{" "}
            and its further pages, and adds the exhibitors it finds to this trade show. Companies already listed are skipped.
            {writeProfiles && " Then AI writes a company profile for each new exhibitor that has a website."}
          </p>
          <p className="mt-1 text-sm text-muted">
            This trade show has {exhibitorCount} {exhibitorCount === 1 ? "exhibitor" : "exhibitors"} now.{" "}
            <Link href={`/a/${slug}/exhibitors?show=${tradeShowId}`} className="font-medium text-brand hover:underline">
              See exhibitors
            </Link>
          </p>
        </div>
        <button type="button" className="btn shrink-0" disabled={running} onClick={() => void run()}>
          {running ? "Fetching…" : "Fetch exhibitors"}
        </button>
      </div>
      {progress && <FetchProgress progress={progress} />}
      {!progress && result?.summary && <p role="status" className="success">{result.summary}</p>}
      {!progress && result?.note && <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{result.note}</p>}
      {!progress && result?.error && <p className="error">{result.error}</p>}
    </section>
  );
}

function FetchProgress({ progress: p }: { progress: Progress }) {
  if (p.phase === "profiles") {
    const percent = p.total === 0 ? 0 : Math.min(100, Math.floor((p.done / p.total) * 100));
    return <ProgressBar label={`AI is writing company profiles: ${p.done} of ${p.total}`} percent={percent} ariaLabel="Fetch progress" />;
  }
  // More pages can turn up while reading, so the bar is based on the pages known so far.
  const total = Math.min(p.known, MAX_PAGES);
  const percent = Math.min(99, Math.floor((p.read / total) * 100));
  const label = `Reading the exhibitor list: page ${Math.min(p.read + 1, total)} of ${total} · ${p.added} added`;
  return <ProgressBar label={label} percent={percent} ariaLabel="Fetch progress" />;
}
