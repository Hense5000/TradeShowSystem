-- CreateTable
CREATE TABLE "TradeShowCleanupSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "lastRunDeleted" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeShowCleanupSettings_pkey" PRIMARY KEY ("id")
);
