/** Turns a company name into a URL-friendly slug, e.g. "Ærø Messe A/S" -> "aeroe-messe-a-s". */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "account";
}

/** Returns `base`, or `base-2`, `base-3`, ... whichever is not taken. */
export async function uniqueSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  let candidate = base;
  for (let n = 2; await isTaken(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}
