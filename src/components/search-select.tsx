"use client";

import { useEffect, useRef, useState } from "react";
import { filterByLabel } from "@/lib/show-search";

export type SelectOption = { id: string; label: string };

/**
 * An optional picker for forms, with a search field that narrows the list
 * and picks the first match. Choosing "Not chosen" leaves the field empty.
 */
export function SearchSelect({
  id,
  label,
  options,
  defaultValue,
  searchPlaceholder,
  hint,
}: {
  id: string;
  label: string;
  options: SelectOption[];
  defaultValue?: string | null;
  searchPlaceholder: string;
  hint?: string;
}) {
  const [search, setSearch] = useState("");
  const [value, setValue] = useState(defaultValue ?? "");
  const select = useRef<HTMLSelectElement>(null);
  const matches = filterByLabel(options, search);
  // Keep the chosen option in the list while searching, so it is not lost.
  const chosen = options.find((o) => o.id === value);
  const shown = chosen && !matches.includes(chosen) ? [chosen, ...matches] : matches;

  // "Undo changes" resets the form, which doesn't reach React's state by itself.
  useEffect(() => {
    const form = select.current?.form;
    if (!form) return;
    const reset = () => {
      setSearch("");
      setValue(defaultValue ?? "");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  function onSearch(text: string) {
    setSearch(text);
    if (!text.trim()) return;
    const found = filterByLabel(options, text);
    if (found.length > 0 && !found.some((o) => o.id === value)) setValue(found[0].id);
  }

  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>{label}</label>
      <input
        className="input mb-2"
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        // Enter would send the whole form; here it only means "done searching".
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder.replace(/…$/, "")}
        autoComplete="off"
      />
      <select ref={select} className="input" id={id} name={id} value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">Not chosen</option>
        {shown.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      {search.trim() && matches.length === 0 ? (
        <p className="hint">Nothing matches the search.</p>
      ) : search.trim() && matches.length > 1 ? (
        <p className="hint">{matches.length} match; the first is chosen. Open the list to pick another.</p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}
