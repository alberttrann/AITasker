-- =============================================================================
-- Migration 008 — Escrow Accounts & Disputes
-- Tables: escrow_accounts · disputes
-- Depends on: 002_finance (wallets) · 006_engagements_bids (engagements) ·
--             007_milestones (milestones · acceptance_criteria)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- escrow_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE escrow_accounts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id        UUID        REFERENCES milestones (id),
    engagement_id       UUID        REFERENCES engagements (id),
    amount              BIGINT      NOT NULL CHECK (amount > 0),
    client_wallet_id    UUID        NOT NULL REFERENCES wallets (id),
    expert_wallet_id    UUID        NOT NULL REFERENCES wallets (id),
    status              TEXT        NOT NULL DEFAULT 'HELD'
                                        CHECK (status IN ('HELD','RELEASED','FROZEN','REFUNDED','SPLIT')),
    held_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at         TIMESTAMPTZ,

    CONSTRAINT escrow_has_one_parent CHECK (
        (milestone_id IS NOT NULL AND engagement_id IS NULL)
        OR
        (milestone_id IS NULL AND engagement_id IS NOT NULL)
    )
);

-- Partial unique indexes 
CREATE UNIQUE INDEX escrow_milestone_unique
    ON escrow_accounts (milestone_id)
    WHERE milestone_id IS NOT NULL;

CREATE UNIQUE INDEX escrow_engagement_unique
    ON escrow_accounts (engagement_id)
    WHERE engagement_id IS NOT NULL;

CREATE INDEX idx_escrow_accounts_status           ON escrow_accounts (status);
CREATE INDEX idx_escrow_accounts_client_wallet_id ON escrow_accounts (client_wallet_id);
CREATE INDEX idx_escrow_accounts_expert_wallet_id ON escrow_accounts (expert_wallet_id);

-- ---------------------------------------------------------------------------
-- disputes
--
-- Resolution flow:
--   PENDING → LAYER_1_EVAL (auto, immediately after filing)
--   LAYER_1_EVAL → AUTO_RESOLVED (LLM confidence >= 0.80)
--   LAYER_1_EVAL → MANUAL_REVIEW (LLM confidence < 0.80)
--   MANUAL_REVIEW → RESOLVED (admin presses button)
-- ---------------------------------------------------------------------------
CREATE TABLE disputes (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID        NOT NULL REFERENCES engagements (id),
    milestone_id        UUID        REFERENCES milestones (id),
    criterion_id        UUID        NOT NULL REFERENCES acceptance_criteria (id),
    escrow_account_id   UUID        NOT NULL REFERENCES escrow_accounts (id),
    filed_by            UUID        NOT NULL REFERENCES users (id),
    state               TEXT        NOT NULL DEFAULT 'PENDING'
                                        CHECK (state IN (
                                            'PENDING','LAYER_1_EVAL',
                                            'AUTO_RESOLVED','MANUAL_REVIEW','RESOLVED'
                                        )),
    llm_confidence      FLOAT,
    filed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

CREATE INDEX idx_disputes_engagement_id     ON disputes (engagement_id);
CREATE INDEX idx_disputes_state             ON disputes (state);
CREATE INDEX idx_disputes_escrow_account_id ON disputes (escrow_account_id);
CREATE INDEX idx_disputes_manual_review     ON disputes (filed_at DESC)
    WHERE state = 'MANUAL_REVIEW';