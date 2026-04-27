CREATE TABLE "UserProviderSetting" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT,
  "apiBaseUrl" TEXT,
  "generationPath" TEXT,
  "editPath" TEXT,
  "apiKey" TEXT,
  "defaultModel" TEXT,
  "defaultSize" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProviderSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProviderSetting_userId_key" ON "UserProviderSetting"("userId");

ALTER TABLE "UserProviderSetting"
ADD CONSTRAINT "UserProviderSetting_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserProviderSetting" (
  "id",
  "userId",
  "provider",
  "apiBaseUrl",
  "generationPath",
  "editPath",
  "apiKey",
  "defaultModel",
  "defaultSize",
  "createdAt",
  "updatedAt"
)
SELECT
  'ups_' || "User"."id",
  "User"."id",
  (SELECT "value" FROM "AppSetting" WHERE "key" = 'image.provider'),
  (SELECT "value" FROM "AppSetting" WHERE "key" = 'image.apiBaseUrl'),
  (SELECT "value" FROM "AppSetting" WHERE "key" = 'image.generationPath'),
  (SELECT "value" FROM "AppSetting" WHERE "key" = 'image.editPath'),
  (SELECT "value" FROM "AppSetting" WHERE "key" = 'image.apiKey'),
  (SELECT "value" FROM "AppSetting" WHERE "key" = 'image.defaultModel'),
  (SELECT "value" FROM "AppSetting" WHERE "key" = 'image.defaultSize'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
WHERE
  "User"."role" = 'ADMIN'
  AND EXISTS (SELECT 1 FROM "AppSetting" WHERE "key" = 'image.apiKey' AND "value" IS NOT NULL)
ON CONFLICT ("userId") DO NOTHING;
