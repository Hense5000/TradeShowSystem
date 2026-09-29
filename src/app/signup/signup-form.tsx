"use client";

import { useActionState } from "react";
import { signup } from "./actions";

export function SignupForm({ invite, inviteEmail }: { invite?: string; inviteEmail?: string }) {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p className="error">{state.error}</p>}
      {invite && <input type="hidden" name="invite" value={invite} />}
      {!invite && (
        <div>
          <label className="label" htmlFor="companyName">Company name</label>
          <input className="input" id="companyName" name="companyName" autoComplete="organization" defaultValue={state?.values?.companyName} required />
        </div>
      )}
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input className="input" id="name" name="name" autoComplete="name" defaultValue={state?.values?.name} required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          className="input read-only:bg-zinc-100"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={inviteEmail ?? state?.values?.email}
          readOnly={Boolean(inviteEmail)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <button className="btn w-full" disabled={pending}>
        {pending ? "Creating…" : invite ? "Join account" : "Create account"}
      </button>
    </form>
  );
}
