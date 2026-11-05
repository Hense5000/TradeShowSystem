-- The update runs once a week; this notes when the week's work was all done.
ALTER TABLE "NightlyUpdateSettings" ADD COLUMN "weekDoneAt" TIMESTAMP(3);
