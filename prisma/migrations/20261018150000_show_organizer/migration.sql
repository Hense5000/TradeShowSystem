-- AlterTable
ALTER TABLE "TradeShow" ADD COLUMN     "organizerId" TEXT,
ADD COLUMN     "organizerTriedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TradeShow_organizerId_idx" ON "TradeShow"("organizerId");

-- AddForeignKey
ALTER TABLE "TradeShow" ADD CONSTRAINT "TradeShow_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "ExhibitionOrganizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
