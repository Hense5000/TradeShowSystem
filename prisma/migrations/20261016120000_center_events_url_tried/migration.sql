-- When AI last looked for an exhibition center's events page, so centers
-- without one are not searched again on every run.
ALTER TABLE "ExhibitionCenter" ADD COLUMN "eventsUrlTriedAt" TIMESTAMP(3);
