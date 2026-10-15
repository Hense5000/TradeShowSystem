/** Lowercase and without accents, so "messe" finds "Messe" and "Ålborg" is found by "alborg". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** The options whose label holds every word of the search, in any order. An empty search keeps them all. */
export function filterByLabel<T extends { label: string }>(options: T[], search: string): T[] {
  const words = fold(search).split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((o) => {
    const label = fold(o.label);
    return words.every((w) => label.includes(w));
  });
}
