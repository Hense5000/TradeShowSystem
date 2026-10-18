"use client";

import { useActionState, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { DRAFT_LANGUAGES, type DraftLanguage, mailtoHref, MAX_DRAFT_GOAL } from "@/lib/email-draft";
import { draftLeadEmail } from "./actions";

const GOAL_KEY = "email-draft-goal";

/**
 * "Write email": AI writes a personal first email to a favorite exhibitor.
 * The user edits it and copies it or opens it in their own mail program;
 * nothing is sent from here.
 */
export function EmailDraftButton({
  slug,
  exhibitorId,
  name,
  email,
  language,
}: {
  slug: string;
  exhibitorId: string;
  name: string;
  email: string | null;
  language: DraftLanguage;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(draftLeadEmail.bind(null, slug, exhibitorId), undefined);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [goal, setGoal] = useState("");
  const [copied, setCopied] = useState(false);

  // The goal is the same for most emails, so it is remembered in this browser.
  useEffect(() => {
    try {
      setGoal(localStorage.getItem(GOAL_KEY) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    if (state?.body === undefined) return;
    setSubject(state.subject ?? "");
    setBody(state.body);
  }, [state]);

  const copy = async () => {
    await navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${body}` : body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setOpen(true)} title={`Let AI write a first email to ${name}`}>
        <Icon name="sparkle" className="size-4" /> Write email
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Email to ${name}`}
            className="card flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Email to {name}</h2>
                <p className="text-sm text-muted">
                  AI writes a first email from the company profile and the trade show. Read it through before you send it from your own mail.
                </p>
              </div>
              <button type="button" className="px-1 text-2xl leading-none text-muted hover:text-ink" aria-label="Close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <form
              action={formAction}
              className="flex flex-wrap items-end gap-2"
              onSubmit={() => {
                try {
                  localStorage.setItem(GOAL_KEY, goal);
                } catch {}
              }}
            >
              <label className="min-w-56 flex-1">
                <span className="label">What do you want? (optional)</span>
                <input
                  className="input"
                  name="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  maxLength={MAX_DRAFT_GOAL}
                  placeholder="e.g. Book a meeting at their booth"
                />
              </label>
              <label>
                <span className="label">Language</span>
                <select className="input w-auto" name="language" defaultValue={language}>
                  {Object.entries(DRAFT_LANGUAGES).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </label>
              <button className="btn" disabled={pending}>
                <Icon name="sparkle" className="size-4" /> {pending ? "Writing…" : body ? "Write again" : "Write draft"}
              </button>
            </form>
            {state?.error && <p className="error">{state.error}</p>}

            {body && (
              <>
                <label>
                  <span className="label">Subject</span>
                  <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </label>
                <label>
                  <span className="label">Email</span>
                  <textarea className="input min-h-72 resize-y leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={mailtoHref(email, subject, body)} className="btn">
                    <Icon name="mail" className="size-4" /> Open in mail
                  </a>
                  <button type="button" className="btn-secondary py-2" onClick={copy}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                  {!email && <p className="text-xs text-muted">No email address is known for this exhibitor; add the recipient in your mail program.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
