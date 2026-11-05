-- The nightly update: its switch and last result, and where it got to in a
-- long exhibitor list it has not finished reading.
ALTER TABLE "TradeShow" ADD COLUMN "exhibitorFetchState" JSONB;

CREATE TABLE "NightlyUpdateSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunSummary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NightlyUpdateSettings_pkey" PRIMARY KEY ("id")
);
