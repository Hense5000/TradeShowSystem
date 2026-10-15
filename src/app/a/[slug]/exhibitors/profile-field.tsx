"use client";

import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import type { ProfileState } from "./actions";

/**
 * The company profile box, with a button that lets AI write the profile from
 * the website typed in the same form. The text can be edited before saving.
 */
export function CompanyProfileField({
  defaultValue,
  generate,
}: {
  defaultValue: string;
  /** Leave out when no AI key is set; the button is then hidden. */
  generate?: (name: string, website: string) => Promise<ProfileState>;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    const form = box.current?.form;
    if (!form || !generate) return;
    const value = (field: string) => String(new FormData(form).get(field) ?? "");
    if (box.current!.value.trim() && !window.confirm("Replace the current company profile with one written by AI?")) return;
    setError(undefined);
    startTransition(async () => {
      const result = await generate(value("name"), value("website"));
      if (result.profile && box.current) box.current.value = result.profile;
      else setError(result.error);
    });
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label className="label mb-0" htmlFor="companyProfile">Company profile</label>
        {generate && (
          <button type="button" className="btn-secondary" onClick={onGenerate} disabled={pending}>
            <Icon name="sparkle" className="size-4 text-brand" />
            {pending ? "Writing… (up to a minute)" : "Generate with AI"}
          </button>
        )}
      </div>
      <textarea
        ref={box}
        className="input min-h-40"
        id="companyProfile"
        name="companyProfile"
        defaultValue={defaultValue}
        maxLength={5000}
        readOnly={pending}
        placeholder="A short description of what the company does."
      />
      <p className="hint">
        {generate ? "AI writes up to 300 words from the company's website. Read it through before you save." : "A short description of what the company does."}
      </p>
      {error && <p className="error mt-2">{error}</p>}
    </div>
  );
}
