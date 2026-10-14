"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { RunState } from "./actions";
import { DaySelect } from "./day-select";

/**
 * One center in the finder's list: chosen or not, its check group or day, a
 * button to check it now, and one to take it off the finder again.
 */
export function CenterRow({
  name,
  eventsUrl,
  chosen,
  checkDay,
  groupId,
  groups,
  status,
  statusIsError,
  canCheck,
  setChosen,
  setCheckDay,
  setGroup,
  checkNow,
  remove,
}: {
  name: string;
  eventsUrl: string | null;
  chosen: boolean;
  checkDay: number | null;
  groupId: string | null;
  groups: { id: string; name: string }[];
  status: string | null;
  statusIsError: boolean;
  canCheck: boolean;
  setChosen: (chosen: boolean) => Promise<void>;
  setCheckDay: (day: number | null) => Promise<void>;
  setGroup: (groupId: string | null) => Promise<void>;
  checkNow: () => Promise<RunState>;
  remove: () => Promise<void>;
}) {
  const [saving, startSaving] = useTransition();
  // Show a change at once; the saved value takes over when the page refreshes.
  const [shownChosen, showChosen] = useOptimistic(chosen);
  const [shownDay, showDay] = useOptimistic(checkDay);
  const [shownGroup, showGroup] = useOptimistic(groupId);
  const [checking, startChecking] = useTransition();
  const [result, setResult] = useState<RunState>();
  const disabled = !eventsUrl;
  // Anything to remove: the center is chosen, or has a check day or result.
  const canRemove = shownChosen || shownDay !== null || shownGroup !== null || Boolean(status);

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
        <div className="flex flex-wrap items-center gap-2">
          {groups.length > 0 && (
            <select
              className="input w-auto py-1.5"
              value={shownGroup ?? ""}
              disabled={saving}
              onChange={(e) => {
                const id = e.target.value || null;
                startSaving(async () => {
                  showGroup(id);
                  if (id) showChosen(true);
                  await setGroup(id);
                });
              }}
              aria-label={`Check group for ${name}`}
              title="The group's check day applies to the center"
            >
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          {!shownGroup && (
            <DaySelect
              value={shownDay}
              disabled={saving || !shownChosen}
              label={`Day of the month to check ${name}`}
              title={shownChosen ? "Day of the month the automatic check runs" : "Tick the center to check it automatically"}
              onChange={(day) =>
                startSaving(async () => {
                  showDay(day);
                  await setCheckDay(day);
                })
              }
            />
          )}
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
          {canRemove && (
            <button
              type="button"
              className="btn-danger"
              disabled={saving || checking}
              onClick={() => {
                if (!window.confirm(`Remove ${name} from the AI trade show finder? It will no longer be checked, and its check day and last result are cleared. Suggestions already made are kept.`)) return;
                startSaving(async () => {
                  showChosen(false);
                  showDay(null);
                  showGroup(null);
                  setResult(undefined);
                  await remove();
                });
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </li>
  );
}
