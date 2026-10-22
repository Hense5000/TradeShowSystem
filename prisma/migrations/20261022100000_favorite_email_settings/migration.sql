-- Each part of the daily Favorites email can be turned on or off per user.
ALTER TABLE "User" ADD COLUMN "emailExhibitorChanges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "emailShowChanges" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "emailFollowUps" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "emailSuggestions" BOOLEAN NOT NULL DEFAULT true;

-- The favorite trade show's details as the daily email last reported them.
ALTER TABLE "FavoriteShow" ADD COLUMN "snapshot" JSONB;
