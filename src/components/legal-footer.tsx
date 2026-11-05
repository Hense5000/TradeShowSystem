"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function FooterLink() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Remember where the visitor was, so "Go back" on the legal page returns there.
  const back = pathname === "/legal" ? null : pathname + (search ? `?${search}` : "");
  const href = back ? `/legal?back=${encodeURIComponent(back)}` : "/legal";
  return (
    <Link href={href} className="hover:text-brand hover:underline">
      Terms, Privacy- &amp; Cookie policies
    </Link>
  );
}

/** Thin footer at the bottom of every page with the link to the legal texts. */
export function LegalFooter() {
  return (
    <footer className="border-t border-line bg-surface px-4 py-4 text-center text-xs text-muted print:hidden">
      <Suspense
        fallback={
          <Link href="/legal" className="hover:text-brand hover:underline">
            Terms, Privacy- &amp; Cookie policies
          </Link>
        }
      >
        <FooterLink />
      </Suspense>
    </footer>
  );
}
