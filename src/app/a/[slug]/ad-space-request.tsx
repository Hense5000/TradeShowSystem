"use client";

import { useActionState, useEffect, useState } from "react";
import { AD_IMAGE_TEXT, adPlace, adPriceText, adSlot, MAX_AD_REQUEST_MESSAGE } from "@/lib/dashboard-ads";
import { requestAdSpace } from "./ad-actions";

/** The "Get this ad space" button on an empty ad space, and its form popup. */
export function AdSpaceRequest({ slug, slot, defaults }: { slug: string; slot: number; defaults: { name: string; company: string; email: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn py-1">
        Get this ad space
      </button>
      {/* A new form each time it opens, so a sent request starts over. */}
      {open && <RequestDialog slug={slug} slot={slot} defaults={defaults} onClose={() => setOpen(false)} />}
    </>
  );
}

function RequestDialog({
  slug,
  slot,
  defaults,
  onClose,
}: {
  slug: string;
  slot: number;
  defaults: { name: string; company: string; email: string };
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(requestAdSpace.bind(null, slug), undefined);
  const sent = state && "sent" in state;
  const error = state && "error" in state ? state.error : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-request-title"
        className="relative max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-surface p-6 text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" onClick={onClose} className="absolute top-2.5 right-3 px-1 text-2xl leading-none text-faint hover:text-ink">
          ×
        </button>
        {sent ? (
          <div className="py-4 text-center">
            <p className="mx-auto grid size-12 place-items-center rounded-full bg-ok-soft text-2xl font-extrabold text-ok">✓</p>
            <h2 id="ad-request-title" className="mt-3 text-xl font-bold">Thank you!</h2>
            <p className="mt-1 text-sm text-muted">We have received your request and will contact you soon about the ad space.</p>
            <button type="button" onClick={onClose} className="btn mt-5">
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 id="ad-request-title" className="pr-6 text-xl font-bold">Get this ad space</h2>
            <p className="mt-1 text-sm text-muted">
              Show your company on the {where(slot)} of every Trade Show System user. Fill in the form and we will contact you with the details.
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-line bg-subtle px-4 py-3 text-sm">
              <dt className="text-muted">Price</dt>
              <dd className="font-bold">{price(slot)}</dd>
              <dt className="text-muted">Your ad</dt>
              <dd>
                An image: {AD_IMAGE_TEXT}. Send it to us when we contact you, and we put it up with a link to your website.
              </dd>
            </dl>
            <form action={action} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="slot" value={slot} />
              <fieldset disabled={pending} className="contents">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ad-name" className="label">Your name *</label>
                    <input id="ad-name" name="name" className="input" required maxLength={200} defaultValue={defaults.name} autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="ad-company" className="label">Company *</label>
                    <input id="ad-company" name="company" className="input" required maxLength={200} defaultValue={defaults.company} autoComplete="organization" />
                  </div>
                  <div>
                    <label htmlFor="ad-email" className="label">Email *</label>
                    <input id="ad-email" name="email" type="email" className="input" required maxLength={200} defaultValue={defaults.email} autoComplete="email" />
                  </div>
                  <div>
                    <label htmlFor="ad-phone" className="label">Phone</label>
                    <input id="ad-phone" name="phone" type="tel" className="input" maxLength={50} autoComplete="tel" />
                  </div>
                </div>
                <div>
                  <label htmlFor="ad-website" className="label">Website</label>
                  <input id="ad-website" name="website" className="input" maxLength={200} placeholder="www.yourcompany.com" autoComplete="url" />
                </div>
                <div>
                  <label htmlFor="ad-message" className="label">Message</label>
                  <textarea
                    id="ad-message"
                    name="message"
                    className="input resize-y leading-relaxed"
                    rows={3}
                    maxLength={MAX_AD_REQUEST_MESSAGE}
                    placeholder="Tell us a little about what you would like to advertise."
                  />
                </div>
                {error && <p className="error">{error}</p>}
                <div className="mt-1 flex justify-end gap-2">
                  <button type="button" onClick={onClose} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn">
                    {pending ? "Sending…" : "Send request"}
                  </button>
                </div>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/** What the space costs: "€99 per month" on the dashboard, "€69 per month" on the other pages. */
function price(slot: number) {
  return adPriceText(adSlot(slot) ?? 1);
}

/** Where the space is, in the words of the form: "dashboard", "Trade shows page", "Saved lists page" and so on. */
function where(slot: number) {
  const s = adSlot(slot);
  return s ? adPlace(s).page.where : "dashboard";
}
