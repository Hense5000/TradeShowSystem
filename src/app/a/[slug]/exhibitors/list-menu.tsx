"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";

export type ListChoice = { id: string; name: string; inList: boolean };

/** A row's "Lists" button: a small menu to put the exhibitor on, or take it off, the account's saved lists. */
export function ListMenu({
  action,
  lists,
  newListHref,
}: {
  action: (formData: FormData) => Promise<void>;
  lists: ListChoice[];
  newListHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const count = lists.filter((l) => l.inList).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`btn-secondary ${count > 0 ? "border-brand text-brand" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title="Save to one of your lists"
      >
        <Icon name="bookmark" className="size-4" filled={count > 0} />
        {count > 0 ? count : "Save"}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1.5 w-64 rounded-xl border border-line bg-surface p-1.5 text-left shadow-lg">
          <p className="px-2.5 pt-1.5 pb-1 text-[0.68rem] font-semibold tracking-widest text-faint uppercase">Your lists</p>
          {lists.length === 0 && <p className="px-2.5 py-1.5 text-sm text-muted">You have no lists yet.</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
              const formData = new FormData(e.currentTarget, submitter);
              startTransition(() => action(formData));
            }}
          >
            <fieldset disabled={pending} className="flex max-h-64 flex-col overflow-y-auto">
              {lists.map((l) => (
                <button
                  key={l.id}
                  name="change"
                  value={`${l.inList ? "remove" : "add"}:${l.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-subtle disabled:opacity-50"
                >
                  <span
                    className={`grid size-4 shrink-0 place-items-center rounded border ${l.inList ? "border-brand bg-brand text-white" : "border-line-strong"}`}
                  >
                    {l.inList && <Icon name="check" className="size-3" />}
                  </span>
                  <span className="truncate">{l.name}</span>
                </button>
              ))}
            </fieldset>
          </form>
          <Link href={newListHref} className="mt-1 flex items-center gap-2 border-t border-line px-2.5 pt-2.5 pb-1.5 text-sm font-semibold text-brand hover:underline">
            <Icon name="plus" className="size-4" /> New list
          </Link>
        </div>
      )}
    </div>
  );
}
