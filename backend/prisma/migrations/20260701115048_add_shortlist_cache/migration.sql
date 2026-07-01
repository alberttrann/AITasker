-- DropForeignKey
ALTER TABLE "project_shortlist_cache" DROP CONSTRAINT "project_shortlist_cache_project_id_fkey";

-- DropIndex
DROP INDEX "project_shortlist_cache_project_id_idx";

-- AddForeignKey
ALTER TABLE "project_shortlist_cache" ADD CONSTRAINT "project_shortlist_cache_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
