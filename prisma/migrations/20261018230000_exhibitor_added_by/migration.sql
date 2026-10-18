-- AlterTable
ALTER TABLE "Exhibitor" ADD COLUMN     "addedByOrganizationId" TEXT;

-- CreateIndex
CREATE INDEX "Exhibitor_addedByOrganizationId_idx" ON "Exhibitor"("addedByOrganizationId");

-- AddForeignKey
ALTER TABLE "Exhibitor" ADD CONSTRAINT "Exhibitor_addedByOrganizationId_fkey" FOREIGN KEY ("addedByOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
