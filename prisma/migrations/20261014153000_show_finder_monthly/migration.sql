-- Every chosen center is now checked from the 1st of each month, so the
-- per-center and per-group check days are no longer used.
ALTER TABLE "ExhibitionCenter" DROP COLUMN "showsCheckDay";
ALTER TABLE "ShowFinderGroup" DROP COLUMN "checkDay";
