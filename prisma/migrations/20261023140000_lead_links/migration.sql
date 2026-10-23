-- Links to files kept with a favorite exhibitor (quotes, presentations ...)
-- in the customer's own storage, e.g. Google Drive, Dropbox, Box or OneDrive.
CREATE TABLE "LeadLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "exhibitorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadLink_listId_exhibitorId_idx" ON "LeadLink"("listId", "exhibitorId");
CREATE INDEX "LeadLink_organizationId_idx" ON "LeadLink"("organizationId");

ALTER TABLE "LeadLink" ADD CONSTRAINT "LeadLink_listId_exhibitorId_fkey" FOREIGN KEY ("listId", "exhibitorId") REFERENCES "SavedListItem"("listId", "exhibitorId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadLink" ADD CONSTRAINT "LeadLink_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
