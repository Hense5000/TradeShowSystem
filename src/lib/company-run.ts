import { Prisma } from "@prisma/client";
import { companyKeys } from "@/lib/company";
import { db } from "@/lib/db";

const UPDATE_CHUNK = 5000;

/**
 * Works out the company key of every exhibitor when any is missing: new
 * exhibitors, and ones whose name or website changed, have none. All rows are
 * worked out again, since a new website can also join other rows of the same name.
 * Rows that joined a company then get its details from other years, and the
 * company's favorites move to its latest trade show.
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
  // Only once every key is in place, so each row sees all of its company's rows.
  for (let i = 0; i < changed.length; i += UPDATE_CHUNK) {
    await inheritCompanyDetails(changed.slice(i, i + UPDATE_CHUNK).map((r) => r.id));
  }
  await moveFavoritesToLatestShow([...new Set(changed.map((r) => keys.get(r.id)!))]);
}

// Facts about the company itself, the same at every show. Booth and floor plan
// are not, so they are never copied.
const COMPANY_FIELDS = ["companyProfile", "industry", "website", "country"] as const;

/**
 * Fills the empty fields of these rows from the company's rows at other trade
 * shows, the latest show first: the company's profile, industry, website and
 * country, and the contact person found earlier. So a company imported again
 * for next year's show keeps what is known about it, and AI and Hunter.io do
 * not look it up again. Nothing that is already filled in is changed.
 */
export async function inheritCompanyDetails(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (const field of COMPANY_FIELDS) {
    const f = Prisma.raw(`"${field}"`);
    await db.$executeRaw`
      UPDATE "Exhibitor" AS e SET ${f} = (
        SELECT s.${f} FROM "Exhibitor" s JOIN "TradeShow" t ON t."id" = s."tradeShowId"
        WHERE s."companyKey" = e."companyKey" AND s."id" <> e."id" AND COALESCE(s.${f}, '') <> ''
        ORDER BY t."startDate" DESC, s."id" LIMIT 1
      )
      WHERE e."id" = ANY(${ids}::text[]) AND COALESCE(e.${f}, '') = '' AND e."companyKey" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "Exhibitor" s WHERE s."companyKey" = e."companyKey" AND s."id" <> e."id" AND COALESCE(s.${f}, '') <> '')`;
  }
  // A profile that was copied counts as written, like one the AI wrote.
  await db.$executeRaw`
    UPDATE "Exhibitor" SET "profileTriedAt" = now()
    WHERE "id" = ANY(${ids}::text[]) AND "profileTriedAt" IS NULL AND COALESCE("companyProfile", '') <> ''`;

  // The contact person is copied as a whole (name, position and email
  // together), from the latest show that has one, when the row has no person.
  // An email of its own, e.g. info@, gives way to the person's email.
  await db.$executeRaw`
    WITH src AS (
      SELECT DISTINCT ON (e."id") e."id" AS target, s."contactName", s."contactTitle", s."email", s."phone",
        s."contactTriedAt", s."hunterTriedAt"
      FROM "Exhibitor" e
      JOIN "Exhibitor" s ON s."companyKey" = e."companyKey" AND s."id" <> e."id"
      JOIN "TradeShow" t ON t."id" = s."tradeShowId"
      WHERE e."id" = ANY(${ids}::text[]) AND e."contactName" IS NULL
        AND (s."contactName" IS NOT NULL OR (e."email" IS NULL AND s."email" IS NOT NULL))
      ORDER BY e."id", (s."contactName" IS NULL), t."startDate" DESC, s."id"
    )
    UPDATE "Exhibitor" AS e SET
      "contactName" = src."contactName",
      "contactTitle" = CASE WHEN src."contactName" IS NOT NULL THEN src."contactTitle" ELSE e."contactTitle" END,
      "email" = COALESCE(src."email", e."email"),
      "phone" = COALESCE(e."phone", src."phone"),
      "contactTriedAt" = COALESCE(e."contactTriedAt", src."contactTriedAt"),
      "hunterTriedAt" = COALESCE(e."hunterTriedAt", src."hunterTriedAt")
    FROM src WHERE e."id" = src.target`;

  // Hunter.io costs a credit per company, so it is not asked again for a
  // company it was already asked about at another show.
  await db.$executeRaw`
    UPDATE "Exhibitor" AS e SET "hunterTriedAt" = (
      SELECT MAX(s."hunterTriedAt") FROM "Exhibitor" s WHERE s."companyKey" = e."companyKey" AND s."id" <> e."id"
    )
    WHERE e."id" = ANY(${ids}::text[]) AND e."hunterTriedAt" IS NULL
      AND EXISTS (SELECT 1 FROM "Exhibitor" s WHERE s."companyKey" = e."companyKey" AND s."id" <> e."id" AND s."hunterTriedAt" IS NOT NULL)`;
}

/**
 * A favorite company follows the company: when it turns up at a later trade
 * show, the account's favorite moves to that show's row, with its lead
 * status, notes, follow-up and responsible user. Booth visits stay with the
 * show they were made at.
 */
export async function moveFavoritesToLatestShow(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.$executeRaw`
    WITH latest AS (
      SELECT DISTINCT ON (e."companyKey") e."companyKey" AS key, e."id", t."startDate"
      FROM "Exhibitor" e JOIN "TradeShow" t ON t."id" = e."tradeShowId"
      WHERE e."companyKey" = ANY(${keys}::text[])
      ORDER BY e."companyKey", t."startDate" DESC, e."id"
    ),
    moves AS (
      SELECT DISTINCT ON (i."listId", l."id") i."listId", i."exhibitorId" AS "fromId", l."id" AS "toId"
      FROM "SavedListItem" i
      JOIN "SavedList" sl ON sl."id" = i."listId" AND sl."favorites"
      JOIN "Exhibitor" cur ON cur."id" = i."exhibitorId"
      JOIN "TradeShow" ct ON ct."id" = cur."tradeShowId"
      JOIN latest l ON l.key = cur."companyKey" AND l."startDate" > ct."startDate"
      WHERE NOT EXISTS (SELECT 1 FROM "SavedListItem" x WHERE x."listId" = i."listId" AND x."exhibitorId" = l."id")
      ORDER BY i."listId", l."id", ct."startDate" DESC
    )
    UPDATE "SavedListItem" AS i SET "exhibitorId" = m."toId"
    FROM moves m WHERE i."listId" = m."listId" AND i."exhibitorId" = m."fromId"`;
}
