"use client";

import { useActionState, useState } from "react";
import { Dialog } from "@/components/dialog";
import { Icon } from "@/components/icons";
import type { ExportLimitInfo } from "@/lib/export-limit-run";
import { upgradePlan } from "../billing/actions";

/**
 * An Excel or CSV download button. Over the daily trade show limit (see
 * src/lib/export-limit.ts) the export answers with the limit instead of a
 * file, and a dialog explains it, with an Upgrade button for the owner.
 */
export function ExportButton({ slug, href, title, children }: { slug: string; href: string; title: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<ExportLimitInfo | null>(null);
  const [failed, setFailed] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(href, { cache: "no-store" });
      if (res.status === 402) {
        setLimit(await res.json());
        return;
      }
      // Logged out meanwhile: let the browser follow on to the login page.
      if (res.headers.get("Content-Type")?.startsWith("text/html")) {
        window.location.href = href;
        return;
      }
      if (!res.ok) throw new Error(`Export answered ${res.status}`);
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "exhibitors.xlsx";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn-secondary py-2" title={title} onClick={download} disabled={busy}>
        <Icon name="download" className="size-4" /> {busy ? "Preparing…" : children}
      </button>
      {limit && <LimitDialog slug={slug} info={limit} onClose={() => setLimit(null)} />}
      {failed && (
        <Dialog title="The download failed" onClose={() => setFailed(false)}>
          <p className="text-sm text-muted">Please try again in a moment.</p>
        </Dialog>
      )}
    </>
  );
}

const shows = (n: number) => `${n} trade ${n === 1 ? "show" : "shows"}`;

function LimitDialog({ slug, info, onClose }: { slug: string; info: ExportLimitInfo; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(upgradePlan.bind(null, slug), undefined);
  const [accepted, setAccepted] = useState(false);
  const left = Math.max(0, info.limit - info.used.length);

  return (
    <Dialog title="Daily download limit reached" onClose={onClose}>
      <div className="flex flex-col gap-2 text-sm">
        <p>
          Your plan lets each user download exhibitors from <strong>{shows(info.limit)} per day</strong>.
          {info.used.length > 0 && left === 0 && " You have already used today's download on:"}
          {info.used.length > 0 && left > 0 && ` You have ${shows(left)} left today, but this download has exhibitors from ${shows(info.needed)}.`}
          {info.used.length === 0 && ` This download has exhibitors from ${shows(info.needed)}. Choose one trade show in the filter first.`}
        </p>
        {info.used.length > 0 && (
          <ul className="list-disc pl-5 text-muted">
            {info.used.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
        <p className="text-muted">You can download the same trade shows again today. The limit starts over at midnight (Danish time).</p>
      </div>

      {info.plan === "basic" && (
        <div className="flex flex-col gap-3 rounded-lg border border-brand/30 bg-brand-soft p-4">
          <div>
            <p className="font-bold">Upgrade to {shows(info.proLimit)} per day</p>
            <p className="text-sm">
              Download exhibitors from up to {info.proLimit} trade shows per day.
              {info.proPrice && (
                <>
                  {" "}The price becomes <strong>{info.proPrice}</strong> per user per month
                  {info.basicPrice && <> instead of {info.basicPrice}</>}.
                </>
              )}
            </p>
          </div>
          {info.canUpgrade ? (
            <form action={formAction} className="flex flex-col gap-3">
              <input type="hidden" name="back" value={typeof window === "undefined" ? "" : window.location.pathname + window.location.search} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span>I accept the new price{info.proPrice && ` of ${info.proPrice} per user per month`}.</span>
              </label>
              <button className="btn self-start" disabled={!accepted || pending}>
                {pending ? "Opening Stripe…" : "Upgrade"}
              </button>
              {state?.error && <p className="error">{state.error}</p>}
            </form>
          ) : (
            <p className="text-sm text-muted">
              {info.ownerName ? `Only the account owner can upgrade. Ask ${info.ownerName}.` : "Upgrading is not available yet. Please contact support."}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
