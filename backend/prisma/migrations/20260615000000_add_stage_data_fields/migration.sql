-- Add stage payload columns to elicitation_sessions.
-- Required by Stage 5 synthesis to assemble Stage5Request from persisted stage data.
-- Applied directly to Neon on 2026-06-15 via console SQL.

ALTER TABLE "elicitation_sessions"
  ADD COLUMN IF NOT EXISTS "stage1_symptoms_json"     JSONB,
  ADD COLUMN IF NOT EXISTS "stage3_probes_json"       JSONB,
  ADD COLUMN IF NOT EXISTS "stage4_tech_inputs_json"  JSONB;
