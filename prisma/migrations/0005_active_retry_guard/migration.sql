CREATE UNIQUE INDEX "Turn_active_retry_unique"
ON "Turn"("retryOfTurnId")
WHERE "retryOfTurnId" IS NOT NULL AND "status" IN ('QUEUED', 'PROCESSING');
