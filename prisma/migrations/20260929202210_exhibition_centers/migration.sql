-- CreateTable
CREATE TABLE "ExhibitionCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "website" TEXT,
    "eventsUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitionCenter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExhibitionCenter_name_idx" ON "ExhibitionCenter"("name");
