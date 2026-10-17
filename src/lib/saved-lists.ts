export const FAVORITES_NAME = "Favorites";
export const MAX_LIST_NAME = 80;
// "Save all shown to a list" adds at most this many exhibitors at once.
export const MAX_ADD_AT_ONCE = 5000;

/** The trimmed list name, or an error message when it can't be used. */
export function checkListName(value: unknown, taken: string[]): { name: string; error?: undefined } | { error: string } {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) return { error: "Give the list a name." };
  if (name.length > MAX_LIST_NAME) return { error: `Keep the name under ${MAX_LIST_NAME} characters.` };
  const key = name.toLowerCase();
  if (key === FAVORITES_NAME.toLowerCase()) return { error: `${FAVORITES_NAME} is already one of your lists.` };
  if (taken.some((t) => t.toLowerCase() === key)) return { error: `You already have a list called ${name}.` };
  return { name };
}
