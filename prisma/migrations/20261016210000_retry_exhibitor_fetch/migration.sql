-- The first runs of "Fetch exhibitors for all" marked shows as tried even
-- when the lookup failed, so let it try every show again.
UPDATE "TradeShow" SET "exhibitorsTriedAt" = NULL;
