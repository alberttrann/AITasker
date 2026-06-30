ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "self_technical_projects" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "elicitation_sessions"
  ADD COLUMN IF NOT EXISTS "handoff_token_jti"          TEXT,
  ADD COLUMN IF NOT EXISTS "handoff_consumed_at"         TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "recommended_archetypes_json" JSONB;