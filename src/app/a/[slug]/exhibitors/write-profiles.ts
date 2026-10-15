import { type FillResult, fillSummary } from "@/lib/company-profile";
import { countMissingProfiles, writeProfileBatch } from "./actions";

/**
 * Lets AI write the trade show's missing company profiles a few at a time,
 * reporting after each batch how many are done out of how many, so the page
 * can show a progress bar. Returns a summary, or undefined when none were missing.
 */
export async function writeMissingProfiles(
  slug: string,
  tradeShowId: string,
  onProgress: (done: number, total: number) => void,
): Promise<string | undefined> {
  const missing = await countMissingProfiles(slug, tradeShowId);
  if (missing === 0) return undefined;
  let done = 0;
  let total = missing;
  onProgress(done, total);
  const totals: FillResult = { written: 0, noInfo: 0, failed: 0, left: missing };
  while (totals.left > 0 && !totals.stoppedBy) {
    const batch = await writeProfileBatch(slug, tradeShowId);
    const batchDone = batch.written + batch.noInfo + batch.failed;
    totals.written += batch.written;
    totals.noInfo += batch.noInfo;
    totals.failed += batch.failed;
    totals.left = batch.left;
    totals.stoppedBy = batch.stoppedBy;
    // Someone else (the nightly run, another import) may write some at the same time.
    done += batchDone;
    total = Math.max(total, done + batch.left);
    onProgress(done, total);
    if (batchDone === 0) break;
  }
  return fillSummary(totals);
}
