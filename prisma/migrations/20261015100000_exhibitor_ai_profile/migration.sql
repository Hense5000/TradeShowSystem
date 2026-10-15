-- When the AI last tried to write the company profile, so exhibitors whose
-- website gave nothing are not tried again on every run.
ALTER TABLE "Exhibitor" ADD COLUMN "profileTriedAt" TIMESTAMP(3);
