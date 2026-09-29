"use client";

import { useActionState } from "react";
import { createAccount } from "./actions";

export function CreateAccountForm() {
  const [state, action, pending] = useActionState(createAccount, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <p className="error">{state.error}</p>}
      <div className="flex gap-2">
        <input className="input" name="companyName" placeholder="Company name" aria-label="Company name" required />
        <button className="btn shrink-0" disabled={pending}>
          Create
        </button>
      </div>
    </form>
  );
}
