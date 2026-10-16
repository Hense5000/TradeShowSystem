-- When "Fetch exhibitors for all shows" last tried a trade show, so shows
-- where no exhibitors could be found are not tried again on every run.
ALTER TABLE "TradeShow" ADD COLUMN "exhibitorsTriedAt" TIMESTAMP(3);
