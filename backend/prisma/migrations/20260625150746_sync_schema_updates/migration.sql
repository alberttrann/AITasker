/*
  Warnings:

  - Added the required column `client_id` to the `engagements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "engagements" ADD COLUMN     "client_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "engagements_client_id_idx" ON "engagements"("client_id");

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
