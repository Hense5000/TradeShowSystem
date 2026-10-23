-- Files kept with a favorite exhibitor (quotes, presentations ...). The files
-- themselves are in the private Vercel Blob store.
CREATE TABLE "LeadFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "exhibitorId" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadFile_pathname_key" ON "LeadFile"("pathname");
CREATE INDEX "LeadFile_listId_exhibitorId_idx" ON "LeadFile"("listId", "exhibitorId");
CREATE INDEX "LeadFile_organizationId_idx" ON "LeadFile"("organizationId");

ALTER TABLE "LeadFile" ADD CONSTRAINT "LeadFile_listId_exhibitorId_fkey" FOREIGN KEY ("listId", "exhibitorId") REFERENCES "SavedListItem"("listId", "exhibitorId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadFile" ADD CONSTRAINT "LeadFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
