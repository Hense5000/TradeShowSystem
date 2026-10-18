-- Follow-up reminders on favorite exhibitors.

-- AlterTable
ALTER TABLE "SavedListItem" ADD COLUMN     "followUpAt" DATE,
ADD COLUMN     "followUpNote" TEXT;

