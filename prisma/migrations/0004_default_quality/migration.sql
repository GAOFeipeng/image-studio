ALTER TABLE "UserProviderSetting" ADD COLUMN "defaultQuality" TEXT;

UPDATE "UserProviderSetting"
SET "defaultQuality" = 'auto'
WHERE "defaultQuality" IS NULL;
