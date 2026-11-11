"use client";

import { useActionState } from "react";
import type { FillState } from "./actions";

/**
 * A button in the Exhibitors page's button column (platform admin) that lets
 * AI fill in what is missing, such as the contact persons. The badge tells
 * how many exhibitors lack it, the tooltip what the button does, and the
 * result shows under the button once it has run.
 */
export function AiFillButton({
  count,
  text,
  button,
  pendingButton,
  action,
}: {
  count: number;
  text: string;
  button: string;
  pendingButton: string;
  action: () => Promise<FillState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <button className="btn w-full px-3 py-1.5" disabled={pending} title={text}>
        {pending ? pendingButton : button}
        {!pending && <span className="rounded-full bg-white/25 px-1.5 text-xs leading-5 tabular-nums">{count}</span>}
      </button>
      {state?.message && <p className="max-w-72 text-xs text-muted xl:max-w-none">{state.message}</p>}
    </form>
  );
}
