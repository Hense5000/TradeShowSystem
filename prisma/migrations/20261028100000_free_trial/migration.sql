-- 7 day free trial for new accounts, and when its "trial ended" email went out.
ALTER TABLE "Organization" ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "trialEndedEmailAt" TIMESTAMP(3);
