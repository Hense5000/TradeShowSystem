"use client";

import { useActionState } from "react";
import { verifyCode } from "./actions";

export function VerifyForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action, pending] = useActionState(verifyCode, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p className="error">{state.error}</p>}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <div>
        <label className="label" htmlFor="code">Login code</label>
        <input
          className="input text-center text-lg tracking-[0.4em] tabular-nums"
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={9}
          autoFocus
          required
        />
      </div>
      <button className="btn w-full" disabled={pending}>
        {pending ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
