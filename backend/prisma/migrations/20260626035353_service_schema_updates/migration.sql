-- AlterTable
ALTER TABLE "services" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "timeline" TEXT;

-- CreateIndex
CREATE INDEX "services_created_at_idx" ON "services"("created_at" DESC);
