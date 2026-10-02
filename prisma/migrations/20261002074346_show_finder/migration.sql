-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ExhibitionCenter" ADD COLUMN     "findShows" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showsCheckError" TEXT,
ADD COLUMN     "showsCheckedAt" TIMESTAMP(3),
ADD COLUMN     "showsFoundLast" INTEGER;

-- CreateTable
CREATE TABLE "ShowFinderSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "lastRunSummary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowFinderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedShow" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "website" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "tradeShowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SuggestedShow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuggestedShow_status_idx" ON "SuggestedShow"("status");

-- CreateIndex
CREATE INDEX "SuggestedShow_centerId_idx" ON "SuggestedShow"("centerId");

-- AddForeignKey
ALTER TABLE "SuggestedShow" ADD CONSTRAINT "SuggestedShow_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "ExhibitionCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedShow" ADD CONSTRAINT "SuggestedShow_tradeShowId_fkey" FOREIGN KEY ("tradeShowId") REFERENCES "TradeShow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
