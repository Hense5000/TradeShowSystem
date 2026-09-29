-- CreateTable
CREATE TABLE "TradeShow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "website" TEXT,
    "exhibitorDirectoryUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeShow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeShow_startDate_idx" ON "TradeShow"("startDate");

-- CreateIndex
CREATE INDEX "TradeShow_name_idx" ON "TradeShow"("name");
