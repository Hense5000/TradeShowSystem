"use client";

/** A small message box over the page, closed with ×, Close or a click outside it. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className="px-1 text-2xl leading-none text-muted hover:text-ink" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
