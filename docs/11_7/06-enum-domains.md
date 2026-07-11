## 0.10 Enumerated Value Domains (CHECK Constraints, State Machines & JSONB Schemas)

> **Purpose:** Canonical definition for every bounded string set, `CHECK` constraint, state code, and JSONB schema used in the 40-table architecture and the 12 internal FastAPI endpoints. Application code, NestJS guards, and state machines must reference these domains. If a value is not on this list, the DB rejects it, or the application validation layer throws a 422.

---

### A. Core Taxonomy Domains (DB-Driven via CMS)

*Note: While stored as `TEXT` in the DB to allow CMS management, the seed values form the canonical baseline. NestJS dynamically validates these against `domain_definitions`, `seam_definitions`, `archetype_definitions`, and `void_code_definitions` at the service layer.*

| Domain Code | Table.Column(s) | Allowed Values (Seed Data) | Grounding |
|---|---|---|---|
| `DOMAIN_CODE` | `expert_domain_depths.domain_code`, `services.domains_json` | `A` \| `B` \| `C` \| `D` \| `E` \| `F` | Maps to §0.1 (A=LLM App, B=MLOps, C=AI Eval, D=VectorDB, E=DataPipe, F=ML Model) |
| `SEAM_CODE` | `expert_seam_claims.seam_code`, `projects.required_seams_json` | `A↔C` \| `A↔F` \| `A↔D` \| `D↔E` \| `D↔F` \| `C↔F` \| `E↔F` \| `A↔B` \| `B↔E` \| `C↔E` | Maps to §0.2. **Strictly enforces `↔` (U+2194) arrow character.** |
| `ARCHETYPE_CODE` | `projects.archetype`, `elicitation_sessions.archetype` | `1` \| `2` \| `3` \| `4` \| `5` \| `6` | Maps to §0.3 (1=RAG, 2=Recommendation, 3=Classification, 4=Generation, 5=Prediction, 6=Multimodal) |
| `PROJECT_TIER` | `projects.tier` | `TIER_1` \| `TIER_2` \| `TIER_3` | Maps to §0.3 (Simple, Moderate, Complex) |
| `VOID_CODE` | `elicitation_sessions.void_list_json` | `NO_GROUND_TRUTH` \| `UNCLEAR_SUCCESS_METRIC` \| `INTEGRATION_UNCLEAR` \| `MISSING_TECHNICAL_ARTIFACT` \| etc. | Maps to §0.4 Void Taxonomy |

---

### B. User & Profile Domains

| Domain Code | Table.Column | Allowed Values | Notes |
|---|---|---|---|
| `ACTIVE_ROLE` | `users.active_role` | `CLIENT` \| `EXPERT` \| `ADMIN` | JWT context; determines dashboard & guards |
| `CLIENT_SUBTYPE` | `users.client_subtype` | `CEO` \| `TECH_TEAM` \| `NULL` | NULL for EXPERT and ADMIN |
| `USER_ROLE_ITEM` | `users.roles` (JSONB array elements) | `CLIENT_CEO` \| `EXPERT` \| `ADMIN` | Strings allowed inside the `roles` JSONB array |
| `SUB_TIER` | `users.subscription_client_tier`, `.subscription_expert_tier` | `free` \| `pro` | Evaluated by subscription guard middleware |
| `ENGAGEMENT_MODEL` | `expert_profiles.engagement_model` | `MILESTONE` \| `HOURLY` \| `HYBRID` | Self-declared by expert; feeds 5% match score weight |
| `DOMAIN_DEPTH` | `expert_domain_depths.depth_level` | `SURFACE` \| `OPERATIONAL` \| `DEEP` | Maps to §0.1 capability domains |
| `VERIFY_TIER` | `expert_domain_depths.verification_tier`, `expert_seam_claims.verification_tier` | `CLAIMED` \| `EVIDENCE_BACKED` | MVP 2-tier system per §0.4 |

---

### C. State Machine Domains (Grounded in §0.6)

| Domain Code | Table.Column | Allowed Values | Notes |
|---|---|---|---|
| `ELICITATION_STATE` | `elicitation_sessions.state` | `IN_PROGRESS` \| `COMPLETED` \| `ABANDONED` \| `RETURNED` | §0.6 Elicitation states |
| `PROJECT_STATE` | `projects.state` | `DRAFT` \| `PUBLISHED` \| `RETURNED_TO_CLIENT` \| `SUSPENDED` | §0.6 Spec states |
| `SERVICE_STATE` | `services.state` | `DRAFT` \| `PUBLISHED` \| `SUSPENDED` | Admin pull-back applies to services too |
| `PORTFOLIO_STATUS` | `portfolio_submissions.status` | `PENDING` \| `APPROVED` \| `REJECTED` | LLM auto-eval result |
| `ENGAGEMENT_STATE` | `engagements.state` | `PENDING` \| `CONNECTED` \| `ACTIVE` \| `CLOSED` \| `DISPUTED` \| `CANCELLED` | §0.6 Engagement states |
| `ENGAGEMENT_TYPE` | `engagements.type` | `PROJECT_BASED` \| `SERVICE_PURCHASE` \| `TECH_DISCOVERY` | Immutable after creation; enforces FK consistency |
| `BID_STATE` | `capability_bids.state` | `DRAFT` \| `SUBMITTED` \| `TECH_REVIEW` \| `REVISION_REQUESTED` \| `TECH_APPROVED` \| `CEO_REVIEW` \| `SELECTED` \| `DECLINED` \| `WITHDRAWN` | §0.6 Simplified mutable-row Bid states |
| `BID_TECH_STATUS` | `capability_bids.tech_status` | `PENDING` \| `APPROVED` \| `REVISION_REQUESTED` | Set by TECH_TEAM; unlocks CEO_REVIEW |
| `BID_CEO_STATUS` | `capability_bids.ceo_status` | `PENDING` \| `APPROVED` \| `DECLINED` | Set by CEO; guarded by `tech_status = APPROVED` |
| `MILESTONE_STATE` | `milestones.state` | `DEFINED` \| `AWAITING_PAYMENT` \| `FUNDED` \| `IN_PROGRESS` \| `SUBMITTED` \| `IN_REVISION` \| `APPROVED` \| `RELEASED` \| `DISPUTED` | §0.6 Milestone states |
| `SIGN_OFF_AUTH` | `milestones.sign_off_authority` | `TECH_TEAM` \| `CEO` \| `JOINT` | Determines who can set `verified_at` on criteria |
| `VERIFY_BY_ROLE` | `acceptance_criteria.verified_by_role` | `TECH_TEAM` \| `CEO` \| `JOINT` | Must match the milestone's `sign_off_authority` logic |
| `DOD_STATUS` | `milestone_dod_items.status` | `PENDING` \| `COMPLETED` \| `NOT_APPLICABLE` | DB CHECK prevents `NOT_APPLICABLE` if `is_required = true` |
| `DOC_RELEASE_STATE` | `paygated_documents.release_state` | `STAGED` \| `RELEASED` | Auto-flips to `RELEASED` in IPN TX on milestone FUNDED |
| `DISPUTE_STATE` | `disputes.state` | `PENDING` \| `LAYER_1_EVAL` \| `AUTO_RESOLVED` \| `MANUAL_REVIEW` \| `RESOLVED` \| `WITHDRAWN` | §0.6 2-Layer Dispute states |
| `REVIEWER_ROLE` | `reviews.reviewer_role` | `CEO` \| `TECH_TEAM` \| `EXPERT` | Enforces role-specific review forms |
| `INVITATION_STATUS` | `invitations.status` | `PENDING` \| `ACCEPTED` \| `DECLINED` \| `EXPIRED` | 7-day expiry window |
| `NOTIFICATION_TYPE` | `notifications.type` | `bid_update` \| `system` \| `milestone_update` | Persisted WS notification types |
| `SUBSCRIPTION_ROLE` | `subscription_packages.role` | `CLIENT` \| `EXPERT` | Differentiates Pro packages |

---

### D. Wallet, Escrow & Payment Domains

| Domain Code | Table.Column | Allowed Values | Notes |
|---|---|---|---|
| `TX_TYPE` | `wallet_transactions.transaction_type` | `TOP_UP` \| `SUBSCRIPTION` \| `ESCROW_LOCK` \| `ESCROW_RELEASE` \| `PLATFORM_FEE` \| `ESCROW_REFUND` \| `ESCROW_SPLIT` \| `WITHDRAWAL` \| `WITHDRAWAL_REFUND` | Immutable ledger types per §0.6 |
| `VA_ENTITY_TYPE` | `virtual_accounts.entity_type` | `WALLET_TOPUP` \| `MILESTONE` \| `SERVICE` | Dictates IPN handler branching logic |
| `VA_STATUS` | `virtual_accounts.status` | `ACTIVE` \| `EXPIRED` \| `USED` | Permanent for TOPUP; 24h expiry for others |
| `ESCROW_STATUS` | `escrow_accounts.status` | `HELD` \| `RELEASED` \| `FROZEN` \| `REFUNDED` \| `SPLIT` | `FROZEN` triggered by dispute filing |
| `WITHDRAWAL_TYPE` | `withdrawal_requests.type` | `MILESTONE_RELEASE` \| `EXPERT_MANUAL` | Auto-created on milestone APPROVED vs. Expert initiated |
| `WITHDRAWAL_STATUS` | `withdrawal_requests.status` | `PENDING` \| `COMPLETED` \| `FAILED` \| `CANCELLED` | §0.6 Withdrawal states |
| `SERVICE_TYPE` | `services.service_type` | `AI_SERVICE` \| `TECH_DISCOVERY` | Differentiates marketplace listings |
| `SHORTLIST_SOURCE` | `project_shortlist_cache.source` | `AUTO` \| `FORCE_REFRESH` | Seeded on publish vs. CEO triggered re-score |

---

### E. Platform Decision & Audit Domains

| Domain Code | Table.Column | Allowed Values | Notes |
|---|---|---|---|
| `PLATFORM_DECISION_TYPE` | `platform_decisions.decision_type` | `ELICITATION_SYNTHESIS` \| `SPEC_AUTO_RETURN` \| `SEAM_TIER_UPGRADE` \| `PORTFOLIO_EVAL` \| `DISPUTE_L1_EVAL` \| `CRITERION_QUALITY_GATE` \| `EVIDENCE_SUBMISSION` | Audit log for all LLM/AI actions (Admin Integrity Monitor) |

---

### F. NestJS JSONB Schema Definitions

> Application-level validation (NestJS DTOs) enforces these canonical structures before DB write.

| Table.Column | JSONB Code | Canonical Structure | Notes |
|---|---|---|---|
| `users.roles` | `ROLES_ARRAY` | `[ string ]` where string ∈ `USER_ROLE_ITEM` | e.g. `["CLIENT_CEO", "EXPERT"]` |
| `users.self_technical_projects` | `UUID_ARRAY` | `[ string ]` | List of project UUIDs where CEO acts as tech team |
| `projects.required_seams_json` | `FOOTPRINT_SEAMS` | `[{ "seam_code": SEAM_CODE, "criticality": "load_bearing" \| "significant" \| "contributing" }]` | Drives 40% match score weight |
| `projects.required_domains_json` | `FOOTPRINT_DOMAINS` | `[{ "domain_code": DOMAIN_CODE, "required_depth": DOMAIN_DEPTH }]` | Drives 25% match score weight |
| `projects.milestone_framework_json` | `MILESTONE_FRAMEWORK` | `[{ "milestone_number": int, "deliverable_statement": string, "sign_off_authority": SIGN_OFF_AUTH, "payment_amount_vnd": bigint, "estimated_cost_vnd": bigint, "estimated_duration_days": int }]` | Generated by Stage 5 synthesis |
| `projects.artifact_a_json` | `ARTIFACT_A` | `{ "project_name": string, "business_intent": string, "archetype": ARCHETYPE_CODE, "stack_tags": [string], "volume_tier": PROJECT_TIER, "sdlc_notices": [string] }` | Public spec; visible to matched experts |
| `projects.artifact_b_json` | `ARTIFACT_B` | `{ "stack_tags": [string], "integration_method": string, "legacy_volume": string, "schemas": [any], "contracts": [any] }` | Technical vault; strictly gated per §0.7 RBAC |
| `elicitation_sessions.void_list_json` | `VOID_LIST` | `[{ "void_code": VOID_CODE, "severity": "HIGH" \| "MEDIUM" \| "LOW", "injected": boolean }]` | Tracks mandatory SDLC injections |
| `elicitation_sessions.critical_artifacts_json` | `CRITICAL_ARTIFACTS` | `[{ "artifact_key": string, "label": string, "reason": string, "placeholder_prompt": string }]` | Artifacts required for accurate Stage 5 synthesis |
| `elicitation_sessions.stage4_tech_inputs_json` | `STAGE4_INPUTS` | `{ "current_stack": string, "data_available": string, "latency_requirement": string, "additional_requirement_1": string \| null, "technical_artifacts": { "artifact_key": string } }` | CEO/TechTeam Stage 4 inputs + submitted artifact content |
| `elicitation_sessions.stage4_draft_json` | `STAGE4_DRAFT` | `object` | Auto-saved form state for Stage 4 |
| `expert_profiles.stack_tags_json` | `STACK_TAGS` | `[ string ]` | e.g. `["Python", "Kafka", "Go"]`. Drives 5% match score weight |
| `expert_profiles.archetype_history_json` | `ARCHETYPE_HISTORY` | `[ ARCHETYPE_CODE ]` | e.g. `["1", "4"]`. Drives 10% match score weight |
| `services.domains_json` | `SERVICE_DOMAINS` | `[ DOMAIN_CODE ]` | Domains covered by the service |
| `services.seams_json` | `SERVICE_SEAMS` | `[ SEAM_CODE ]` | Seams covered by the service |
| `capability_bids.footprint_alignment_json` | `BID_ALIGNMENT` | `{ "domains": [{ "code": DOMAIN_CODE, "depth": DOMAIN_DEPTH }], "seams": [{ "code": SEAM_CODE, "tier": VERIFY_TIER }] }` | Component 1 of 3-component bid |
| `capability_bids.conditional_pricing_json` | `BID_PRICING` | `[{ "milestone_number": int, "price_vnd": bigint, "condition": string }]` | Component 3 of 3-component bid |
| `milestones.tech_stack_json` | `TECH_STACK` | `[ string ]` | Technologies used in milestone |
| `milestone_submissions.files_json` | `FILES_ARRAY` | `[ string ]` | Deliverable attachment URLs |
| `milestone_chat_sessions.messagesJson` | `CHAT_MESSAGES` | `[{ "role": "user" \| "assistant", "content": string }]` | E-3 Assistant chat history |
| `reviews.structured_signals_json` | `REVIEW_SIGNALS` | `[{ "seam_code": SEAM_CODE, "signal_type": string, "seam_role": string }]` | Informational only (Tier 4 cut) |

---

### G. Internal LLM Service (FastAPI) Response Contracts

> NestJS parses these exact Pydantic schemas returned by the 12 FastAPI endpoints. These are strictly enforced by the AI service.

| Endpoint | Response Model | Canonical Structure |
|---|---|---|
| `POST /llm/elicitation/stage1-extract` | `Stage1Response` | `{ "symptoms": [string], "scale_signals": {object}, "voids": [{ "void_code": string, "severity": "HIGH"\|"MEDIUM"\|"LOW" }], "recommended_archetypes": [ARCHETYPE_CODE], "critical_artifacts_required": [CRITICAL_ARTIFACTS] }` |
| `POST /llm/elicitation/stage3-vagueness-check` | `Stage3VaguenessCheckResponse` | `{ "vague_answers": [{ "question": string, "reason": string }], "irrelevant_answers": [{ "question": string, "issue": string }] }` |
| `POST /llm/elicitation/stage4-recommend` | `Stage4RecommendResponse` | `{ "recommended_stack": string, "recommended_integration": string, "recommended_legacy_volume": string }` |
| `POST /llm/elicitation/stage5-synthesize` | `Stage5Response` | `{ "required_seams_json": [FOOTPRINT_SEAMS], "required_domains_json": [FOOTPRINT_DOMAINS], "milestone_framework_json": [MILESTONE_FRAMEWORK], "artifact_a_json": ARTIFACT_A, "artifact_b_json": ARTIFACT_B, "completeness_score": float, "estimated_total_cost_vnd": int\|null, "estimated_total_duration_days": int\|null }` |
| `POST /llm/elicitation/milestone-chat` | `MilestoneChatResponse` | `{ "reply": string, "suggested_edit": { "milestone_number": int, "field": string, "suggested_value": any, "reason": string } \| null }` |
| `POST /llm/portfolio-eval` | `PortfolioEvalResponse` | `{ "confidence_score": float, "passed_boolean": bool, "gap_advisory": string \| null }` |
| `POST /llm/matching` | `list[MatchResult]` | `[{ "expert_id": uuid, "composite_score": float, "strength_label": "STRONG_MATCH" \| "GOOD_MATCH" \| "POSSIBLE_MATCH" \| "WEAK_MATCH", "gap_map": [{ "seam_code": SEAM_CODE, "color": "green" \| "amber" \| "red" }] }]` |
| `POST /llm/dispute-eval` | `DisputeEvalResponse` | `{ "confidence_score": float, "finding": "expert_wins" \| "client_wins", "reasoning": string }` |
| `POST /llm/criterion-check` | `CriterionCheckResponse` | `{ "is_subjective": bool, "suggestions": [string], "severity": "LOW" \| "MEDIUM" \| "HIGH", "context_note": string \| null }` |
| `POST /llm/service-generate` | `ServiceGenerateResponse` | `{ "title": string, "description": string, "scope": string, "timeline": string, "suggested_price_vnd": int, "suggested_domains": [DOMAIN_CODE], "suggested_seams": [SEAM_CODE], "pricing_rationale": string }` |
| `GET /projects/{id}/artifact-b` | `GateCheckResult` | `{ "project_id": string, "artifact_b_accessible": true }` *(Returns 403 with `detail: string` on denial)* |