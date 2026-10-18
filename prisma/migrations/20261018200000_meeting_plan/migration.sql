-- AlterTable
ALTER TABLE "SavedListItem" ADD COLUMN     "visitedAt" TIMESTAMP(3),
ADD COLUMN     "visitedById" TEXT;

-- AddForeignKey
ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

