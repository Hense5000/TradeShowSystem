import "server-only";
import { db } from "@/lib/db";

export type FavoriteRow = { id: string; tradeShowId: string; companyKey: string | null };

/**
 * The exhibitor rows of the companies on the account's Favorites list, at
 * every trade show they exhibit at (or only at these shows). A favorite is
 * the company's row at one show, its latest, but the company belongs on the
 * meeting plan and in the counts of each of its shows.
 */
export async function favoriteRowsAt(organizationId: string, showIds?: string[]): Promise<FavoriteRow[]> {
  if (showIds && showIds.length === 0) return [];
  const all = showIds === undefined;
  return db.$queryRaw<FavoriteRow[]>`
    WITH fav AS (
      SELECT f."id", f."companyKey" FROM "SavedListItem" i
      JOIN "SavedList" l ON l."id" = i."listId"
      JOIN "Exhibitor" f ON f."id" = i."exhibitorId"
      WHERE l."organizationId" = ${organizationId} AND l."favorites"
    )
    SELECT e."id", e."tradeShowId", e."companyKey" FROM "Exhibitor" e
    WHERE (${all} OR e."tradeShowId" = ANY(${showIds ?? []}::text[]))
      AND (e."id" IN (SELECT "id" FROM fav) OR e."companyKey" IN (SELECT "companyKey" FROM fav WHERE "companyKey" IS NOT NULL))`;
}

/** How many favorite companies exhibit at each trade show. */
export function countByShow(rows: FavoriteRow[]): Map<string, number> {
  const keys = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = keys.get(r.tradeShowId) ?? new Set<string>();
    set.add(r.companyKey ?? r.id);
    keys.set(r.tradeShowId, set);
  }
  return new Map([...keys].map(([show, set]) => [show, set.size]));
}
