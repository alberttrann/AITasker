-- =============================================================================
-- Migration 003 — Elicitation Engine & Projects
-- Tables: elicitation_sessions · projects
-- =============================================================================

-- ---------------------------------------------------------------------------
-- elicitation_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE elicitation_sessions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users (id),
    current_stage   INT         NOT NULL DEFAULT 1,
    archetype       TEXT        CHECK (archetype IN ('1','2','3','4','5','6')),
    scenario_type   TEXT        CHECK (scenario_type IN ('STANDARD','SCENARIO_A','SCENARIO_B')),
    void_list_json  JSONB       NOT NULL DEFAULT '[]',
    state           TEXT        NOT NULL DEFAULT 'IN_PROGRESS'
                                    CHECK (state IN ('IN_PROGRESS','COMPLETED','ABANDONED','RETURNED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_elicitation_sessions_user_id ON elicitation_sessions (user_id);
CREATE INDEX idx_elicitation_sessions_state   ON elicitation_sessions (state);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                   UUID        NOT NULL REFERENCES users (id),
    elicitation_session_id      UUID        UNIQUE REFERENCES elicitation_sessions (id),
    state                       TEXT        NOT NULL DEFAULT 'PUBLISHED'
                                                CHECK (state IN ('DRAFT','PUBLISHED','RETURNED_TO_CLIENT','SUSPENDED')),
    archetype                   TEXT        CHECK (archetype IN ('1','2','3','4','5','6')),
    tier                        TEXT        CHECK (tier IN ('TIER_1','TIER_2','TIER_3')),
    self_technical              BOOLEAN     NOT NULL DEFAULT FALSE,
    required_seams_json         JSONB       NOT NULL DEFAULT '[]',
    required_domains_json       JSONB       NOT NULL DEFAULT '[]',
    milestone_framework_json    JSONB       NOT NULL DEFAULT '[]',
    artifact_a_json             JSONB,
    artifact_b_json             JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_client_id ON projects (client_id);
CREATE INDEX idx_projects_state     ON projects (state);


ALTER TABLE tech_team_profiles
    ADD CONSTRAINT fk_tech_team_profiles_project
    FOREIGN KEY (linked_project_id)
    REFERENCES projects (id);

CREATE INDEX idx_tech_team_profiles_project ON tech_team_profiles (linked_project_id);