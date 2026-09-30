-- isActive was never used by the app. Features now start OFF (hidden) and a
-- platform admin switches them on from the super admin page.
-- CreateEnum
CREATE TYPE "FeatureRollout" AS ENUM ('OFF', 'SELECTED', 'EVERYONE');

-- AlterTable
ALTER TABLE "Feature" DROP COLUMN "isActive",
ADD COLUMN     "rollout" "FeatureRollout" NOT NULL DEFAULT 'OFF';

-- CreateTable
CREATE TABLE "FeatureAccess" (
    "featureId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureAccess_pkey" PRIMARY KEY ("featureId","organizationId")
);

-- CreateIndex
CREATE INDEX "FeatureAccess_organizationId_idx" ON "FeatureAccess"("organizationId");

-- AddForeignKey
ALTER TABLE "FeatureAccess" ADD CONSTRAINT "FeatureAccess_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureAccess" ADD CONSTRAINT "FeatureAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
