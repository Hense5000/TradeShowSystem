"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { RunState } from "./actions";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** One center in the finder's list: chosen or not, its check day, and a button to check it now. */
export function CenterRow({
  name,
  eventsUrl,
  chosen,
  checkDay,
  status,
  statusIsError,
  canCheck,
  setChosen,
  setCheckDay,
  checkNow,
}: {
  name: string;
  eventsUrl: string | null;
  chosen: boolean;
  checkDay: number | null;
  status: string | null;
  statusIsError: boolean;
  canCheck: boolean;
  setChosen: (chosen: boolean) => Promise<void>;
  setCheckDay: (day: number | null) => Promise<void>;
  checkNow: () => Promise<RunState>;
}) {
  const [saving, startSaving] = useTransition();
  // Show a change at once; the saved value takes over when the page refreshes.
  const [shownChosen, showChosen] = useOptimistic(chosen);
  const [shownDay, showDay] = useOptimistic(checkDay);
  const [checking, startChecking] = useTransition();
  const [result, setResult] = useState<RunState>();
  const disabled = !eventsUrl;

  return (
    <li className={`flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 text-sm ${disabled ? "text-faint" : ""}`}>
      <label className={`flex min-w-0 flex-1 basis-64 items-start gap-2.5 ${disabled ? "" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          checked={shownChosen}
          disabled={disabled || saving}
          onChange={(e) => {
            const value = e.target.checked;
            startSaving(async () => {
              showChosen(value);
              await setChosen(value);
            });
          }}
          className="mt-0.5 accent-brand"
          aria-label={`Check ${name} automatically`}
        />
        <span className="min-w-0">
          <span className="block font-medium">{name}</span>
          <span className="block truncate text-xs text-muted">{eventsUrl ?? "No Local events URL. Add one on the center to check it."}</span>
          {checking ? (
            <span className="mt-0.5 block text-xs text-muted">Checking… this can take a minute or two.</span>
          ) : result?.error ? (
            <span className="mt-0.5 block text-xs text-bad">{result.error}</span>
          ) : status ? (
            <span className={`mt-0.5 block text-xs ${statusIsError ? "text-bad" : "text-muted"}`}>{status}</span>
          ) : null}
        </span>
      </label>
      {!disabled && (
        <div className="flex items-center gap-2">
          <select
            className="input w-auto py-1.5"
            value={shownDay ?? ""}
            disabled={saving || !shownChosen}
            onChange={(e) => {
              const day = e.target.value ? Number(e.target.value) : null;
              startSaving(async () => {
                showDay(day);
                await setCheckDay(day);
              });
            }}
            aria-label={`Day of the month to check ${name}`}
            title={shownChosen ? "Day of the month the automatic check runs" : "Tick the center to check it automatically"}
          >
            <option value="">About monthly</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                Every month on the {ordinal(d)}
              </option>
            ))}
          </select>
          {canCheck && (
            <button
              type="button"
              className="btn-secondary"
              disabled={checking}
              onClick={() =>
                startChecking(async () => {
                  setResult(await checkNow());
                })
              }
            >
              {checking ? "Checking…" : "Check now"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}
