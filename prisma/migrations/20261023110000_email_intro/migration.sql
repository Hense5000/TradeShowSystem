-- What the account offers and up to 3 benefits, used in the standard first email to an exhibitor.
ALTER TABLE "Organization" ADD COLUMN "emailOffer" TEXT;
ALTER TABLE "Organization" ADD COLUMN "emailBenefits" TEXT[] DEFAULT ARRAY[]::TEXT[];
