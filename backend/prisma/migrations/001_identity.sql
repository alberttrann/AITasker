-- =============================================================================
-- Migration 001 — Identity & Role Subtypes
-- Tables: users · client_profiles · expert_profiles · tech_team_profiles
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email                       TEXT        NOT NULL UNIQUE,
    password_hash               TEXT        NOT NULL,
    full_name                   TEXT        NOT NULL,
    phone                       TEXT,
    roles                       JSONB       NOT NULL DEFAULT '[]',
    active_role                 TEXT        NOT NULL DEFAULT 'CLIENT'
                                    CHECK (active_role IN ('CLIENT', 'EXPERT', 'ADMIN')),
    client_subtype              TEXT
                                    CHECK (client_subtype IN ('CEO', 'TECH_TEAM')),
    subscription_client_tier    TEXT        NOT NULL DEFAULT 'free'
                                    CHECK (subscription_client_tier IN ('free', 'pro')),
    subscription_expert_tier    TEXT        NOT NULL DEFAULT 'free'
                                    CHECK (subscription_expert_tier IN ('free', 'pro')),
    sub_client_expires_at       TIMESTAMPTZ,
    sub_expert_expires_at       TIMESTAMPTZ,
    sepay_bank_account_xid      TEXT,
    bank_account_holder_name    TEXT,
    bank_linked_at              TIMESTAMPTZ,
    self_technical              BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active                   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email        ON users (email);
CREATE INDEX idx_users_active_role  ON users (active_role);

-- ---------------------------------------------------------------------------
-- client_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE client_profiles (
    user_id         UUID    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    company_name    TEXT,
    industry        TEXT,
    ceo_name        TEXT
);

-- ---------------------------------------------------------------------------
-- expert_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE expert_profiles (
    user_id                 UUID    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    bio                     TEXT,
    engagement_model        TEXT    CHECK (engagement_model IN ('MILESTONE', 'HOURLY', 'HYBRID')),
    stack_tags_json         JSONB   NOT NULL DEFAULT '[]',
    archetype_history_json  JSONB   NOT NULL DEFAULT '[]'
);

-- ---------------------------------------------------------------------------
-- tech_team_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE tech_team_profiles (
    user_id             UUID    PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    linked_client_id    UUID    NOT NULL REFERENCES users (id),
    linked_project_id   UUID,   -- FK constraint added in migration 003
    role_title          TEXT
);