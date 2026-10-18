"use client";

import { useOptimistic, useTransition } from "react";
import { setVisited } from "../actions";

/** Ticks off a booth on the meeting plan. Shared with everyone in the account. */
export function VisitedBox({ slug, exhibitorId, name, visited }: { slug: string; exhibitorId: string; name: string; visited: boolean }) {
  const [on, setOn] = useOptimistic(visited);
  const [, startTransition] = useTransition();
  return (
    <input
      type="checkbox"
      checked={on}
      onChange={(e) => {
        const next = e.currentTarget.checked;
        startTransition(async () => {
          setOn(next);
          await setVisited(slug, exhibitorId, next);
        });
      }}
      className="size-6 shrink-0 cursor-pointer accent-brand"
      aria-label={`Visited ${name}`}
    />
  );
}

/** Opens the browser's print window, where the plan can also be saved as a PDF. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary py-2 print:hidden">
      Print / PDF
    </button>
  );
}
