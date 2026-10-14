"use client";

import { useActionState } from "react";
import type { RunState } from "./actions";

/** "Check now", with a note while it runs, since reading the pages takes a while. */
export function RunButton({ action, label = "Check all chosen now", secondary = false }: { action: () => Promise<RunState>; label?: string; secondary?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button className={secondary ? "btn-secondary" : "btn"} disabled={pending}>
          {pending ? "Checking…" : label}
        </button>
        {pending && <span className="text-sm text-muted">Reading the events pages. This can take a few minutes.</span>}
      </div>
      {state?.summary && !pending && <p className="success">{state.summary}</p>}
      {state?.error && !pending && <p className="error">{state.error}</p>}
    </form>
  );
}
