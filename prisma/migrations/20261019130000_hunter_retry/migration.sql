-- Hunter.io's person used to be dropped when the exhibitor already had a
-- general address such as info@. Let exhibitors without a contact person be
-- asked again, now that the person and their own email are kept.
UPDATE "Exhibitor" SET "hunterTriedAt" = NULL WHERE "contactName" IS NULL AND "hunterTriedAt" IS NOT NULL;
