-- The user responsible for each favorite lead.

-- AlterTable
ALTER TABLE "SavedListItem" ADD COLUMN     "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "SavedListItem_assigneeId_idx" ON "SavedListItem"("assigneeId");

-- AddForeignKey
ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

