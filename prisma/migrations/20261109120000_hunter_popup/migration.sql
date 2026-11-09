-- The Hunter.io popup: the day it was last shown, and "Don't show this popup again".
ALTER TABLE "User" ADD COLUMN "hunterPopupDay" TEXT,
ADD COLUMN "hideHunterPopup" BOOLEAN NOT NULL DEFAULT false;
