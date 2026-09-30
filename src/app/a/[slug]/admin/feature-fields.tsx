import type { Feature, FeatureRollout } from "@prisma/client";
import { Field } from "@/components/field";
import { ROLLOUT_LABEL } from "@/lib/features";

const ROLLOUT_HINT: Record<FeatureRollout, string> = {
  OFF: "Hidden from every customer. Use this while the feature is being built.",
  SELECTED: "Only the accounts you tick below can see it, for example to try it out.",
  EVERYONE: "Every customer account can see it.",
};

/** The inputs shared by the add and edit forms. */
export function FeatureFields({
  feature,
  accounts,
  selected = [],
}: {
  feature?: Feature;
  accounts: { id: string; name: string; slug: string }[];
  selected?: string[];
}) {
  const current = feature?.rollout ?? "OFF";
  return (
    // The account list only shows while "Selected accounts" is chosen.
    <div className="flex flex-col gap-4 [&:has(input[value=SELECTED]:checked)_.accounts]:block">
      <Field id="name" label="Feature name" defaultValue={feature?.name} required maxLength={80} placeholder="Lead capture" />
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea
          className="input min-h-20"
          id="description"
          name="description"
          defaultValue={feature?.description ?? ""}
          maxLength={500}
          placeholder="What the feature does, in a sentence customers understand."
        />
      </div>

      <fieldset>
        <legend className="label">Who can see it</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["OFF", "SELECTED", "EVERYONE"] as const).map((r) => (
            <label
              key={r}
              className="flex cursor-pointer gap-2.5 rounded-lg border border-line-strong p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <input type="radio" name="rollout" value={r} defaultChecked={current === r} className="mt-0.5 accent-brand" />
              <span>
                <span className="block text-sm font-semibold">{ROLLOUT_LABEL[r]}</span>
                <span className="block text-xs text-muted">{ROLLOUT_HINT[r]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="accounts hidden">
        <legend className="label">Accounts that get it</legend>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted">There are no customer accounts yet.</p>
        ) : (
          <div className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line-strong">
            {accounts.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-subtle">
                <input type="checkbox" name="accounts" value={a.id} defaultChecked={selected.includes(a.id)} className="accent-brand" />
                <span className="font-medium">{a.name}</span>
                <span className="ml-auto text-xs text-faint">/a/{a.slug}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
