-- The 3 ad spaces on the dashboard.
CREATE TABLE "DashboardAd" (
    "slot" INTEGER NOT NULL,
    "image" BYTEA NOT NULL,
    "imageType" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL,
    "name" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardAd_pkey" PRIMARY KEY ("slot")
);
