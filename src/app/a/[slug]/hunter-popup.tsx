"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hideHunterPopup, markHunterPopupShown } from "./hunter-popup-actions";

const HUNTER_URL = "https://hunter.io";

const BENEFITS = ["Real contact persons, not info@", "Saved directly on your favorites", "Only your account sees the contacts"];

/** The Hunter.io popup (400 x 400) for accounts that have not connected their own Hunter.io account. */
export function HunterPopup({ slug }: { slug: string }) {
  const [open, setOpen] = useState(true);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    markHunterPopupShown(slug).catch((error) => console.error("Could not save that the Hunter.io popup was shown", error));
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    setOpen(false);
    if (dontShow) hideHunterPopup(slug).catch((error) => console.error("Could not hide the Hunter.io popup", error));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 print:hidden" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hunter-popup-title"
        className="relative flex max-h-[90vh] w-full max-w-[400px] flex-col overflow-y-auto rounded-2xl bg-surface px-7 pt-7 pb-4 text-center shadow-2xl sm:h-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" onClick={close} className="absolute top-2.5 right-3 px-1 text-2xl leading-none text-faint hover:text-ink">
          ×
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/hunter-logo.png" alt="Hunter" className="mx-auto mb-4 h-8 w-auto" />
        <h2 id="hunter-popup-title" className="text-xl leading-tight font-bold">
          Find the right person
          <br />
          at any trade show
        </h2>
        <p className="mt-2 text-sm text-muted">Connect your Hunter.io account and get names, titles and email addresses with one click.</p>
        <ul className="mx-auto mt-3 flex flex-col gap-1 text-left text-sm">
          {BENEFITS.map((b) => (
            <li key={b}>
              <span className="mr-2 font-extrabold text-ok">✓</span>
              {b}
            </li>
          ))}
        </ul>
        <a href={HUNTER_URL} target="_blank" rel="noopener noreferrer" onClick={close} className="btn mt-4 py-2.5 text-[0.95rem]">
          Connect Hunter.io
        </a>
        <div className="mt-3 flex items-center justify-between gap-3 text-[0.8rem]">
          <Link href={`/a/${slug}/profile#hunter`} onClick={close} className="font-semibold text-brand hover:underline">
            Have a key? Add it on Company profile
          </Link>
          <button type="button" onClick={close} className="text-faint hover:text-ink">
            Not now
          </button>
        </div>
        <label className="mt-3 flex sm:mt-auto items-center justify-center gap-2 border-t border-line pt-2.5 text-[0.8rem] text-muted">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="size-4 accent-brand" />
          Don&apos;t show this popup again
        </label>
      </div>
    </div>
  );
}
