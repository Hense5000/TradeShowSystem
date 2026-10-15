-- When the AI last looked for a contact person on the company's website, so
-- exhibitors whose website lists no one are not tried again on every run.
ALTER TABLE "Exhibitor" ADD COLUMN "contactTriedAt" TIMESTAMP(3);
