import { exportDay } from "@/lib/export-limit";

// The Hunter.io popup asks accounts without their own Hunter.io connection to
// connect one. Each user sees it at most once a day (Danish date), and never
// again after ticking "Don't show this popup again".

/** Today's date in Denmark, e.g. "2026-11-09". */
export const popupDay = (now = new Date()) => exportDay(now);

export function shouldShowHunterPopup({
  hunterConnected,
  hasAccess,
  hidden,
  lastShownDay,
  now = new Date(),
}: {
  hunterConnected: boolean;
  hasAccess: boolean;
  hidden: boolean;
  lastShownDay: string | null;
  now?: Date;
}): boolean {
  if (hunterConnected || !hasAccess || hidden) return false;
  return lastShownDay !== popupDay(now);
}
