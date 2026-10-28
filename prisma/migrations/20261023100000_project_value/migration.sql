-- The currency each account shows project values in.
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD', 'GBP');
ALTER TABLE "Organization" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'EUR';

-- What the project with a favorite exhibitor is worth.
ALTER TABLE "SavedListItem" ADD COLUMN "projectValue" INTEGER;
