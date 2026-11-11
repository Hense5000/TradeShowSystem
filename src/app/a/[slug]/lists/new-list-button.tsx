"use client";

import { useEffect, useState } from "react";
import { ActionForm, type ActionState } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { MAX_LIST_NAME } from "@/lib/saved-lists";

/** "New list" in the Saved lists page's button column, and its popup with the name field. */
export function NewListButton({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-muted hover:text-ink" title="Create a list of exhibitors you want to contact">
        <Icon name="plus" className="size-4" /> New list
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 print:hidden" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-list-title"
            className="relative w-full max-w-[480px] rounded-2xl bg-surface p-6 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute top-2.5 right-3 px-1 text-2xl leading-none text-faint hover:text-ink">
              ×
            </button>
            <h2 id="new-list-title" className="pr-6 text-xl font-bold">New list</h2>
            <p className="mt-1 text-sm text-muted">
              Then add exhibitors from the Exhibitors page with the <span className="font-semibold text-ink">Save</span> button, or save all the exhibitors a search shows at once.
            </p>
            <ActionForm action={action} className="mt-4 flex flex-col gap-3">
              <div>
                <label htmlFor="new-list-name" className="label">List name</label>
                <input
                  id="new-list-name"
                  className="input"
                  name="name"
                  required
                  autoFocus
                  maxLength={MAX_LIST_NAME}
                  placeholder="For example: Contact before Medica 2026"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button className="btn">
                  <Icon name="plus" className="size-4" /> Create list
                </button>
              </div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
