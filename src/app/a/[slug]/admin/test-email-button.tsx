"use client";

import { useActionState } from "react";
import type { TestEmailState } from "./actions";

/** "Send test email", with Resend's answer shown under it. */
export function TestEmailButton({ action }: { action: (prev: TestEmailState, formData: FormData) => Promise<TestEmailState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <button className="btn-secondary" disabled={pending}>{pending ? "Sending…" : "Send test email"}</button>
      {state?.sent && <p className="text-sm text-ok">{state.sent}</p>}
      {state?.error && <p className="error max-w-md text-right break-words">{state.error}</p>}
    </form>
  );
}
