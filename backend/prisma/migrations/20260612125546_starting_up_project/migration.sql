-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "roles" JSONB NOT NULL DEFAULT '[]',
    "active_role" TEXT NOT NULL DEFAULT 'CLIENT',
    "client_subtype" TEXT,
    "subscription_client_tier" TEXT NOT NULL DEFAULT 'free',
    "subscription_expert_tier" TEXT NOT NULL DEFAULT 'free',
    "sub_client_expires_at" TIMESTAMPTZ(6),
    "sub_expert_expires_at" TIMESTAMPTZ(6),
    "sepay_bank_account_xid" TEXT,
    "bank_account_holder_name" TEXT,
    "bank_linked_at" TIMESTAMPTZ(6),
    "self_technical" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "user_id" UUID NOT NULL,
    "company_name" TEXT,
    "industry" TEXT,
    "ceo_name" TEXT,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "expert_profiles" (
    "user_id" UUID NOT NULL,
    "bio" TEXT,
    "engagement_model" TEXT,
    "stack_tags_json" JSONB NOT NULL DEFAULT '[]',
    "archetype_history_json" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "expert_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "tech_team_profiles" (
    "user_id" UUID NOT NULL,
    "linked_client_id" UUID NOT NULL,
    "linked_project_id" UUID,
    "role_title" TEXT,

    CONSTRAINT "tech_team_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "available_balance" BIGINT NOT NULL DEFAULT 0,
    "locked_balance" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "reference_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "virtual_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "va_number" TEXT NOT NULL,
    "fixed_amount" BIGINT,
    "expires_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "virtual_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expert_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "bank_account_xid" TEXT NOT NULL,
    "disbursement_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform_wallet_id" UUID,
    "platform_fee_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elicitation_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "current_stage" INTEGER NOT NULL DEFAULT 1,
    "archetype" TEXT,
    "scenario_type" TEXT,
    "void_list_json" JSONB NOT NULL DEFAULT '[]',
    "state" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elicitation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "elicitation_session_id" UUID,
    "state" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "archetype" TEXT,
    "tier" TEXT,
    "self_technical" BOOLEAN NOT NULL DEFAULT false,
    "required_seams_json" JSONB NOT NULL DEFAULT '[]',
    "required_domains_json" JSONB NOT NULL DEFAULT '[]',
    "milestone_framework_json" JSONB NOT NULL DEFAULT '[]',
    "artifact_a_json" JSONB,
    "artifact_b_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_domain_depths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expert_id" UUID NOT NULL,
    "domain_code" TEXT NOT NULL,
    "depth_level" TEXT NOT NULL,
    "verification_tier" TEXT NOT NULL DEFAULT 'CLAIMED',

    CONSTRAINT "expert_domain_depths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_seam_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expert_id" UUID NOT NULL,
    "seam_code" TEXT NOT NULL,
    "verification_tier" TEXT NOT NULL DEFAULT 'CLAIMED',
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),

    CONSTRAINT "expert_seam_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expert_id" UUID NOT NULL,
    "seam_claim_id" UUID NOT NULL,
    "project_description" TEXT NOT NULL,
    "decision_points" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "llm_confidence" DOUBLE PRECISION,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluated_at" TIMESTAMPTZ(6),

    CONSTRAINT "portfolio_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expert_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "domains_json" JSONB NOT NULL DEFAULT '[]',
    "seams_json" JSONB NOT NULL DEFAULT '[]',
    "price_vnd" BIGINT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "service_type" TEXT NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID,
    "expert_id" UUID NOT NULL,
    "service_id" UUID,
    "type" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "connected_at" TIMESTAMPTZ(6),
    "client_nda_accepted_at" TIMESTAMPTZ(6),
    "expert_nda_accepted_at" TIMESTAMPTZ(6),

    CONSTRAINT "engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_bids" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "footprint_alignment_json" JSONB,
    "approach_summary" TEXT,
    "conditional_pricing_json" JSONB,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "tech_status" TEXT NOT NULL DEFAULT 'PENDING',
    "ceo_status" TEXT NOT NULL DEFAULT 'PENDING',
    "tech_feedback" TEXT,
    "negotiated_price_vnd" BIGINT,
    "version_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "capability_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "milestone_number" INTEGER NOT NULL,
    "deliverable_statement" TEXT,
    "sign_off_authority" TEXT NOT NULL,
    "payment_amount_vnd" BIGINT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DEFINED',
    "va_number" TEXT,
    "va_expires_at" TIMESTAMPTZ(6),
    "funded_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "milestone_id" UUID NOT NULL,
    "criterion_text" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "verified_by_role" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "revision_note" TEXT,

    CONSTRAINT "acceptance_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_dod_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "milestone_id" UUID NOT NULL,
    "item_description" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ(6),
    "completion_note" TEXT,
    "not_applicable_note" TEXT,
    "maps_to_criterion_id" UUID,

    CONSTRAINT "milestone_dod_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "milestone_id" UUID NOT NULL,
    "expert_id" UUID NOT NULL,
    "description" TEXT,
    "files_json" JSONB NOT NULL DEFAULT '[]',
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paygated_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "milestone_id" UUID NOT NULL,
    "document_url" TEXT NOT NULL,
    "release_state" TEXT NOT NULL DEFAULT 'STAGED',
    "staged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),

    CONSTRAINT "paygated_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "milestone_id" UUID,
    "engagement_id" UUID,
    "amount" BIGINT NOT NULL,
    "client_wallet_id" UUID NOT NULL,
    "expert_wallet_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "held_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),

    CONSTRAINT "escrow_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "milestone_id" UUID,
    "criterion_id" UUID NOT NULL,
    "escrow_account_id" UUID NOT NULL,
    "filed_by" UUID NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "llm_confidence" DOUBLE PRECISION,
    "filed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "attachment_url" TEXT,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "engagement_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "structured_signals_json" JSONB,
    "reviewer_role" TEXT NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "llm_confidence" DOUBLE PRECISION,
    "decision" TEXT,
    "advisory_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_active_role_idx" ON "users"("active_role");

-- CreateIndex
CREATE INDEX "tech_team_profiles_linked_project_id_idx" ON "tech_team_profiles"("linked_project_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_transaction_type_idx" ON "wallet_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "virtual_accounts_va_number_key" ON "virtual_accounts"("va_number");

-- CreateIndex
CREATE INDEX "virtual_accounts_entity_type_entity_id_idx" ON "virtual_accounts"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "virtual_accounts_status_idx" ON "virtual_accounts"("status");

-- CreateIndex
CREATE INDEX "withdrawal_requests_expert_id_idx" ON "withdrawal_requests"("expert_id");

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_idx" ON "withdrawal_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_platform_wallet_id_key" ON "platform_settings"("platform_wallet_id");

-- CreateIndex
CREATE INDEX "elicitation_sessions_user_id_idx" ON "elicitation_sessions"("user_id");

-- CreateIndex
CREATE INDEX "elicitation_sessions_state_idx" ON "elicitation_sessions"("state");

-- CreateIndex
CREATE UNIQUE INDEX "projects_elicitation_session_id_key" ON "projects"("elicitation_session_id");

-- CreateIndex
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

-- CreateIndex
CREATE INDEX "projects_state_idx" ON "projects"("state");

-- CreateIndex
CREATE INDEX "expert_domain_depths_expert_id_idx" ON "expert_domain_depths"("expert_id");

-- CreateIndex
CREATE UNIQUE INDEX "expert_domain_depths_expert_id_domain_code_key" ON "expert_domain_depths"("expert_id", "domain_code");

-- CreateIndex
CREATE INDEX "expert_seam_claims_expert_id_idx" ON "expert_seam_claims"("expert_id");

-- CreateIndex
CREATE UNIQUE INDEX "expert_seam_claims_expert_id_seam_code_key" ON "expert_seam_claims"("expert_id", "seam_code");

-- CreateIndex
CREATE INDEX "portfolio_submissions_expert_id_idx" ON "portfolio_submissions"("expert_id");

-- CreateIndex
CREATE INDEX "portfolio_submissions_seam_claim_id_idx" ON "portfolio_submissions"("seam_claim_id");

-- CreateIndex
CREATE INDEX "services_expert_id_idx" ON "services"("expert_id");

-- CreateIndex
CREATE INDEX "services_state_idx" ON "services"("state");

-- CreateIndex
CREATE INDEX "services_service_type_idx" ON "services"("service_type");

-- CreateIndex
CREATE INDEX "engagements_project_id_idx" ON "engagements"("project_id");

-- CreateIndex
CREATE INDEX "engagements_expert_id_idx" ON "engagements"("expert_id");

-- CreateIndex
CREATE INDEX "engagements_service_id_idx" ON "engagements"("service_id");

-- CreateIndex
CREATE INDEX "engagements_state_idx" ON "engagements"("state");

-- CreateIndex
CREATE UNIQUE INDEX "capability_bids_engagement_id_key" ON "capability_bids"("engagement_id");

-- CreateIndex
CREATE INDEX "capability_bids_tech_status_idx" ON "capability_bids"("tech_status");

-- CreateIndex
CREATE INDEX "capability_bids_ceo_status_idx" ON "capability_bids"("ceo_status");

-- CreateIndex
CREATE INDEX "milestones_engagement_id_idx" ON "milestones"("engagement_id");

-- CreateIndex
CREATE INDEX "milestones_state_idx" ON "milestones"("state");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_engagement_id_milestone_number_key" ON "milestones"("engagement_id", "milestone_number");

-- CreateIndex
CREATE INDEX "acceptance_criteria_milestone_id_idx" ON "acceptance_criteria"("milestone_id");

-- CreateIndex
CREATE INDEX "milestone_dod_items_milestone_id_idx" ON "milestone_dod_items"("milestone_id");

-- CreateIndex
CREATE INDEX "milestone_submissions_milestone_id_idx" ON "milestone_submissions"("milestone_id");

-- CreateIndex
CREATE INDEX "milestone_submissions_expert_id_idx" ON "milestone_submissions"("expert_id");

-- CreateIndex
CREATE INDEX "paygated_documents_milestone_id_idx" ON "paygated_documents"("milestone_id");

-- CreateIndex
CREATE INDEX "paygated_documents_milestone_id_release_state_idx" ON "paygated_documents"("milestone_id", "release_state");

-- CreateIndex
CREATE INDEX "escrow_accounts_status_idx" ON "escrow_accounts"("status");

-- CreateIndex
CREATE INDEX "escrow_accounts_client_wallet_id_idx" ON "escrow_accounts"("client_wallet_id");

-- CreateIndex
CREATE INDEX "escrow_accounts_expert_wallet_id_idx" ON "escrow_accounts"("expert_wallet_id");

-- CreateIndex
CREATE INDEX "disputes_engagement_id_idx" ON "disputes"("engagement_id");

-- CreateIndex
CREATE INDEX "disputes_state_idx" ON "disputes"("state");

-- CreateIndex
CREATE INDEX "disputes_escrow_account_id_idx" ON "disputes"("escrow_account_id");

-- CreateIndex
CREATE INDEX "messages_engagement_id_timestamp_idx" ON "messages"("engagement_id", "timestamp" ASC);

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "message_reads_message_id_idx" ON "message_reads"("message_id");

-- CreateIndex
CREATE INDEX "message_reads_user_id_idx" ON "message_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_reads_message_id_user_id_key" ON "message_reads"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "reviews_engagement_id_idx" ON "reviews"("engagement_id");

-- CreateIndex
CREATE INDEX "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "reviews_target_id_idx" ON "reviews"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_engagement_id_reviewer_id_key" ON "reviews"("engagement_id", "reviewer_id");

-- CreateIndex
CREATE INDEX "platform_decisions_decision_type_idx" ON "platform_decisions"("decision_type");

-- CreateIndex
CREATE INDEX "platform_decisions_created_at_idx" ON "platform_decisions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_decisions_entity_type_entity_id_idx" ON "platform_decisions"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_team_profiles" ADD CONSTRAINT "tech_team_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_team_profiles" ADD CONSTRAINT "tech_team_profiles_linked_client_id_fkey" FOREIGN KEY ("linked_client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_team_profiles" ADD CONSTRAINT "tech_team_profiles_linked_project_id_fkey" FOREIGN KEY ("linked_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_platform_wallet_id_fkey" FOREIGN KEY ("platform_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elicitation_sessions" ADD CONSTRAINT "elicitation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_elicitation_session_id_fkey" FOREIGN KEY ("elicitation_session_id") REFERENCES "elicitation_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_domain_depths" ADD CONSTRAINT "expert_domain_depths_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_seam_claims" ADD CONSTRAINT "expert_seam_claims_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_submissions" ADD CONSTRAINT "portfolio_submissions_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_submissions" ADD CONSTRAINT "portfolio_submissions_seam_claim_id_fkey" FOREIGN KEY ("seam_claim_id") REFERENCES "expert_seam_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_bids" ADD CONSTRAINT "capability_bids_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptance_criteria" ADD CONSTRAINT "acceptance_criteria_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_dod_items" ADD CONSTRAINT "milestone_dod_items_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_dod_items" ADD CONSTRAINT "milestone_dod_items_maps_to_criterion_id_fkey" FOREIGN KEY ("maps_to_criterion_id") REFERENCES "acceptance_criteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_submissions" ADD CONSTRAINT "milestone_submissions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_submissions" ADD CONSTRAINT "milestone_submissions_expert_id_fkey" FOREIGN KEY ("expert_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paygated_documents" ADD CONSTRAINT "paygated_documents_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_client_wallet_id_fkey" FOREIGN KEY ("client_wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_expert_wallet_id_fkey" FOREIGN KEY ("expert_wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "acceptance_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_escrow_account_id_fkey" FOREIGN KEY ("escrow_account_id") REFERENCES "escrow_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_filed_by_fkey" FOREIGN KEY ("filed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
