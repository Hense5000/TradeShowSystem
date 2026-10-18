-- Favorites page: lead status and notes on favorite exhibitors, and favorite trade shows.

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'MEETING', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "SavedListItem" ADD COLUMN     "leadNote" TEXT,
ADD COLUMN     "leadStatus" "LeadStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "leadUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FavoriteShow" (
    "organizationId" TEXT NOT NULL,
    "tradeShowId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT,

    CONSTRAINT "FavoriteShow_pkey" PRIMARY KEY ("organizationId","tradeShowId")
);

-- CreateIndex
CREATE INDEX "FavoriteShow_tradeShowId_idx" ON "FavoriteShow"("tradeShowId");

-- AddForeignKey
ALTER TABLE "FavoriteShow" ADD CONSTRAINT "FavoriteShow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteShow" ADD CONSTRAINT "FavoriteShow_tradeShowId_fkey" FOREIGN KEY ("tradeShowId") REFERENCES "TradeShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteShow" ADD CONSTRAINT "FavoriteShow_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

