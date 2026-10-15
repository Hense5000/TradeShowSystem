"use client";

import { useEffect, useState } from "react";
import { ImportResult, type ImportState } from "@/components/import-form";
import { type FillResult, fillSummary } from "@/lib/company-profile";
import { parseCsv } from "@/lib/csv";
import { IMPORT_ROWS_PER_CALL, parseExhibitorRows } from "@/lib/exhibitors";
import { countMissingProfiles, importExhibitorRows, writeProfileBatch } from "../actions";

const MAX_IMPORT_BYTES = 4_000_000;

/** Where the import is: saving the rows, then writing the AI profiles. Each row and each profile is one step. */
type Progress = { phase: "rows" | "profiles"; rowsDone: number; rows: number; profilesDone: number; profiles: number };

/**
 * Imports a CSV file of exhibitors in small parts, so a progress bar can show
 * how far it has come: first the rows are saved, then the AI writes the
 * company profiles the file left empty, a few at a time.
 */
export function ExhibitorImportForm({
  slug,
  writeProfiles,
  children,
}: {
  slug: string;
  /** Whether AI writes the missing company profiles during the import. */
  writeProfiles: boolean;
  /** The trade show picker. */
  children: React.ReactNode;
}) {
  const [progress, setProgress] = useState<Progress>();
  const [state, setState] = useState<ImportState>();
  const running = progress !== undefined;

  // Leaving the page stops the import; ask first.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function run(form: FormData) {
    const tradeShowId = String(form.get("tradeShowId") ?? "");
    const file = form.get("file");
    if (!tradeShowId) return setState({ error: "Choose the trade show these exhibitors are at." });
    if (!(file instanceof File) || file.size === 0) return setState({ error: "Choose a CSV file to import." });
    if (file.size > MAX_IMPORT_BYTES) return setState({ error: "The file is too large. Split it into files under 4 MB." });

    const [header, ...rows] = parseCsv(await file.text());
    // Checked here too, so a wrong file is turned away before anything is sent.
    const check = parseExhibitorRows(header ? [header] : []);
    if (check.error) return setState({ error: check.error });
    const guessedProfiles = writeProfiles ? parseExhibitorRows([header, ...rows]).items.filter((e) => e.website && !e.companyProfile).length : 0;

    const result = { imported: 0, alreadyThere: 0, problems: [] as string[] };
    let p: Progress = { phase: "rows", rowsDone: 0, rows: rows.length, profilesDone: 0, profiles: guessedProfiles };
    setState(undefined);
    setProgress(p);
    try {
      for (let start = 0; start < rows.length || start === 0; start += IMPORT_ROWS_PER_CALL) {
        const part = rows.slice(start, start + IMPORT_ROWS_PER_CALL);
        const saved = await importExhibitorRows(slug, tradeShowId, header, part, start + 2);
        if (saved.error) throw new Error(saved.error);
        result.imported += saved.imported;
        result.alreadyThere += saved.alreadyThere;
        result.problems.push(...saved.problems);
        p = { ...p, rowsDone: start + part.length };
        setProgress(p);
      }

      let note: string | undefined;
      const missing = writeProfiles && result.imported > 0 ? await countMissingProfiles(slug, tradeShowId) : 0;
      if (missing > 0) {
        p = { ...p, phase: "profiles", profiles: missing };
        setProgress(p);
        const totals: FillResult = { written: 0, noInfo: 0, failed: 0, left: missing };
        while (totals.left > 0 && !totals.stoppedBy) {
          const batch = await writeProfileBatch(slug, tradeShowId);
          const done = batch.written + batch.noInfo + batch.failed;
          totals.written += batch.written;
          totals.noInfo += batch.noInfo;
          totals.failed += batch.failed;
          totals.left = batch.left;
          totals.stoppedBy = batch.stoppedBy;
          // Someone else (the nightly run, another import) may write some at the same time.
          p = { ...p, profilesDone: p.profilesDone + done, profiles: Math.max(p.profiles, p.profilesDone + done + batch.left) };
          setProgress(p);
          if (done === 0) break;
        }
        note = fillSummary(totals);
      }
      setState({ ...result, note });
    } catch (error) {
      const why = error instanceof Error && error.message ? error.message : "The connection was lost.";
      setState({
        ...result,
        error: `The import stopped: ${why} What was saved before is kept; import the same file again to finish, as companies already listed are skipped.`,
      });
    } finally {
      setProgress(undefined);
    }
  }

  return (
    <form
      className="card flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!running) void run(new FormData(e.currentTarget));
      }}
    >
      <fieldset disabled={running} className="contents">
        {children}
        <div>
          <label className="label" htmlFor="file">CSV file</label>
          <input className="input" id="file" name="file" type="file" accept=".csv,text/csv" required />
        </div>
      </fieldset>
      {progress ? <ImportProgress progress={progress} /> : <ImportResult state={state} noun={["exhibitor", "exhibitors"]} />}
      <div className="card-foot mt-1">
        <button className="btn" disabled={running}>
          {running ? "Importing…" : "Import exhibitors"}
        </button>
      </div>
    </form>
  );
}

function ImportProgress({ progress: p }: { progress: Progress }) {
  const total = p.rows + p.profiles;
  const percent = total === 0 ? 0 : Math.min(100, Math.floor(((p.rowsDone + p.profilesDone) / total) * 100));
  const label =
    p.phase === "rows"
      ? `Saving exhibitors: ${p.rowsDone} of ${p.rows} rows`
      : `AI is writing company profiles: ${p.profilesDone} of ${p.profiles}`;
  return (
    <div className="rounded-lg bg-subtle px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-bold text-brand tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">Keep this page open until the import is done.</p>
    </div>
  );
}
