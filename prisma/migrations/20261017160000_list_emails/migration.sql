-- Daily email about what is new on saved lists.

-- AlterTable
ALTER TABLE "SavedListItem" ADD COLUMN     "addedById" TEXT,
ADD COLUMN     "snapshot" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "listEmails" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Exhibitors already on a list count as reported, so the first email only
-- tells about what changes from now on. Keys match DIGEST_FIELDS in src/lib/list-digest.ts.
UPDATE "SavedListItem" i SET "snapshot" = jsonb_build_object(
  'name', e."name",
  'contactName', e."contactName",
  'contactTitle', e."contactTitle",
  'email', e."email",
  'phone', e."phone",
  'website', e."website",
  'country', e."country",
  'industry', e."industry",
  'boothNumber', e."boothNumber",
  'standLocationUrl', e."standLocationUrl",
  'companyProfile', e."companyProfile"
)
FROM "Exhibitor" e WHERE e."id" = i."exhibitorId";
