"use client";

import { useActionState } from "react";
import { Icon } from "@/components/icons";
import type { FillState } from "./actions";

/** A note above the exhibitor list with a button that lets AI write the missing company profiles. */
export function FillProfiles({ missing, action }: { missing: number; action: () => Promise<FillState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="card flex flex-wrap items-center gap-3 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
        <Icon name="sparkle" className="size-5" />
      </span>
      <div className="min-w-56 flex-1 text-sm">
        <p className="font-semibold">
          {missing} {missing === 1 ? "exhibitor has" : "exhibitors have"} a website but no company profile
        </p>
        <p className="text-muted">
          {state?.message ?? "AI writes them from each website, up to 300 words. They are also written automatically during the night."}
        </p>
      </div>
      <button className="btn" disabled={pending}>
        {pending ? "Writing profiles…" : "Write missing profiles"}
      </button>
    </form>
  );
}
