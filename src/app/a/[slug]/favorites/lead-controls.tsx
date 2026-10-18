"use client";

import type { LeadStatus } from "@prisma/client";
import { useActionState, useEffect, useRef, useState } from "react";
import { LEAD_LABEL, LEAD_STATUSES, MAX_LEAD_NOTE } from "@/lib/leads";
import { saveLeadNote, setLeadStatus } from "./actions";

/** The status of a favorite exhibitor. Saves as soon as another status is picked. */
export function LeadStatusSelect({ slug, exhibitorId, name, status }: { slug: string; exhibitorId: string; name: string; status: LeadStatus }) {
  return (
    <form action={setLeadStatus.bind(null, slug, exhibitorId)}>
      <select
        name="status"
        defaultValue={status}
        key={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="input w-auto py-1.5"
        aria-label={`Status of ${name}`}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>{LEAD_LABEL[s]}</option>
        ))}
      </select>
    </form>
  );
}

/** The account's notes about a favorite exhibitor. Saves when the field is left. */
export function LeadNote({ slug, exhibitorId, name, note }: { slug: string; exhibitorId: string; name: string; note: string | null }) {
  const [state, formAction, pending] = useActionState(saveLeadNote.bind(null, slug, exhibitorId), undefined);
  const saved = useRef(note ?? "");
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!state?.saved) return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 2500);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <form action={formAction} className="min-w-56">
      <textarea
        name="note"
        defaultValue={note ?? ""}
        rows={2}
        maxLength={MAX_LEAD_NOTE}
        placeholder="Add a note"
        aria-label={`Notes about ${name}`}
        className="input resize-y py-1.5"
        onBlur={(e) => {
          if (e.currentTarget.value.trim() === saved.current.trim()) return;
          saved.current = e.currentTarget.value;
          e.currentTarget.form?.requestSubmit();
        }}
      />
      {pending ? (
        <p className="hint">Saving…</p>
      ) : state?.error ? (
        <p className="mt-1 text-xs text-bad">{state.error}</p>
      ) : (
        showSaved && <p className="mt-1 text-xs text-ok">Saved</p>
      )}
    </form>
  );
}
