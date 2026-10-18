-- CreateTable
CREATE TABLE "HiddenShowRecommendation" (
    "organizationId" TEXT NOT NULL,
    "tradeShowId" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenShowRecommendation_pkey" PRIMARY KEY ("organizationId","tradeShowId")
);

-- CreateIndex
CREATE INDEX "HiddenShowRecommendation_tradeShowId_idx" ON "HiddenShowRecommendation"("tradeShowId");

-- AddForeignKey
ALTER TABLE "HiddenShowRecommendation" ADD CONSTRAINT "HiddenShowRecommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenShowRecommendation" ADD CONSTRAINT "HiddenShowRecommendation_tradeShowId_fkey" FOREIGN KEY ("tradeShowId") REFERENCES "TradeShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

