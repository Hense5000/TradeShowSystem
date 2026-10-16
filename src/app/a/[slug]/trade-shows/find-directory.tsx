"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { findShowDirectoryUrl } from "./actions";

/**
 * Shown on a trade show without an Exhibitor directory URL: AI looks for the
 * show's exhibitor list on its website and the web and saves the address,
 * so "Fetch exhibitors" can then read it.
 */
export function FindDirectory({ slug, tradeShowId }: { slug: string; tradeShowId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();

  async function run() {
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await findShowDirectoryUrl(slug, tradeShowId);
      if (r.directoryUrl) {
        setMessage({ text: `Found and saved: ${r.directoryUrl}`, ok: true });
        // A full reload, so the form above shows the new address and saving it does not clear it again.
        window.location.reload();
      } else {
        setMessage({ text: r.error ?? "AI found no exhibitor list for this show. Add the address by hand if you know it.", ok: false });
      }
    } catch {
      setMessage({ text: "The search took too long or the connection was lost. Try again.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name="sparkle" className="size-5" />
        </span>
        <div className="min-w-56 flex-1 text-sm">
          <p className="font-semibold">This trade show has no Exhibitor directory URL</p>
          <p className="text-muted">AI looks for the show&apos;s exhibitor list on its website and the web and saves the address. Then you can fetch the exhibitors.</p>
        </div>
        <button type="button" className="btn" onClick={() => void run()} disabled={busy}>
          {busy ? "Finding exhibitor list…" : "Find exhibitor list"}
        </button>
      </div>
      {message && <p role="status" className={message.ok ? "success" : "error"}>{message.text}</p>}
    </section>
  );
}
