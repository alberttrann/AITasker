ALTER TABLE "elicitation_sessions"
  ADD COLUMN IF NOT EXISTS "symptom_text_draft" TEXT NULL;