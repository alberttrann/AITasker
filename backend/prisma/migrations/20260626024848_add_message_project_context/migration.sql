-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_engagement_id_fkey";

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "project_id" UUID,
ALTER COLUMN "engagement_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Custom CHECK constraint per AITasker Blueprint
ALTER TABLE "messages"
ADD CONSTRAINT message_has_one_context
CHECK (("engagement_id" IS NOT NULL) != ("project_id" IS NOT NULL));
