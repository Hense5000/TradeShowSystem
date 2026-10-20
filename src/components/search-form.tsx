"use client";

import Form from "next/form";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";

/**
 * A search form that loads the results without reloading the whole page (the
 * menu and everything around the list stay), for the lists with search boxes.
 */
export function SearchForm({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Form action={usePathname()} className={className} role="search">
      {children}
    </Form>
  );
}

/** The form's Search button. While the results load it says so, and a thin bar runs along the top of the window. */
export function SearchButton() {
  const { pending } = useFormStatus();
  return (
    <>
      <button className="btn-secondary py-2" disabled={pending}>
        {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-line-strong border-t-brand" aria-hidden />}
        {pending ? "Searching…" : "Search"}
      </button>
      {pending && (
        <span role="progressbar" aria-label="Searching" className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-brand-soft">
          <span className="search-progress block h-full w-1/3 bg-brand" />
        </span>
      )}
    </>
  );
}
