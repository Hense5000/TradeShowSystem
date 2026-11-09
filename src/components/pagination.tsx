import Link from "next/link";

// Lists show this many rows per page.
export const PAGE_SIZE = 50;

/** The page number from ?page=, at least 1. */
export function pageParam(value: string | string[] | undefined): number {
  return Math.max(1, Number.parseInt(typeof value === "string" ? value : "1", 10) || 1);
}

/** The list's URL for page p, keeping the search and filters. Page 1 has no ?page=. */
export function pageLink(path: string, params: Record<string, string>, p: number): string {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  if (p > 1) query.set("page", String(p));
  const s = query.toString();
  return s ? `${path}?${s}` : path;
}

/** Previous / Page x of y / Next under a list. Shows nothing when everything fits on one page. */
export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between border-t border-line px-5 py-3 text-sm" aria-label="Pages">
      {page > 1 ? <Link href={href(page - 1)} className="btn-secondary">Previous</Link> : <span />}
      <span className="text-muted">Page {page} of {pages}</span>
      {page < pages ? <Link href={href(page + 1)} className="btn-secondary">Next</Link> : <span />}
    </nav>
  );
}
