import { MAX_PAGES, morePages } from "@/lib/exhibitor-fetch";
import { fetchExhibitorPage } from "./actions";

export type DirectoryTotals = { pages: number; found: number; added: number; failedPages: number; morePagesLeft: number };

export type DirectoryRun = {
  totals: DirectoryTotals;
  firstError?: string;
  /** The AI service itself failed (bad key, no credit), so other shows would fail too. */
  stopped: boolean;
};

/**
 * Reads a show's exhibitor directory page by page from the browser, following
 * its page 2, 3 ... or A-Z links, and adds the exhibitors found to the show.
 * Reports after each page how many pages are read, known and how many
 * exhibitors were added.
 */
export async function readDirectory(
  slug: string,
  tradeShowId: string,
  directoryUrl: string,
  onProgress: (read: number, known: number, added: number) => void,
): Promise<DirectoryRun> {
  const queue = [directoryUrl];
  const known = new Set(queue);
  const totals: DirectoryTotals = { pages: 0, found: 0, added: 0, failedPages: 0, morePagesLeft: 0 };
  let firstError: string | undefined;
  let stopped = false;
  onProgress(0, 1, 0);
  while (queue.length > 0 && totals.pages + totals.failedPages < MAX_PAGES) {
    const page = queue.shift()!;
    const r = await fetchExhibitorPage(slug, tradeShowId, page);
    if (r.error) {
      totals.failedPages++;
      firstError ??= r.error;
      if (r.stop) {
        stopped = true;
        break;
      }
    } else {
      totals.pages++;
      totals.found += r.found;
      totals.added += r.added;
      for (const next of morePages(r.otherPages, directoryUrl, known)) {
        known.add(next);
        queue.push(next);
      }
    }
    onProgress(totals.pages + totals.failedPages, known.size, totals.added);
  }
  totals.morePagesLeft = queue.length;
  return { totals, firstError, stopped };
}
