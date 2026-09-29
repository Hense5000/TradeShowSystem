"use client";

import { startTransition, useActionState, useEffect, useState } from "react";

export type SaveState = { error?: string; saved?: boolean } | undefined;

/**
 * A card with a form that saves through a server action. Shows the error the
 * action returns, or a short "Saved" message. Read-only when `readOnly`.
 */
export function SaveForm({
  action,
  title,
  description,
  badge,
  submitLabel,
  readOnly,
  children,
}: {
  action: (prev: SaveState, formData: FormData) => Promise<SaveState>;
  title: string;
  description: string;
  badge?: React.ReactNode;
  submitLabel: string;
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!state?.saved) return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <form
      className="card flex flex-col gap-4"
      // Submit by hand instead of through `action`, so React does not clear
      // what the user typed when the server returns a validation error.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
        {badge}
      </div>
      <fieldset disabled={readOnly || pending} className="flex flex-col gap-4">
        {children}
      </fieldset>
      {state?.error && <p className="error">{state.error}</p>}
      {!readOnly && (
        <div className="card-foot mt-1 items-center">
          {showSaved && (
            <span role="status" className="mr-auto text-sm font-semibold text-ok">
              Saved
            </span>
          )}
          <button type="reset" className="btn-secondary" disabled={pending}>
            Undo changes
          </button>
          <button className="btn" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
