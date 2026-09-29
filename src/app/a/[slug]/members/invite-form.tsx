"use client";

import type { Role } from "@prisma/client";
import { useActionState, useState } from "react";
import { ROLE_LABEL } from "@/lib/permissions";
import type { InviteState } from "./actions";

export function InviteForm({
  action,
  roles,
}: {
  action: (prev: InviteState, formData: FormData) => Promise<InviteState>;
  roles: Role[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap gap-2">
        <input className="input min-w-0 basis-full sm:basis-0 sm:flex-1" name="email" type="email" placeholder="colleague@company.com" aria-label="Email" defaultValue={state?.error ? state.email : undefined} required />
        <select className="input w-auto" name="role" defaultValue="MEMBER" aria-label="Role">
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <button className="btn" disabled={pending}>Create invitation</button>
      </form>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.link && (
        <div className="success">
          <p>Invitation created for {state.email}. Send them this link (valid for 7 days, shown only once):</p>
          <div className="mt-2 flex gap-2">
            <input className="input font-mono text-xs" readOnly value={state.link} onFocus={(e) => e.target.select()} />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(state.link!);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
