import { type FillResult, fillSummary } from "@/lib/company-profile";
import { type ContactFillResult, contactSummary } from "@/lib/contact-finder";
import { countMissingContacts, countMissingProfiles, findContactBatch, writeProfileBatch } from "./actions";

type Batch = { left: number; stoppedBy?: string };

/**
 * Runs an AI job on a trade show's exhibitors a few at a time, reporting after
 * each batch how many are done out of how many, so the page can show a
 * progress bar. Returns the summed batches, or undefined when none were waiting.
 */
async function runInBatches<T extends Batch>(
  missing: number,
  runBatch: () => Promise<T>,
  doneIn: (batch: T) => number,
  add: (totals: T, batch: T) => void,
  totals: T,
  onProgress: (done: number, total: number) => void,
): Promise<T | undefined> {
  if (missing === 0) return undefined;
  let done = 0;
  let total = missing;
  onProgress(done, total);
  while (totals.left > 0 && !totals.stoppedBy) {
    const batch = await runBatch();
    const batchDone = doneIn(batch);
    add(totals, batch);
    totals.left = batch.left;
    totals.stoppedBy = batch.stoppedBy;
    // Someone else (the nightly run, another import) may do some at the same time.
    done += batchDone;
    total = Math.max(total, done + batch.left);
    onProgress(done, total);
    if (batchDone === 0) break;
  }
  return totals;
}

/** Lets AI write the trade show's missing company profiles. Returns a summary, or undefined when none were missing. */
export async function writeMissingProfiles(
  slug: string,
  tradeShowId: string,
  onProgress: (done: number, total: number) => void,
): Promise<string | undefined> {
  const missing = await countMissingProfiles(slug, tradeShowId);
  const totals = await runInBatches<FillResult>(
    missing,
    () => writeProfileBatch(slug, tradeShowId),
    (b) => b.written + b.noInfo + b.failed,
    (t, b) => {
      t.written += b.written;
      t.noInfo += b.noInfo;
      t.failed += b.failed;
    },
    { written: 0, noInfo: 0, failed: 0, left: missing },
    onProgress,
  );
  return totals && fillSummary(totals);
}

/** Lets AI look up the trade show's missing contact persons on their websites. Returns a summary, or undefined when none were missing. */
export async function findMissingContacts(
  slug: string,
  tradeShowId: string,
  onProgress: (done: number, total: number) => void,
): Promise<string | undefined> {
  const missing = await countMissingContacts(slug, tradeShowId);
  const totals = await runInBatches<ContactFillResult>(
    missing,
    () => findContactBatch(slug, tradeShowId),
    (b) => b.filled + b.noInfo + b.failed,
    (t, b) => {
      t.filled += b.filled;
      t.noInfo += b.noInfo;
      t.failed += b.failed;
      t.fromHunter = (t.fromHunter ?? 0) + (b.fromHunter ?? 0);
      t.hunterStoppedBy = b.hunterStoppedBy ?? t.hunterStoppedBy;
    },
    { filled: 0, noInfo: 0, failed: 0, left: missing },
    onProgress,
  );
  return totals && contactSummary(totals);
}
