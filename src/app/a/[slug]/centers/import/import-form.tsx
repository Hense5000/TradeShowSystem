"use client";

import { useActionState } from "react";
import type { ImportState } from "../actions";

export function ImportForm({ action }: { action: (prev: ImportState, formData: FormData) => Promise<ImportState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const problems = state?.problems ?? [];

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="file">CSV file</label>
        <input className="input" id="file" name="file" type="file" accept=".csv,text/csv" required disabled={pending} />
      </div>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.imported !== undefined && (
        <p role="status" className="success">
          Imported {state.imported} {state.imported === 1 ? "center" : "centers"}.
          {state.alreadyThere ? ` ${state.alreadyThere} were already in the list and were left as they are.` : ""}
        </p>
      )}
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
          {pending ? "Importing…" : "Import centers"}
        </button>
      </div>
    </form>
  );
}
