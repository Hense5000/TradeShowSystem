-- Booth visits on the meeting plan are kept per trade show, since a favorite
-- company is now on the plan of every show it exhibits at.
CREATE TABLE "BoothVisit" (
    "organizationId" TEXT NOT NULL,
    "exhibitorId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitedById" TEXT,

    CONSTRAINT "BoothVisit_pkey" PRIMARY KEY ("organizationId","exhibitorId")
);

CREATE INDEX "BoothVisit_exhibitorId_idx" ON "BoothVisit"("exhibitorId");

ALTER TABLE "BoothVisit" ADD CONSTRAINT "BoothVisit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoothVisit" ADD CONSTRAINT "BoothVisit_exhibitorId_fkey" FOREIGN KEY ("exhibitorId") REFERENCES "Exhibitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoothVisit" ADD CONSTRAINT "BoothVisit_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The ticks made so far move over.
INSERT INTO "BoothVisit" ("organizationId", "exhibitorId", "visitedAt", "visitedById")
SELECT l."organizationId", i."exhibitorId", i."visitedAt", i."visitedById"
FROM "SavedListItem" i JOIN "SavedList" l ON l."id" = i."listId"
WHERE l."favorites" AND i."visitedAt" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "SavedListItem" DROP CONSTRAINT "SavedListItem_visitedById_fkey";
ALTER TABLE "SavedListItem" DROP COLUMN "visitedAt",
DROP COLUMN "visitedById";

-- Every company key is worked out again on the next page view, so the rows
-- already imported also get their company's details from earlier years, and
-- favorites move to the company's latest trade show (see src/lib/company-run.ts).
UPDATE "Exhibitor" SET "companyKey" = NULL;
