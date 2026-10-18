import { companyKeys } from "@/lib/company";
import { db } from "@/lib/db";

const UPDATE_CHUNK = 5000;

/**
 * Works out the company key of every exhibitor when any is missing: new
 * exhibitors, and ones whose name or website changed, have none. All rows are
 * worked out again, since a new website can also join other rows of the same name.
 */
export async function syncCompanyKeys(): Promise<void> {
  if (!(await db.exhibitor.findFirst({ where: { companyKey: null }, select: { id: true } }))) return;

  const rows = await db.exhibitor.findMany({ select: { id: true, name: true, website: true, companyKey: true } });
  const keys = companyKeys(rows);
  const changed = rows.filter((r) => keys.get(r.id) !== r.companyKey);

  for (let i = 0; i < changed.length; i += UPDATE_CHUNK) {
    const part = changed.slice(i, i + UPDATE_CHUNK);
    const ids = part.map((r) => r.id);
    const values = part.map((r) => keys.get(r.id)!);
    await db.$executeRaw`
      UPDATE "Exhibitor" AS e SET "companyKey" = v.key
      FROM (SELECT unnest(${ids}::text[]) AS id, unnest(${values}::text[]) AS key) AS v
      WHERE e."id" = v.id`;
  }
}
