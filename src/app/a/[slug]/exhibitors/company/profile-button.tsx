"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import type { CompanyProfileResult } from "@/lib/company-profile-run";

/**
 * "Write company profile with AI" on a company's page that has no profile
 * yet. Any member may press it; the profile is saved for everyone.
 */
export function ProfileButton({ action }: { action: () => Promise<CompanyProfileResult> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function onClick() {
    setError(undefined);
    startTransition(async () => {
      try {
        const r = await action();
        if (r.profile) router.refresh();
        else setError(r.error ?? "No profile was written.");
      } catch {
        setError("The AI took too long or the connection was lost. Try again in a moment.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-subtle px-4 py-3 text-sm">
      <p className="min-w-56 flex-1 text-muted">
        {pending ? "AI is reading the company's website… this can take up to a minute." : "This company has no profile yet. AI can write a short description in English from its website."}
      </p>
      <button type="button" className="btn-secondary" onClick={onClick} disabled={pending}>
        <Icon name="sparkle" className="size-4 text-brand" />
        {pending ? "Writing…" : "Write company profile with AI"}
      </button>
      {error && <p className="error w-full">{error}</p>}
    </div>
  );
}
