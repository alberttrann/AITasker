CREATE TABLE "project_shortlist_cache" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "project_id"    UUID        NOT NULL,
  -- Full MatchResult[] JSON — includes composite_score (server-only, never sent to FE).
  -- Shape: [{ expert_id, composite_score, strength_label, gap_map: [{seam_code, color}] }]
  "results_json"  JSONB       NOT NULL DEFAULT '[]',
  "generated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "source"        TEXT        NOT NULL DEFAULT 'AUTO',  -- 'AUTO' | 'FORCE_REFRESH'

  CONSTRAINT "project_shortlist_cache_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_shortlist_cache_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
);

-- One active cache row per project. Upsert on project_id.
CREATE UNIQUE INDEX "project_shortlist_cache_project_id_key"
  ON "project_shortlist_cache" ("project_id");

-- Fast lookup by project
CREATE INDEX "project_shortlist_cache_project_id_idx"
  ON "project_shortlist_cache" ("project_id");