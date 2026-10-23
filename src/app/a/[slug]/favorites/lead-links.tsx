"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { MAX_LINK_TITLE, MAX_LINK_URL, MAX_LINKS_PER_LEAD, storageName } from "@/lib/lead-links";
import { addLeadLink, deleteLeadLink } from "./actions";

export type LeadLinkRow = { id: string; url: string; title: string; addedBy: string | null; date: string };

/**
 * Files kept with a favorite exhibitor, e.g. quotes and presentations, under
 * its Lead and Notes. The files stay in the account's own storage (Google
 * Drive, Dropbox, Box, OneDrive ...); a member pastes the share link and a
 * name, and everyone in the account can open it from here.
 */
export function LeadLinks({ slug, exhibitorId, name, links }: { slug: string; exhibitorId: string; name: string; links: LeadLinkRow[] }) {
  const [adding, setAdding] = useState(false);
  const [state, formAction, pending] = useActionState(addLeadLink.bind(null, slug, exhibitorId), undefined);
  const [confirm, setConfirm] = useState<LeadLinkRow | null>(null);
  const [deleting, startDelete] = useTransition();

  // A saved link closes the form; the list shows it.
  useEffect(() => {
    if (state?.saved) setAdding(false);
  }, [state]);

  const full = links.length >= MAX_LINKS_PER_LEAD;

  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-subtle/60 px-3 py-2.5">
      {adding ? (
        <form action={formAction} className="flex flex-wrap items-start gap-2">
          <input
            name="url"
            type="text"
            inputMode="url"
            required
            autoFocus
            maxLength={MAX_LINK_URL}
            placeholder="Paste the share link, e.g. from Google Drive, Dropbox, Box or OneDrive"
            aria-label={`Link to a file for ${name}`}
            className="input min-w-64 flex-[2] py-1.5"
          />
          <input name="title" maxLength={MAX_LINK_TITLE} placeholder="Name, e.g. Quote 2026" aria-label="Name of the file" className="input min-w-40 flex-1 py-1.5" />
          <button className="btn py-1.5" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => setAdding(false)}>
            Cancel
          </button>
          {state?.error && <p className="w-full text-xs text-bad">{state.error}</p>}
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <button
            type="button"
            className="btn-secondary py-1"
            disabled={full}
            title={full ? `A favorite can have up to ${MAX_LINKS_PER_LEAD} links` : undefined}
            onClick={() => setAdding(true)}
            aria-label={`Add a file link for ${name}`}
          >
            <Icon name="link" className="size-4" /> Add file link
          </button>
          <p className="text-xs text-muted">Quotes, presentations and other documents from your own Google Drive, Dropbox, Box, OneDrive or other storage.</p>
        </div>
      )}

      {links.length > 0 && (
        <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.id} className="flex min-w-0 items-center gap-2 rounded-md bg-surface px-2 py-1">
              <Icon name="link" className="size-4 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:text-brand hover:underline" title={l.url}>
                  {l.title}
                </a>
                <p className="truncate text-xs text-muted">{[storageName(l.url), l.addedBy, l.date].filter(Boolean).join(" · ")}</p>
              </div>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-subtle hover:text-brand"
                title="Open"
                aria-label={`Open ${l.title}`}
              >
                <Icon name="external" className="size-4" />
              </a>
              <button
                type="button"
                className="grid size-7 shrink-0 place-items-center rounded-md text-lg leading-none text-muted hover:bg-bad-soft hover:text-bad"
                title="Remove link"
                aria-label={`Remove ${l.title}`}
                onClick={() => setConfirm(l)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => !deleting && setConfirm(null)}>
          <div role="dialog" aria-modal="true" aria-label="Remove link?" className="card flex w-full max-w-lg flex-col gap-4 text-left" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Remove link?</h2>
            <p className="text-sm break-words text-muted">
              The link to <strong className="text-ink">{confirm.title}</strong> is removed for everyone in your account. The file itself is not
              deleted from your storage.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" disabled={deleting} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    await deleteLeadLink(slug, confirm.id);
                    setConfirm(null);
                  })
                }
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
