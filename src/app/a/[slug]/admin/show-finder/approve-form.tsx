"use client";

import { startTransition, useActionState } from "react";
import type { ActionState } from "@/components/action-form";

/** The approve form for one suggestion. Keeps the admin's corrections when the server finds an error. */
export function ApproveForm({
  action,
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      className="flex flex-1 flex-wrap items-end gap-2"
      // Submit by hand instead of through `action`, so React does not reset
      // the fields when the server returns an error.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && <p className="error basis-full">{state.error}</p>}
    </form>
  );
}
