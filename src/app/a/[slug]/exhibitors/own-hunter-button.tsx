"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import type { OwnFindResult } from "@/lib/own-contacts-run";

/**
 * "Find contact with Hunter.io": looks the company up with the account's own
 * Hunter.io key. What is found is only shown to this account.
 */
export function OwnHunterButton({ action, again, compact }: { action: () => Promise<OwnFindResult>; again?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  function onClick() {
    setMessage(undefined);
    startTransition(async () => {
      try {
        const r = await action();
        if (r.contact) router.refresh();
        else setMessage(r.error ?? "Hunter.io found no contact.");
      } catch {
        setMessage("Hunter.io took too long or the connection was lost. Try again in a moment.");
      }
    });
  }

  const label = pending ? "Searching Hunter.io…" : again ? "Search again with Hunter.io" : "Find contact with Hunter.io";
  return (
    <div className={compact ? "mt-1.5" : "flex flex-wrap items-center gap-3"}>
      <button
        type="button"
        className={compact ? "inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline disabled:opacity-60" : "btn-secondary"}
        onClick={onClick}
        disabled={pending}
        title="Uses one credit on your own Hunter.io account. Only your account sees what is found."
      >
        <Icon name="search" className={compact ? "size-3.5" : "size-4 text-brand"} />
        {label}
      </button>
      {message && <p className={`text-xs text-muted ${compact ? "mt-1" : ""}`} role="status">{message}</p>}
    </div>
  );
}

/** The small mark next to a contact the account found with its own Hunter.io key. */
export function OwnContactTag() {
  return (
    <span className="mt-0.5 inline-block rounded bg-brand-soft px-1.5 py-px text-[0.65rem] font-semibold text-brand" title="Found with your own Hunter.io account. Only your account sees it.">
      Your Hunter.io
    </span>
  );
}
