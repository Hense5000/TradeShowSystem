"use client";

import { useActionState } from "react";

export type ImportState = { error?: string; imported?: number; alreadyThere?: number; problems?: string[]; note?: string } | undefined;

/** Upload a CSV file to one of the shared lists and show what happened. `noun` is singular and plural, e.g. ["center", "centers"]. */
export function ImportForm({
  action,
  noun: [one, many],
  pendingLabel,
  children,
}: {
  action: (prev: ImportState, formData: FormData) => Promise<ImportState>;
  noun: [string, string];
  /** Button text while importing, e.g. when the import takes a while. */
  pendingLabel?: string;
  /** Extra inputs shown above the file picker. */
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const problems = state?.problems ?? [];

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      {children}
      <div>
        <label className="label" htmlFor="file">CSV file</label>
        <input className="input" id="file" name="file" type="file" accept=".csv,text/csv" required disabled={pending} />
      </div>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.imported !== undefined && (
        <p role="status" className="success">
          Imported {state.imported} {state.imported === 1 ? one : many}.
          {state.alreadyThere ? ` ${state.alreadyThere} were already in the list and were left as they are.` : ""}
        </p>
      )}
      {state?.note && <p role="status" className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{state.note}</p>}
      {problems.length > 0 && (
        <div className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          <p className="font-semibold">
            {problems.length} {problems.length === 1 ? "row needs" : "rows need"} a look:
          </p>
          <ul className="mt-1 max-h-60 list-disc overflow-y-auto pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="card-foot mt-1">
        <button className="btn" disabled={pending}>
          {pending ? (pendingLabel ?? "Importing…") : `Import ${many}`}
        </button>
      </div>
    </form>
  );
}
