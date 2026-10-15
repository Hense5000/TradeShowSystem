"use client";

import { useEffect, useState } from "react";
import { ImportResult, type ImportState } from "@/components/import-form";
import { ProgressBar } from "@/components/progress-bar";
import { parseCsv } from "@/lib/csv";
import { IMPORT_ROWS_PER_CALL, parseExhibitorRows } from "@/lib/exhibitors";
import { importExhibitorRows } from "../actions";
import { findMissingContacts, writeMissingProfiles } from "../write-profiles";

const MAX_IMPORT_BYTES = 4_000_000;

/** Where the import is: saving the rows, writing the AI profiles, then looking up contacts. Each row, profile and contact is one step. */
type Progress = {
  phase: "rows" | "profiles" | "contacts";
  rowsDone: number;
  rows: number;
  profilesDone: number;
  profiles: number;
  contactsDone: number;
  contacts: number;
};

/**
 * Imports a CSV file of exhibitors in small parts, so a progress bar can show
 * how far it has come: first the rows are saved, then the AI writes the
 * company profiles the file left empty, and then it looks up a contact person
 * on each website where the file gave no name or email, a few at a time.
 */
export function ExhibitorImportForm({
  slug,
  writeProfiles,
  children,
}: {
  slug: string;
  /** Whether AI writes the missing company profiles and looks up contacts during the import. */
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
    const items = writeProfiles ? parseExhibitorRows([header, ...rows]).items.filter((e) => e.website) : [];
    const guessedProfiles = items.filter((e) => !e.companyProfile).length;
    const guessedContacts = items.filter((e) => !e.contactName || !e.email).length;

    const result = { imported: 0, alreadyThere: 0, problems: [] as string[] };
    let p: Progress = { phase: "rows", rowsDone: 0, rows: rows.length, profilesDone: 0, profiles: guessedProfiles, contactsDone: 0, contacts: guessedContacts };
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

      const notes: (string | undefined)[] = [];
      if (writeProfiles && result.imported > 0) {
        notes.push(
          await writeMissingProfiles(slug, tradeShowId, (done, total) => {
            p = { ...p, phase: "profiles", profilesDone: done, profiles: total };
            setProgress(p);
          }),
        );
        p = { ...p, profilesDone: p.profiles };
        notes.push(
          await findMissingContacts(slug, tradeShowId, (done, total) => {
            p = { ...p, phase: "contacts", contactsDone: done, contacts: total };
            setProgress(p);
          }),
        );
      }
      setState({ ...result, note: notes.filter(Boolean).join(" ") || undefined });
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
  const total = p.rows + p.profiles + p.contacts;
  const percent = total === 0 ? 0 : Math.min(100, Math.floor(((p.rowsDone + p.profilesDone + p.contactsDone) / total) * 100));
  const label =
    p.phase === "rows"
      ? `Saving exhibitors: ${p.rowsDone} of ${p.rows} rows`
      : p.phase === "profiles"
        ? `AI is writing company profiles: ${p.profilesDone} of ${p.profiles}`
        : `AI is finding contact persons: ${p.contactsDone} of ${p.contacts}`;
  return <ProgressBar label={label} percent={percent} ariaLabel="Import progress" />;
}
