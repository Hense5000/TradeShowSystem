"use client";

import { useActionState } from "react";
import type { CleanupBillingState } from "./actions";

/** "Remove test payments", with what was removed (or why not) shown under it. */
export function RemoveTestBillingButton({
  action,
}: {
  action: (prev: CleanupBillingState, formData: FormData) => Promise<CleanupBillingState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="flex flex-col items-end gap-2"
      onSubmit={(e) => {
        if (!window.confirm("Remove the test-mode payments? Accounts that only paid in test mode must subscribe again.")) e.preventDefault();
      }}
    >
      <button className="btn-secondary" disabled={pending}>{pending ? "Removing…" : "Remove test payments"}</button>
      {state?.done && <p className="text-sm text-ok">{state.done}</p>}
      {state?.error && <p className="error max-w-md text-right break-words">{state.error}</p>}
    </form>
  );
}
