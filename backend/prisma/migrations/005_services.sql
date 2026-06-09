-- =============================================================================
-- Migration 005 — Services: Path B/C Marketplace Listings
-- Tables: services
-- Depends on: 001_identity (users · expert_profiles)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
CREATE TABLE services (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id       UUID    NOT NULL REFERENCES users (id),
    title           TEXT    NOT NULL,
    description     TEXT,
    domains_json    JSONB   NOT NULL DEFAULT '[]',
    seams_json      JSONB   NOT NULL DEFAULT '[]',
    price_vnd       BIGINT  NOT NULL CHECK (price_vnd > 0),
    state           TEXT    NOT NULL DEFAULT 'DRAFT'
                                CHECK (state IN ('DRAFT','PUBLISHED','SUSPENDED')),
    service_type    TEXT    NOT NULL CHECK (service_type IN ('AI_SERVICE','TECH_DISCOVERY'))
);

CREATE INDEX idx_services_expert_id    ON services (expert_id);
CREATE INDEX idx_services_state        ON services (state);
CREATE INDEX idx_services_service_type ON services (service_type);