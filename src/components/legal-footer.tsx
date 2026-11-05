import Link from "next/link";

/** Thin footer at the bottom of every page with the link to the legal texts. */
export function LegalFooter() {
  return (
    <footer className="border-t border-line bg-surface px-4 py-4 text-center text-xs text-muted print:hidden">
      <Link href="/legal" className="hover:text-brand hover:underline">
        Terms, Privacy- &amp; Cookie policies
      </Link>
    </footer>
  );
}
