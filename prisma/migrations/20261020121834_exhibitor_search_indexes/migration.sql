-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Exhibitor_name_trgm_idx" ON "Exhibitor" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Exhibitor_contactName_trgm_idx" ON "Exhibitor" USING GIN ("contactName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Exhibitor_industry_trgm_idx" ON "Exhibitor" USING GIN ("industry" gin_trgm_ops);
