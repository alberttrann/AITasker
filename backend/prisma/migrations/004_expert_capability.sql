-- =============================================================================
-- Migration 004 — Expert Capability: Domain Depths · Seam Claims ·
--                                    Portfolio Submissions
-- Depends on: 001_identity (users · expert_profiles)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- expert_domain_depths
--
-- domain_code:
--   A = LLM Application Engineering
--   B = MLOps / LLMOps
--   C = AI Evaluation & Quality
--   D = Vector DB & Embeddings
--   E = Data & Pipeline Engineering
--   F = ML Modeling & Fine-Tuning
--
-- verification_tier: 
--   CLAIMED        
--   EVIDENCE_BACKED 
-- ---------------------------------------------------------------------------
CREATE TABLE expert_domain_depths (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id           UUID    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    domain_code         TEXT    NOT NULL CHECK (domain_code IN ('A','B','C','D','E','F')),
    depth_level         TEXT    NOT NULL CHECK (depth_level IN ('SURFACE','OPERATIONAL','DEEP')),
    verification_tier   TEXT    NOT NULL DEFAULT 'CLAIMED'
                                    CHECK (verification_tier IN ('CLAIMED','EVIDENCE_BACKED')),
    UNIQUE (expert_id, domain_code)
);

CREATE INDEX idx_expert_domain_depths_expert_id ON expert_domain_depths (expert_id);

-- ---------------------------------------------------------------------------
-- expert_seam_claims
--
-- seam_code maps to §0.2 — the 10 cross-domain competence boundaries:
--   A↔C  LLM output quality contract (most tested seam)
--   A↔F  Fine-tuned model integration contract
--   A↔D  Retrieval-generation contract
--   D↔E  Embedding pipeline contract
--   D↔F  Model-vector alignment contract
--   C↔F  Evaluation-model feedback loop
--   E↔F  Training data pipeline contract
--   A↔B  Deployment-inference contract
--   B↔E  Monitoring-pipeline contract
--   C↔E  Ground-truth pipeline contract
-- ---------------------------------------------------------------------------
CREATE TABLE expert_seam_claims (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    seam_code           TEXT        NOT NULL CHECK (seam_code IN (
                            'A↔C', 'A↔F', 'A↔D', 'D↔E', 'D↔F',
                            'C↔F', 'E↔F', 'A↔B', 'B↔E', 'C↔E'
                        )),
    verification_tier   TEXT        NOT NULL DEFAULT 'CLAIMED'
                                        CHECK (verification_tier IN ('CLAIMED','EVIDENCE_BACKED')),
    submission_count    INT         NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    UNIQUE (expert_id, seam_code)
);

CREATE INDEX idx_expert_seam_claims_expert_id ON expert_seam_claims (expert_id);

-- ---------------------------------------------------------------------------
-- portfolio_submissions
-- ---------------------------------------------------------------------------
CREATE TABLE portfolio_submissions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id           UUID        NOT NULL REFERENCES users (id),
    seam_claim_id       UUID        NOT NULL REFERENCES expert_seam_claims (id),
    project_description TEXT        NOT NULL,
    decision_points     TEXT        NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'PENDING'
                                        CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    llm_confidence      FLOAT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evaluated_at        TIMESTAMPTZ
);

CREATE INDEX idx_portfolio_submissions_expert_id      ON portfolio_submissions (expert_id);
CREATE INDEX idx_portfolio_submissions_seam_claim_id  ON portfolio_submissions (seam_claim_id);