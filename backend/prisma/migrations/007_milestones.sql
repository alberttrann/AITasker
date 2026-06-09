-- =============================================================================
-- Migration 007 — Milestone Execution Layer
-- Tables: milestones · acceptance_criteria · milestone_dod_items ·
--         milestone_submissions · paygated_documents
-- Depends on: 006_engagements_bids (engagements) · 001_identity (users)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------------------
CREATE TABLE milestones (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id           UUID        NOT NULL REFERENCES engagements (id),
    milestone_number        INT         NOT NULL,
    deliverable_statement   TEXT,
    sign_off_authority      TEXT        NOT NULL
                                            CHECK (sign_off_authority IN ('TECH_TEAM','CEO','JOINT')),
    payment_amount_vnd      BIGINT      NOT NULL CHECK (payment_amount_vnd > 0),
    state                   TEXT        NOT NULL DEFAULT 'DEFINED'
                                            CHECK (state IN (
                                                'DEFINED','AWAITING_PAYMENT','FUNDED',
                                                'IN_PROGRESS','SUBMITTED','IN_REVISION',
                                                'APPROVED','RELEASED','DISPUTED'
                                            )),
    va_number               TEXT,
    va_expires_at           TIMESTAMPTZ,
    funded_at               TIMESTAMPTZ,
    submitted_at            TIMESTAMPTZ,
    approved_at             TIMESTAMPTZ,
    released_at             TIMESTAMPTZ,

    UNIQUE (engagement_id, milestone_number)
);

CREATE INDEX idx_milestones_engagement_id ON milestones (engagement_id);
CREATE INDEX idx_milestones_state         ON milestones (state);

-- ---------------------------------------------------------------------------
-- acceptance_criteria
-- ---------------------------------------------------------------------------
CREATE TABLE acceptance_criteria (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id        UUID        NOT NULL REFERENCES milestones (id) ON DELETE CASCADE,
    criterion_text      TEXT        NOT NULL,
    is_required         BOOLEAN     NOT NULL DEFAULT TRUE,
    verified_by_role    TEXT        NOT NULL
                                        CHECK (verified_by_role IN ('TECH_TEAM','CEO','JOINT')),
    verified_at         TIMESTAMPTZ,
    revision_note       TEXT
);

CREATE INDEX idx_acceptance_criteria_milestone_id ON acceptance_criteria (milestone_id);
CREATE INDEX idx_acceptance_criteria_verified      ON acceptance_criteria (milestone_id, is_required, verified_at)
    WHERE verified_at IS NULL;

-- ---------------------------------------------------------------------------
-- milestone_dod_items
-- ---------------------------------------------------------------------------
CREATE TABLE milestone_dod_items (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id            UUID        NOT NULL REFERENCES milestones (id) ON DELETE CASCADE,
    item_description        TEXT        NOT NULL,
    is_required             BOOLEAN     NOT NULL DEFAULT TRUE,
    status                  TEXT        NOT NULL DEFAULT 'PENDING'
                                            CHECK (status IN ('PENDING','COMPLETED','NOT_APPLICABLE')),
    completed_at            TIMESTAMPTZ,
    completion_note         TEXT,
    not_applicable_note     TEXT,
    maps_to_criterion_id    UUID        REFERENCES acceptance_criteria (id),

    CONSTRAINT dod_required_cannot_be_na
        CHECK (NOT (is_required = TRUE AND status = 'NOT_APPLICABLE'))
);

CREATE INDEX idx_milestone_dod_items_milestone_id ON milestone_dod_items (milestone_id);
-- Partial index for the DoD gate query — only un-completed required items
CREATE INDEX idx_milestone_dod_gate ON milestone_dod_items (milestone_id)
    WHERE is_required = TRUE AND status != 'COMPLETED';

-- ---------------------------------------------------------------------------
-- milestone_submissions
-- ---------------------------------------------------------------------------
CREATE TABLE milestone_submissions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id    UUID        NOT NULL REFERENCES milestones (id),
    expert_id       UUID        NOT NULL REFERENCES users (id),
    description     TEXT,
    files_json      JSONB       NOT NULL DEFAULT '[]',
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_milestone_submissions_milestone_id ON milestone_submissions (milestone_id);
CREATE INDEX idx_milestone_submissions_expert_id    ON milestone_submissions (expert_id);

-- ---------------------------------------------------------------------------
-- paygated_documents
-- ---------------------------------------------------------------------------
CREATE TABLE paygated_documents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id    UUID        NOT NULL REFERENCES milestones (id),
    document_url    TEXT        NOT NULL,
    release_state   TEXT        NOT NULL DEFAULT 'STAGED'
                                    CHECK (release_state IN ('STAGED','RELEASED')),
    staged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at     TIMESTAMPTZ
);

CREATE INDEX idx_paygated_documents_milestone_id    ON paygated_documents (milestone_id);
CREATE INDEX idx_paygated_documents_release_state   ON paygated_documents (milestone_id, release_state);