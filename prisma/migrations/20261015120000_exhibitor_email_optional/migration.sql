-- Exhibitor directories on trade show websites rarely show email addresses,
-- so an exhibitor can now be saved without one.
ALTER TABLE "Exhibitor" ALTER COLUMN "email" DROP NOT NULL;
