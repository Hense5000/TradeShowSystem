-- When Hunter.io was last asked for the company's contacts, so each exhibitor
-- uses at most one of the Hunter account's credits.
ALTER TABLE "Exhibitor" ADD COLUMN "hunterTriedAt" TIMESTAMP(3);
