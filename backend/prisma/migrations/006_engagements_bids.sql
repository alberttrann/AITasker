-- =============================================================================
-- Migration 006 — Engagements & Capability Bids
-- Tables: engagements · capability_bids
-- Depends on: 001_identity (users) · 003_elicitation_projects (projects) ·
--             005_services (services)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- engagements
-- ---------------------------------------------------------------------------
CREATE TABLE engagements (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID        REFERENCES projects (id),
    expert_id               UUID        NOT NULL REFERENCES users (id),
    service_id              UUID        REFERENCES services (id),
    type                    TEXT        NOT NULL CHECK (type IN ('PROJECT_BASED','SERVICE_PURCHASE','TECH_DISCOVERY')),
    state                   TEXT        NOT NULL DEFAULT 'PENDING'
                                            CHECK (state IN ('PENDING','CONNECTED','ACTIVE','CLOSED','DISPUTED')),
    connected_at            TIMESTAMPTZ,
    client_nda_accepted_at  TIMESTAMPTZ,
    expert_nda_accepted_at  TIMESTAMPTZ,

    CONSTRAINT engagement_type_fk CHECK (
        (type = 'PROJECT_BASED'
            AND project_id IS NOT NULL
            AND service_id IS NULL)
        OR
        (type IN ('SERVICE_PURCHASE','TECH_DISCOVERY')
            AND project_id IS NULL
            AND service_id IS NOT NULL)
    )
);

CREATE INDEX idx_engagements_project_id ON engagements (project_id);
CREATE INDEX idx_engagements_expert_id  ON engagements (expert_id);
CREATE INDEX idx_engagements_service_id ON engagements (service_id);
CREATE INDEX idx_engagements_state      ON engagements (state);

-- ---------------------------------------------------------------------------
-- capability_bids
-- ---------------------------------------------------------------------------
CREATE TABLE capability_bids (
    id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id               UUID    NOT NULL UNIQUE REFERENCES engagements (id),
    footprint_alignment_json    JSONB,
    approach_summary            TEXT,
    conditional_pricing_json    JSONB,
    state                       TEXT    NOT NULL DEFAULT 'DRAFT'
                                            CHECK (state IN (
                                                'DRAFT','SUBMITTED','TECH_REVIEW',
                                                'REVISION_REQUESTED','TECH_APPROVED',
                                                'CEO_REVIEW','SELECTED','DECLINED'
                                            )),
    tech_status                 TEXT    NOT NULL DEFAULT 'PENDING'
                                            CHECK (tech_status IN ('PENDING','APPROVED','REVISION_REQUESTED')),
    ceo_status                  TEXT    NOT NULL DEFAULT 'PENDING'
                                            CHECK (ceo_status IN ('PENDING','APPROVED','DECLINED')),
    tech_feedback               TEXT,
    negotiated_price_vnd        BIGINT,
    version_number              INT     NOT NULL DEFAULT 1
);

CREATE INDEX idx_capability_bids_engagement_id ON capability_bids (engagement_id);
CREATE INDEX idx_capability_bids_tech_status   ON capability_bids (tech_status);
CREATE INDEX idx_capability_bids_ceo_status    ON capability_bids (ceo_status);