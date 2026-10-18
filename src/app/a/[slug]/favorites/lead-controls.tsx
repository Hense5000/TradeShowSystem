"use client";

import type { LeadStatus } from "@prisma/client";
import { useActionState, useEffect, useRef, useState } from "react";
import { LEAD_LABEL, LEAD_STATUSES, MAX_FOLLOW_UP_NOTE, MAX_LEAD_NOTE } from "@/lib/leads";
import { saveFollowUp, saveLeadNote, setLeadAssignee, setLeadStatus } from "./actions";

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

/** Who in the account is responsible for a favorite exhibitor. Saves as soon as someone is picked. */
export function LeadAssigneeSelect({
  slug,
  exhibitorId,
  name,
  assigneeId,
  members,
}: {
  slug: string;
  exhibitorId: string;
  name: string;
  assigneeId: string | null;
  members: { id: string; name: string }[];
}) {
  return (
    <form action={setLeadAssignee.bind(null, slug, exhibitorId)}>
      <select
        name="assignee"
        defaultValue={assigneeId ?? ""}
        key={assigneeId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`input w-auto max-w-48 py-1.5 ${assigneeId ? "" : "text-muted"}`}
        aria-label={`Who is responsible for ${name}`}
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
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

/**
 * The follow-up reminder on a favorite exhibitor. Saves when a date is picked
 * or the reminder text is left; Clear removes both.
 */
export function LeadFollowUp({
  slug,
  exhibitorId,
  name,
  date,
  note,
  overdue,
}: {
  slug: string;
  exhibitorId: string;
  name: string;
  date: string; // "2026-11-05", or "" when none is set
  note: string | null;
  overdue: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveFollowUp.bind(null, slug, exhibitorId), undefined);
  const savedNote = useRef(note ?? "");

  return (
    <form action={formAction} className="flex min-w-48 flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          name="date"
          defaultValue={date}
          aria-label={`Follow-up date for ${name}`}
          className={`input w-auto py-1.5 ${overdue ? "border-bad text-bad" : ""}`}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
        {date && (
          <button
            type="button"
            className="px-1 text-xs font-semibold text-muted hover:text-ink"
            title="Remove the follow-up"
            onClick={(e) => {
              const form = e.currentTarget.form!;
              (form.elements.namedItem("date") as HTMLInputElement).value = "";
              (form.elements.namedItem("note") as HTMLInputElement).value = "";
              form.requestSubmit();
            }}
          >
            Clear
          </button>
        )}
      </div>
      <input
        name="note"
        defaultValue={note ?? ""}
        maxLength={MAX_FOLLOW_UP_NOTE}
        placeholder="Reminder, e.g. Call again"
        aria-label={`Follow-up reminder for ${name}`}
        className="input py-1.5"
        onBlur={(e) => {
          if (e.currentTarget.value.trim() === savedNote.current.trim()) return;
          savedNote.current = e.currentTarget.value;
          // Without a date there is nothing to remind about yet; it is saved with the date.
          if ((e.currentTarget.form!.elements.namedItem("date") as HTMLInputElement).value) e.currentTarget.form?.requestSubmit();
        }}
      />
      {pending ? <p className="hint">Saving…</p> : state?.error && <p className="text-xs text-bad">{state.error}</p>}
    </form>
  );
}
