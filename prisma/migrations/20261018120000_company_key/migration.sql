-- Same company at several trade shows. The keys are worked out by the app
-- (src/lib/company-run.ts) the first time the Exhibitors page is opened.

-- AlterTable
ALTER TABLE "Exhibitor" ADD COLUMN     "companyKey" TEXT;

-- CreateIndex
CREATE INDEX "Exhibitor_companyKey_idx" ON "Exhibitor"("companyKey");
