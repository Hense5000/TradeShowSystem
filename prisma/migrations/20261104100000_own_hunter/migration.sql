-- The account's own Hunter.io key (encrypted), and the contacts it found with
-- it, which only that account sees.
CREATE TABLE "HunterConnection" (
    "organizationId" TEXT NOT NULL,
    "keyCipher" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HunterConnection_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "OwnContact" (
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "foundById" TEXT,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnContact_pkey" PRIMARY KEY ("organizationId","domain")
);

ALTER TABLE "HunterConnection" ADD CONSTRAINT "HunterConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HunterConnection" ADD CONSTRAINT "HunterConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OwnContact" ADD CONSTRAINT "OwnContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnContact" ADD CONSTRAINT "OwnContact_foundById_fkey" FOREIGN KEY ("foundById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
