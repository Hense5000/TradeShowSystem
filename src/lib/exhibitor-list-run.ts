import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { type ExhibitorFilters, exhibitorSql } from "@/lib/exhibitor-list";

/**
 * One page of the companies the filters match, A to Z by name, with how many
 * companies and trade show entries match in all. Grouped and paged in the
 * database, so the time stays short with hundreds of thousands of exhibitors.
 */
export async function companyPage(filters: ExhibitorFilters, page: number, size: number) {
  const where = exhibitorSql(filters);
  // The trade show is only joined when a filter is on it.
  const join = filters.showCountry || filters.showCity || filters.from || filters.to ? Prisma.sql`JOIN "TradeShow" t ON t."id" = e."tradeShowId"` : Prisma.empty;
  const [keys, counts] = await Promise.all([
    db.$queryRaw<{ key: string }[]>`
      SELECT e."companyKey" AS key FROM "Exhibitor" e ${join}
      WHERE e."companyKey" IS NOT NULL AND ${where}
      GROUP BY e."companyKey"
      ORDER BY MIN(e."name"), e."companyKey"
      LIMIT ${size} OFFSET ${(page - 1) * size}`,
    db.$queryRaw<{ companies: number; rows: number }[]>`
      SELECT COUNT(DISTINCT e."companyKey")::int AS companies, COUNT(*)::int AS rows FROM "Exhibitor" e ${join}
      WHERE ${where}`,
  ]);
  return { keys: keys.map((k) => k.key), companies: counts[0]?.companies ?? 0, rows: counts[0]?.rows ?? 0 };
}
