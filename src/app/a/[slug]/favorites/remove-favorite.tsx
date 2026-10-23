"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { toggleFavorite } from "../lists/actions";

/**
 * The filled star on a Favorites row. Taking it off also deletes the lead's
 * status, notes, project value, reminder and files, so it asks first.
 */
export function RemoveFavoriteStar({
  slug,
  exhibitorId,
  name,
}: {
  slug: string;
  exhibitorId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-brand hover:bg-subtle"
        title="Remove from Favorites"
        aria-label={`Remove ${name} from Favorites`}
        aria-pressed
        onClick={() => setOpen(true)}
      >
        <Icon name="star" className="size-5" filled />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Remove from Favorites?"
            className="card flex w-full max-w-lg flex-col gap-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">Remove from Favorites?</h2>
            <p className="text-sm text-muted">
              <strong className="text-ink">{name}</strong> will be removed from
              your account&apos;s Favorites. Its lead status, notes, project
              value, responsible user, reminder and files are deleted too.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={pending}
                onClick={() =>
                  startTransition(() =>
                    toggleFavorite(slug, exhibitorId, false),
                  )
                }
              >
                {pending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
