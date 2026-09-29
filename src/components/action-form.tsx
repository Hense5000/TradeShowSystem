"use client";

import { useActionState } from "react";

export type ActionState = { error?: string } | undefined;

/** A form that runs a server action and shows the error it returns, if any. */
export function ActionForm({
  action,
  children,
  className,
  confirmMessage,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && <p className="error mt-2 basis-full">{state.error}</p>}
    </form>
  );
}
