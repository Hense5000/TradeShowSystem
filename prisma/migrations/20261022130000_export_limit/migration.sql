-- The Stripe Price each subscription is on, to tell the basic plan from the upgraded one.
ALTER TABLE "Subscription" ADD COLUMN "priceId" TEXT;

-- The trade shows each user downloaded exhibitors from, per day.
CREATE TABLE "ExportedShow" (
    "userId" TEXT NOT NULL,
    "tradeShowId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportedShow_pkey" PRIMARY KEY ("userId","day","tradeShowId")
);

CREATE INDEX "ExportedShow_tradeShowId_idx" ON "ExportedShow"("tradeShowId");

ALTER TABLE "ExportedShow" ADD CONSTRAINT "ExportedShow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExportedShow" ADD CONSTRAINT "ExportedShow_tradeShowId_fkey" FOREIGN KEY ("tradeShowId") REFERENCES "TradeShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
