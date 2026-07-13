/*
  Warnings:

  - A unique constraint covering the columns `[domain_code_1,domain_code_2]` on the table `seam_definitions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `domain_code_1` to the `seam_definitions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `domain_code_2` to the `seam_definitions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "seam_definitions" ADD COLUMN     "domain_code_1" TEXT NOT NULL,
ADD COLUMN     "domain_code_2" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "seam_definitions_domain_code_1_idx" ON "seam_definitions"("domain_code_1");

-- CreateIndex
CREATE INDEX "seam_definitions_domain_code_2_idx" ON "seam_definitions"("domain_code_2");

-- CreateIndex
CREATE UNIQUE INDEX "seam_definitions_domain_code_1_domain_code_2_key" ON "seam_definitions"("domain_code_1", "domain_code_2");

-- AddForeignKey
ALTER TABLE "seam_definitions" ADD CONSTRAINT "seam_definitions_domain_code_1_fkey" FOREIGN KEY ("domain_code_1") REFERENCES "domain_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seam_definitions" ADD CONSTRAINT "seam_definitions_domain_code_2_fkey" FOREIGN KEY ("domain_code_2") REFERENCES "domain_definitions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
