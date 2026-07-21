-- AlterTable
ALTER TABLE "acceptance_criteria" ADD COLUMN     "ceo_verified_at" TIMESTAMPTZ(6),
ADD COLUMN     "revision_requested_by_role" TEXT,
ADD COLUMN     "tech_verified_at" TIMESTAMPTZ(6);
