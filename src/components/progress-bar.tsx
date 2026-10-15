/** A bar with a percent, for long jobs such as an import that run while the page stays open. */
export function ProgressBar({ label, percent, ariaLabel }: { label: string; percent: number; ariaLabel: string }) {
  return (
    <div className="rounded-lg bg-subtle px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-bold text-brand tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">Keep this page open until it is done.</p>
    </div>
  );
}
