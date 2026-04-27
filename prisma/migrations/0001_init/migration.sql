CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "TurnType" AS ENUM ('GENERATION', 'EDIT');
CREATE TYPE "TurnStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "AssetKind" AS ENUM ('INPUT', 'OUTPUT', 'MASK', 'REFERENCE');
CREATE TYPE "AssetSource" AS ENUM ('UPLOAD', 'GENERATION', 'EDIT');
CREATE TYPE "UsageAction" AS ENUM ('GENERATION', 'EDIT', 'UPLOAD', 'LOGIN', 'REGISTER');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "defaultParams" JSONB,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Turn" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "TurnType" NOT NULL,
  "status" "TurnStatus" NOT NULL DEFAULT 'QUEUED',
  "prompt" TEXT NOT NULL,
  "revisedPrompt" TEXT,
  "params" JSONB NOT NULL,
  "inputAssetIds" JSONB,
  "outputAssetIds" JSONB,
  "maskAssetId" TEXT,
  "parentTurnId" TEXT,
  "retryOfTurnId" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "provider" TEXT NOT NULL,
  "providerModel" TEXT NOT NULL,
  "requestId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "errorStatus" INTEGER,
  "latencyMs" INTEGER,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sessionId" TEXT,
  "kind" "AssetKind" NOT NULL,
  "source" "AssetSource" NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalFilename" TEXT,
  "createdByTurnId" TEXT,
  "parentAssetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" "UsageAction" NOT NULL,
  "status" "TurnStatus",
  "model" TEXT,
  "turnId" TEXT,
  "latencyMs" INTEGER,
  "assetCount" INTEGER,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Session_ownerId_updatedAt_idx" ON "Session"("ownerId", "updatedAt");
CREATE INDEX "Turn_sessionId_createdAt_idx" ON "Turn"("sessionId", "createdAt");
CREATE INDEX "Turn_userId_createdAt_idx" ON "Turn"("userId", "createdAt");
CREATE INDEX "Turn_status_createdAt_idx" ON "Turn"("status", "createdAt");
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");
CREATE INDEX "Asset_ownerId_createdAt_idx" ON "Asset"("ownerId", "createdAt");
CREATE INDEX "Asset_sessionId_createdAt_idx" ON "Asset"("sessionId", "createdAt");
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
