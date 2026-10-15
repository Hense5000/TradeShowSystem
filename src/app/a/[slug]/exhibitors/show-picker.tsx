"use client";

import { useState } from "react";
import { filterByLabel } from "@/lib/show-search";

export type ShowOption = { id: string; label: string };

/** A labelled, required trade show picker for forms, with a search field that narrows the list and picks the first match. */
export function ShowSelect({ shows, defaultValue }: { shows: ShowOption[]; defaultValue?: string }) {
  const [search, setSearch] = useState("");
  const [value, setValue] = useState(defaultValue ?? "");
  const matches = filterByLabel(shows, search);

  function onSearch(text: string) {
    setSearch(text);
    const found = filterByLabel(shows, text);
    if (!text.trim()) return;
    setValue(found.some((s) => s.id === value) ? value : (found[0]?.id ?? ""));
  }

  return (
    <div className="min-w-0">
      <label className="label" htmlFor="tradeShowId">Trade show</label>
      <input
        className="input mb-2"
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        // Enter would send the whole form; here it only means "done searching".
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        placeholder="Search trade shows…"
        aria-label="Search trade shows"
        autoComplete="off"
      />
      <select className="input" id="tradeShowId" name="tradeShowId" value={value} onChange={(e) => setValue(e.target.value)} required>
        <option value="" disabled>
          {matches.length === 0 ? "No trade show matches the search" : "Choose a trade show"}
        </option>
        {matches.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      {search.trim() && matches.length > 1 && (
        <p className="hint">{matches.length} trade shows match; the first is chosen. Open the list to pick another.</p>
      )}
    </div>
  );
}
