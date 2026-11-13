"use client";

import { useActionState } from "react";
import type { DeleteOldShowsState } from "./actions";

/** "Delete now" for trade shows older than three years, asks first and shows the result under it. */
export function DeleteOldShowsButton({
  action,
  confirmMessage,
  disabled,
}: {
  action: (prev: DeleteOldShowsState, formData: FormData) => Promise<DeleteOldShowsState>;
  confirmMessage: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="flex flex-col items-end gap-2"
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button className="btn-danger" disabled={pending || disabled}>
        {pending ? "Deleting…" : "Delete now"}
      </button>
      {state?.done && <p className="text-sm text-ok">{state.done}</p>}
      {state?.error && <p className="error max-w-md text-right break-words">{state.error}</p>}
    </form>
  );
}
