"use client";

import { useActionState } from "react";
import { Icon } from "@/components/icons";
import type { FillState } from "./actions";

/**
 * A note above the exhibitor list with a button that lets AI fill in what is
 * missing: the company profiles, or the contact persons.
 */
export function AiFillCard({
  title,
  text,
  button,
  pendingButton,
  action,
}: {
  title: string;
  text: string;
  button: string;
  pendingButton: string;
  action: () => Promise<FillState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="card flex flex-wrap items-center gap-3 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
        <Icon name="sparkle" className="size-5" />
      </span>
      <div className="min-w-56 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        <p className="text-muted">{state?.message ?? text}</p>
      </div>
      <button className="btn" disabled={pending}>
        {pending ? pendingButton : button}
      </button>
    </form>
  );
}
