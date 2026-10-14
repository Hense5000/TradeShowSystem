-- AlterTable
ALTER TABLE "ExhibitionCenter" ADD COLUMN     "showsGroupId" TEXT;

-- CreateTable
CREATE TABLE "ShowFinderGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checkDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowFinderGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowFinderGroup_name_key" ON "ShowFinderGroup"("name");

-- CreateIndex
CREATE INDEX "ExhibitionCenter_showsGroupId_idx" ON "ExhibitionCenter"("showsGroupId");

-- AddForeignKey
ALTER TABLE "ExhibitionCenter" ADD CONSTRAINT "ExhibitionCenter_showsGroupId_fkey" FOREIGN KEY ("showsGroupId") REFERENCES "ShowFinderGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
