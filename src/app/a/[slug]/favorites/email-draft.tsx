"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { mailtoHref } from "@/lib/email-draft";

/**
 * "Write email": the standard first email to a favorite exhibitor, filled in
 * from the Company profile. The user edits it and copies it or opens it in
 * their own mail program; nothing is sent from here.
 */
export function EmailDraftButton({
  slug,
  name,
  email,
  draft,
  canEditProfile,
  profileFilled,
}: {
  slug: string;
  name: string;
  email: string | null;
  draft: { subject: string; body: string };
  canEditProfile: boolean;
  profileFilled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);

  const start = () => {
    // Each time the dialog opens it starts from the template again.
    setSubject(draft.subject);
    setBody(draft.body);
    setOpen(true);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${body}` : body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button type="button" className="btn mt-2 w-full py-1.5" onClick={start} title={`Write a first email to ${name}`}>
        <Icon name="mail" className="size-4" /> Write email
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
                <p className="text-sm text-muted">Your standard introduction email. Read it through and adjust it before you send it from your own mail.</p>
              </div>
              <button type="button" className="px-1 text-2xl leading-none text-muted hover:text-ink" aria-label="Close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            {!profileFilled && (
              <p className="rounded-lg bg-brand-soft px-3 py-2.5 text-sm">
                {canEditProfile ? (
                  <>
                    Add what you offer and up to 3 benefits on{" "}
                    <a href={`/a/${slug}/profile`} className="font-semibold text-brand hover:underline">Company profile</a> to make this email stronger.
                  </>
                ) : (
                  "An owner or admin can add what you offer and up to 3 benefits on Company profile to make this email stronger."
                )}
              </p>
            )}

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
          </div>
        </div>
      )}
    </>
  );
}
