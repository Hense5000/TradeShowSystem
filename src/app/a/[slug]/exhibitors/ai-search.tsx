"use client";

import { useActionState } from "react";
import type { ActionState } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { MAX_QUESTION } from "@/lib/exhibitor-ai-search";

/** "Ask AI": a sentence in any language that the AI turns into the filters below it. */
export function AiSearch({ action, question }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; question: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="border-b border-line bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Icon name="sparkle" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand" />
          <input
            className="input pl-9"
            name="question"
            defaultValue={question}
            maxLength={MAX_QUESTION}
            required
            disabled={pending}
            placeholder="Ask AI, e.g. “Danish medical companies at trade shows in Germany in spring”"
            aria-label="Ask AI to find exhibitors"
          />
        </div>
        <button className="btn py-2" disabled={pending}>
          <Icon name="sparkle" className="size-4" /> {pending ? "Thinking…" : "Ask AI"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">Write in your own words and language. The AI sets the filters; the companies always come from the list.</p>
      {state?.error && <p className="error mt-2">{state.error}</p>}
    </form>
  );
}
