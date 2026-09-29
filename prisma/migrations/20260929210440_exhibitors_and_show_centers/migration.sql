-- AlterTable
ALTER TABLE "TradeShow" ADD COLUMN     "centerId" TEXT;

-- CreateTable
CREATE TABLE "Exhibitor" (
    "id" TEXT NOT NULL,
    "tradeShowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "country" TEXT,
    "industry" TEXT,
    "boothNumber" TEXT,
    "standLocationUrl" TEXT,
    "companyProfile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exhibitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exhibitor_tradeShowId_idx" ON "Exhibitor"("tradeShowId");

-- CreateIndex
CREATE INDEX "Exhibitor_name_idx" ON "Exhibitor"("name");

-- CreateIndex
CREATE INDEX "TradeShow_centerId_idx" ON "TradeShow"("centerId");

-- AddForeignKey
ALTER TABLE "TradeShow" ADD CONSTRAINT "TradeShow_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "ExhibitionCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exhibitor" ADD CONSTRAINT "Exhibitor_tradeShowId_fkey" FOREIGN KEY ("tradeShowId") REFERENCES "TradeShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
