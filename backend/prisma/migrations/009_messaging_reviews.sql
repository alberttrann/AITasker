-- =============================================================================
-- Migration 009 — Messaging · Reviews · Platform Decision Audit Log
-- Tables: messages · message_reads · reviews · platform_decisions
-- Depends on: 001_identity (users) · 006_engagements_bids (engagements)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
CREATE TABLE messages (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id   UUID        NOT NULL REFERENCES engagements (id),
    sender_id       UUID        NOT NULL REFERENCES users (id),
    content         TEXT        NOT NULL,
    attachment_url  TEXT,
    "timestamp"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_engagement_id ON messages (engagement_id, "timestamp" ASC);
CREATE INDEX idx_messages_sender_id     ON messages (sender_id);

-- ---------------------------------------------------------------------------
-- message_reads
-- ---------------------------------------------------------------------------
CREATE TABLE message_reads (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID        NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users (id),
    read_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (message_id, user_id)
);

CREATE INDEX idx_message_reads_message_id ON message_reads (message_id);
CREATE INDEX idx_message_reads_user_id    ON message_reads (user_id);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id           UUID    NOT NULL REFERENCES engagements (id),
    reviewer_id             UUID    NOT NULL REFERENCES users (id),
    target_id               UUID    NOT NULL REFERENCES users (id),
    rating                  INT     NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment                 TEXT,
    structured_signals_json JSONB,
    reviewer_role           TEXT    NOT NULL
                                        CHECK (reviewer_role IN ('CEO','TECH_TEAM','EXPERT')),

    UNIQUE (engagement_id, reviewer_id)
);

CREATE INDEX idx_reviews_engagement_id ON reviews (engagement_id);
CREATE INDEX idx_reviews_reviewer_id   ON reviews (reviewer_id);
CREATE INDEX idx_reviews_target_id     ON reviews (target_id);

-- ---------------------------------------------------------------------------
-- platform_decisions
-- ---------------------------------------------------------------------------
CREATE TABLE platform_decisions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_type   TEXT        NOT NULL CHECK (decision_type IN (
                        'ELICITATION_SYNTHESIS',
                        'SPEC_AUTO_RETURN',
                        'SEAM_TIER_UPGRADE',
                        'PORTFOLIO_EVAL',
                        'DISPUTE_L1_EVAL',
                        'CRITERION_QUALITY_GATE'
                    )),
    entity_type     TEXT,
    entity_id       TEXT,
    llm_confidence  FLOAT,
    decision        TEXT,
    advisory_note   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_decisions_type        ON platform_decisions (decision_type);
CREATE INDEX idx_platform_decisions_created_at  ON platform_decisions (created_at DESC);
CREATE INDEX idx_platform_decisions_entity      ON platform_decisions (entity_type, entity_id)
    WHERE entity_id IS NOT NULL;