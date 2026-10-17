-- Saved lists: each account's own lists of exhibitors, including its Favorites.

-- CreateTable
CREATE TABLE "SavedList" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "favorites" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListItem" (
    "listId" TEXT NOT NULL,
    "exhibitorId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedListItem_pkey" PRIMARY KEY ("listId","exhibitorId")
);

-- CreateIndex
CREATE INDEX "SavedList_organizationId_idx" ON "SavedList"("organizationId");

-- CreateIndex
CREATE INDEX "SavedListItem_exhibitorId_idx" ON "SavedListItem"("exhibitorId");

-- AddForeignKey
ALTER TABLE "SavedList" ADD CONSTRAINT "SavedList_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SavedList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListItem" ADD CONSTRAINT "SavedListItem_exhibitorId_fkey" FOREIGN KEY ("exhibitorId") REFERENCES "Exhibitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one Favorites list per account (Prisma cannot express partial indexes).
CREATE UNIQUE INDEX "SavedList_one_favorites_per_organization" ON "SavedList"("organizationId") WHERE "favorites";
