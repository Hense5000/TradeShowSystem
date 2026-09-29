-- CreateTable
CREATE TABLE "ExhibitionOrganizer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitionOrganizer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExhibitionOrganizer_name_idx" ON "ExhibitionOrganizer"("name");
