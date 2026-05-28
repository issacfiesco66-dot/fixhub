-- Migración manual: seguimiento del trabajo (JobStatus) + token público del lead.
-- Idempotente: segura de ejecutar más de una vez. Aplicada a Neon vía
-- `prisma db execute --url <DATABASE_URL_UNPOOLED>`.

-- 1) Enum JobStatus
DO $$ BEGIN
  CREATE TYPE "JobStatus" AS ENUM ('ASSIGNED','ON_THE_WAY','ARRIVED','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Campos de seguimiento en LeadPurchase
ALTER TABLE "LeadPurchase" ADD COLUMN IF NOT EXISTS "jobStatus" "JobStatus" NOT NULL DEFAULT 'ASSIGNED';
ALTER TABLE "LeadPurchase" ADD COLUMN IF NOT EXISTS "onTheWayAt" TIMESTAMP(3);
ALTER TABLE "LeadPurchase" ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMP(3);
ALTER TABLE "LeadPurchase" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Backfill: compras ya completadas reflejan COMPLETED
UPDATE "LeadPurchase"
   SET "jobStatus" = 'COMPLETED',
       "completedAt" = COALESCE("completedAt", "createdAt")
 WHERE "jobCompleted" = TRUE AND "jobStatus" = 'ASSIGNED';

-- 3) publicToken en Lead (backfill -> NOT NULL -> índice único)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;
UPDATE "Lead" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;
ALTER TABLE "Lead" ALTER COLUMN "publicToken" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_publicToken_key" ON "Lead"("publicToken");
