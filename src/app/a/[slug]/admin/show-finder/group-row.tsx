"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { ActionForm, type ActionState } from "@/components/action-form";
import type { RunState } from "./actions";
import { DaySelect } from "./day-select";
import { RunButton } from "./run-button";

/** One check group: its name, check day, a button to check it now, and rename and delete. */
export function GroupRow({
  name,
  centers,
  ticked,
  checkDay,
  href,
  canCheck,
  setCheckDay,
  checkNow,
  rename,
  remove,
}: {
  name: string;
  centers: number;
  ticked: number;
  checkDay: number | null;
  href: string;
  canCheck: boolean;
  setCheckDay: (day: number | null) => Promise<void>;
  checkNow: () => Promise<RunState>;
  rename: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  remove: () => Promise<ActionState>;
}) {
  const [saving, startSaving] = useTransition();
  const [shownDay, showDay] = useOptimistic(checkDay);
  const [renaming, setRenaming] = useState(false);

  return (
    <li className="flex flex-col gap-3 px-5 py-4 text-sm">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <Link href={href} className="font-semibold hover:text-brand hover:underline">
            {name}
          </Link>
          <p className="text-xs text-muted">
            {centers === 0
              ? "No centers yet. Pick this group on a center in the list below."
              : `${centers} ${centers === 1 ? "center" : "centers"}${ticked < centers ? `, ${ticked} ticked` : ""}. `}
            {centers > 0 && (
              <Link href={href} className="font-medium text-brand hover:underline">
                Show them
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DaySelect
            value={shownDay}
            disabled={saving}
            label={`Day of the month to check ${name}`}
            title="Day of the month the automatic check runs for every center in the group"
            onChange={(day) =>
              startSaving(async () => {
                showDay(day);
                await setCheckDay(day);
              })
            }
          />
          <button type="button" className="btn-secondary" onClick={() => setRenaming((r) => !r)}>
            Rename
          </button>
          <ActionForm action={remove} confirmMessage={`Delete the group ${name}? Its centers stay chosen, just without a group.`}>
            <button className="btn-danger">Delete</button>
          </ActionForm>
        </div>
      </div>
      {renaming && (
        <ActionForm
          action={async (prev, formData) => {
            const result = await rename(prev, formData);
            if (!result?.error) setRenaming(false);
            return result;
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input className="input max-w-xs" name="name" defaultValue={name} required maxLength={60} aria-label="New group name" autoFocus />
          <button className="btn">Save name</button>
          <button type="button" className="btn-secondary" onClick={() => setRenaming(false)}>
            Cancel
          </button>
        </ActionForm>
      )}
      {canCheck && ticked > 0 && <RunButton action={checkNow} label={`Check ${name} now`} secondary />}
    </li>
  );
}
