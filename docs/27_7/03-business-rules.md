# AITasker MVP — Business Rules
**Schema ground truth:** 40 tables · PostgreSQL 16  
**Date:** July 2026

**Rule Format & Annotations:**  
Each rule is a declarative constraint. Source anchors `[SRS]` refer to the Software Requirement Specification document. Implementation enforcement points are tagged:
- `[DB]`: Enforced directly by PostgreSQL schema constraints (`CHECK`, `UNIQUE`, `FOREIGN KEY`, `NOT NULL`).
- `[APP]`: Enforced in NestJS/FastAPI application service logic.
- `[ROUTE]`: Enforced by NestJS Guard / Middleware controllers at request entry.

---

## Table of Contents

1. [Authentication & Identity (BR-AUTH)](#1-authentication--identity-br-auth)
2. [User Registration & Roles (BR-USR)](#2-user-registration--roles-br-usr)
3. [Subscriptions & Feature Gates (BR-SUB)](#3-subscriptions--feature-gates-br-sub)
4. [Wallet & Finance (BR-WAL)](#4-wallet--finance-br-wal)
5. [SePay Payment Integration & Webhooks (BR-PAY)](#5-sepay-payment-integration--webhooks-br-pay)
6. [AI Elicitation Engine (BR-ELI)](#6-ai-elicitation-engine-br-eli)
7. [Expert Profile & Capability (BR-EXP & BR-VER)](#7-expert-profile--capability-br-exp--br-ver)
8. [Projects & Composite Matching (BR-PRJ & BR-MAT)](#8-projects--composite-matching-br-prj--br-mat)
9. [Information Release & Artifact Protection (BR-ART)](#9-information-release--artifact-protection-br-art)
10. [Bids & Commercial Negotiations (BR-BID)](#10-bids--commercial-negotiations-br-bid)
11. [Engagements (BR-ENG)](#11-engagements-br-eng)
12. [Milestones (BR-MIL)](#12-milestones-br-mil)
13. [Deliverables, Criteria & Definition of Done (BR-DEL, BR-ACC & BR-DOD)](#13-deliverables-criteria--definition-of-done-br-del-br-acc--br-dod)
14. [Escrow & Dispute Resolution (BR-DIS & BR-ESC)](#14-escrow--dispute-resolution-br-dis--br-esc)
15. [Messaging & Notifications (BR-MSG & BR-NOT)](#15-messaging--notifications-br-msg--br-not)
16. [Reviews & Reputation (BR-REV)](#16-reviews--reputation-br-rev)
17. [Admin Governance, CMS & System Invariants (BR-ADM & BR-INT)](#17-admin-governance-cms--system-invariants-br-adm--br-int)
18. [Cross-Domain Interaction Rules (BR-XD)](#18-cross-domain-interaction-rules-br-xd)

---

## 1. Authentication & Identity (BR-AUTH)

**BR-AUTH-01 — Global Email Uniqueness.**  
Email addresses must be globally unique across the system. Attempting to register with an existing email returns a 409 Conflict response. `[DB: UNIQUE]` `[APP]` `[SRS]`

**BR-AUTH-02 — Mandatory Email Verification.**  
Every new user account starts as unverified (`is_email_verified = false`). A 6-digit numeric OTP is generated at registration and must be submitted within 15 minutes (`email_otp_expires_at`) to activate the account. `[DB]` `[APP]` `[SRS]`

**BR-AUTH-03 — Unverified Login Block.**  
Unverified users who attempt to log in are blocked. A fresh OTP is automatically generated and re-sent via email; the login endpoint returns HTTP 401 with message `EMAIL_UNVERIFIED` so the frontend redirects to the OTP verification screen. `[APP]` `[ROUTE]` `[SRS]`

**BR-AUTH-04 — Expired OTP Regeneration.**  
If an expired OTP is submitted during verification, the system auto-generates a new code, emails it to the user, and returns an error informing them that a fresh code has been issued. `[APP]` `[SRS]`

**BR-AUTH-05 — Password Reset Token Lifecycle.**  
Password reset tokens are cryptographically random 32-byte hex strings, expire after exactly 1 hour (`password_reset_token_expires_at`), and are deleted immediately after a successful password reset. `[APP]` `[SRS]`

**BR-AUTH-06 — Anti-Enumeration Generic Reset Response.**  
The `POST /auth/forgot-password` endpoint always returns the exact same generic message regardless of whether the supplied email matches an active account. This prevents email enumeration attacks. `[APP]` `[SRS]`

**BR-AUTH-07 — Suspended Account Lock.**  
Suspended users (`is_active = false`) cannot log in and do not receive password-reset links. Login attempts return HTTP 401 / 403. `[APP]` `[ROUTE]` `[SRS]`

**BR-AUTH-08 — Password Change Invalidation.**  
Changing or resetting a password invalidates all existing sessions for that user by clearing the stored `refresh_token_hash`. The user must log in again on all devices. `[APP]` `[SRS]`

**BR-AUTH-09 — Role Switching Scope.**  
Role switching (`PUT /auth/switch-role`) is only permitted if the target role exists in the user's `roles` JSON array. A new access token embedding the switched `activeRole` is returned immediately. `[APP]` `[SRS]`

**BR-AUTH-10 — Refresh Token Hash Validation.**  
Refresh tokens are validated by comparing the incoming token's SHA-256 hash against the stored `refresh_token_hash`. Logout clears the stored hash, making all issued refresh tokens permanently invalid. `[APP]` `[SRS]`

---

## 2. User Registration & Roles (BR-USR)

**BR-USR-01 — Automatic Subtype & Profile Provisioning.**  
Registering with role `CLIENT_CEO` automatically sets `activeRole = 'CLIENT'`, `clientSubtype = 'CEO'`, and creates a `client_profiles` record. Registering as `EXPERT` sets `activeRole = 'EXPERT'` and creates an `expert_profiles` record. `[APP]` `[DB: atomic TX]` `[SRS]`

**BR-USR-02 — Atomic Wallet & Top-Up VA Provisioning.**  
A personal wallet (`wallets`) and a permanent `WALLET_TOPUP` virtual account (`virtual_accounts`) are created atomically in the same database transaction as user account registration. Every user starts with both records. `[DB: atomic TX]` `[SRS]`

**BR-USR-03 — Tech Team Delegation Linkage.**  
Tech Team members are linked to a specific CEO client via `linked_client_id`. The `linked_project_id` column on `tech_team_profiles` is set when the Tech Team member consumes the one-time handoff JWT link issued during Stage 4 Scenario B of elicitation. `[DB: FK]` `[APP]` `[SRS]`

**BR-USR-04 — Tech Team Project Scope Guard.**  
Tech Team members (`clientSubtype = 'TECH_TEAM'`) can only view and act on milestones, bids, and engagements belonging to the project they are linked to (`linked_project_id`). Access to unassigned projects is blocked with 403 Forbidden. `[ROUTE]` `[SRS]`

**BR-USR-05 — Company Tax Code Government Verification.**  
Company tax code verification (`POST /auth/verify-tax-code`) queries the public VietQR API (`api.vietqr.io/v2/business/{taxCode}`). A response code of `"00"` indicates a valid registered Vietnamese business entity and updates `client_profiles.company_name`. `[APP]` `[SRS]`

---

## 3. Subscriptions & Feature Gates (BR-SUB)

**BR-SUB-01 — Role Context Guard for Subscription Activation.**  
A user must be actively operating under the target role before activating a subscription for that role. Attempting to activate an Expert subscription while `activeRole = 'CLIENT'` is rejected with 409 Conflict. `[APP]` `[SRS]`

**BR-SUB-02 — Package Availability Guard.**  
Only active subscription packages (`is_active = true`) in the `subscription_packages` table can be purchased. Attempting to activate a deactivated package returns 422 Unprocessable Entity. `[APP]` `[SRS]`

**BR-SUB-03 — Role-Package Matching Enforcement.**  
A subscription package's designated `role` column (`CLIENT` or `EXPERT`) must match the user's current `activeRole`. A CEO cannot purchase an Expert package. `[APP]` `[SRS]`

**BR-SUB-04 — Active Subscription Idempotency Guard.**  
Re-activating a subscription while an existing subscription for that role is still valid (`expiresAt > now()`) is blocked with 409 Conflict. `[APP]` `[SRS]`

**BR-SUB-05 — Wallet-Deducted Subscription Billing.**  
Subscription packages are paid directly from the user's `wallets.available_balance`. If `available_balance < package.price_vnd`, activation is rejected with 422 `INSUFFICIENT_BALANCE`. `[APP]` `[SRS]`

**BR-SUB-06 — Immediate JWT Re-Issuance on Upgrade.**  
Subscription activation immediately issues a new JWT access token embedding the updated subscription tier claim (`subscriptionClientTier` or `subscriptionExpertTier = 'pro'`), allowing downstream guards to grant immediate access without re-login. `[APP]` `[SRS]`

---

## 4. Wallet & Finance (BR-WAL)

**BR-WAL-01 — BigInt Integer VND Currency Standard.**  
All monetary amounts across the platform are stored and processed as `BIGINT` (Vietnamese Dong integers) to eliminate floating-point representation drift. `[DB: BIGINT]` `[SRS]`

**BR-WAL-02 — Bounded Platform Fee Percentage.**  
The platform fee percentage stored in `platform_settings.platform_fee_pct` must be between 0 and 1 inclusive (`CHECK (platform_fee_pct BETWEEN 0 AND 1)`). Values outside this range block all milestone payment releases to prevent negative payouts. `[DB: CHECK]` `[APP]` `[SRS]`

**BR-WAL-03 — Atomic Escrow Release Distribution.**  
On milestone payment release:  
$$\text{Platform Fee} = \text{ROUND}(\text{Escrow Total} \times \text{platform\_fee\_pct})$$  
$$\text{Expert Payout} = \text{Escrow Total} - \text{Platform Fee}$$  
Both wallet transfers and ledger entries (`ESCROW_RELEASE` and `PLATFORM_FEE`) are executed within a single atomic database transaction. `[DB: atomic TX]` `[SRS]`

**BR-WAL-04 — Escrow Refund Status Precondition.**  
Refunding escrow to the client (`CLIENT_WINS` dispute outcome) requires the `escrow_accounts.status` to be in `FROZEN` status (set when a dispute is filed). Refunding from `HELD` or any other status is blocked. `[APP]` `[SRS]`

**BR-WAL-05 — Equal 50/50 Escrow Split Settlement.**  
A `SPLIT` dispute outcome divides the escrowed amount evenly: Client receives $\lfloor \text{Total} / 2 \rfloor$ and Expert receives the remainder. Both wallet accounts are credited atomically. `[APP]` `[SRS]`

**BR-WAL-06 — Automatic Milestone Release Withdrawal.**  
If an expert has a linked bank account (`sepay_bank_account_xid IS NOT NULL`) at the moment of milestone release, an automatic `MILESTONE_RELEASE` withdrawal request is created and the payout amount is simultaneously deducted from the expert's `available_balance`. `[APP]` `[DB: atomic TX]` `[SRS]`

**BR-WAL-07 — USED Virtual Account Lock.**  
A milestone's virtual account (VA) cannot be regenerated if the existing VA status is `USED`, as payment processing may already be in progress. `[APP]` `[SRS]`

**BR-WAL-08 — Active VA Regeneration Block.**  
A milestone's VA cannot be regenerated if the existing VA is in `ACTIVE` status and has not passed its expiration time (`expires_at > now()`). `[APP]` `[SRS]`

**BR-WAL-09 — Automatic Engagement Activation on First Funding.**  
When the first milestone of an engagement is funded (escrow locked via IPN), the engagement state automatically transitions from `CONNECTED` to `ACTIVE`. `[APP]` `[SRS]`

**BR-WAL-10 — Automatic Pay-Gated Document Release.**  
Pay-gated deliverable documents staged prior to funding receive `release_state = 'STAGED'`. When escrow is locked for a milestone, all staged documents for that milestone are bulk-updated to `RELEASED`. `[APP]` `[DB: atomic TX]` `[SRS]`

---

## 5. SePay Payment Integration & Webhooks (BR-PAY)

**BR-PAY-01 — HMAC Signature Verification Middleware.**  
All requests to `/webhooks/sepay/*` must pass HMAC-SHA256 signature verification (`x-sepay-signature` header computed over timestamp + raw body using `SEPAY_WEBHOOK_SECRET`). Unsigned or invalid requests are rejected with 401 Unauthorized. `[ROUTE]` `[APP]`

**BR-PAY-02 — Database-Level IPN Idempotency.**  
IPN processing enforces idempotency via `UNIQUE INDEX wallet_tx_idempotency ON wallet_transactions(wallet_id, reference_id) WHERE reference_id IS NOT NULL`. Duplicate webhook dispatches with the same transaction reference code are safely ignored. `[DB: UNIQUE INDEX]` `[APP]`

**BR-PAY-03 — Synchronous Webhook Processing.**  
NestJS processes all IPN state updates, ledger entries, and document releases synchronously within the webhook request handler transaction, ensuring transactional consistency before returning 200 OK to SePay. `[APP]`

**BR-PAY-04 — Polymorphic Virtual Account Routing.**  
The IPN handler inspects `virtual_accounts.entity_type` to route the incoming transfer: `WALLET_TOPUP` credits user wallet balance; `MILESTONE` locks milestone escrow; `SERVICE` activates direct service engagement. `[APP]`

**BR-PAY-05 — Exact Transfer Amount Validation.**  
For `MILESTONE` and `SERVICE` virtual accounts, the transferred amount in the IPN payload must match `virtual_accounts.fixed_amount` exactly. Mismatched amounts cause transaction rejection. `[APP]`

**BR-PAY-06 — Permanent Top-Up Virtual Accounts.**  
`WALLET_TOPUP` virtual accounts are assigned once per user at registration, have `fixed_amount = NULL` and `expires_at = NULL`, and remain perpetually active across multiple deposits. `[DB]` `[APP]`

**BR-PAY-07 — 24-Hour Expiry Window for Milestone VAs.**  
`MILESTONE` and `SERVICE` virtual accounts are generated with a strict 24-hour expiration timestamp (`expires_at = now() + 24 hours`). IPNs arriving for expired VAs are rejected. `[APP]`

**BR-PAY-08 — Bank Hub Link Structure.**  
Expert bank account linking via `POST /bank-hub/initiate-link` stores verified `sepay_bank_account_xid` and `bank_account_holder_name` on the user record. Re-linking uses `PUT /bank-hub/link`. `[APP]`

**BR-PAY-09 — Manual Outbound Disbursement Architecture.**  
Expert withdrawal requests (`POST /withdrawals`) create a `withdrawal_requests` row in `PENDING` status and debit `available_balance` immediately. No external automated disbursement API is called on creation. `[APP]`

**BR-PAY-10 — Administrative Withdrawal Lifecycle.**  
Platform Administrators process pending withdrawals: `PUT /admin/withdrawals/:id/complete` marks the request `COMPLETED`; `PUT /admin/withdrawals/:id/fail` marks it `FAILED` and executes an atomic `WITHDRAWAL_REFUND` ledger credit back to the expert's wallet. `[APP]`

**BR-PAY-11 — Pending Withdrawal Cancellation.**  
Experts can cancel their own `PENDING` withdrawal requests (`DELETE /withdrawals/:id`). The request state transitions to `CANCELLED` and funds are refunded to `available_balance` via a `WITHDRAWAL_REFUND` transaction log. `[APP]`

**BR-PAY-12 — Mandatory Bank Link Guard for Withdrawals.**  
An Expert cannot submit a manual withdrawal request unless `users.sepay_bank_account_xid` is set. Unlinked attempts are rejected with 409 Conflict. `[ROUTE]` `[APP]`

---

## 6. AI Elicitation Engine (BR-ELI)

**BR-ELI-01 — Single-Use Handoff Tokens.**  
The elicitation handoff JWT token (`handoff_token_jti`) issued for Tech Team participation is single-use. Once consumed (`handoff_consumed_at` set), subsequent attempts return 401 Unauthorized. `[APP]` `[SRS]`

**BR-ELI-02 — Synchronous Stage 5 Synthesis Pipeline.**  
Stage 5 project spec synthesis (`POST /elicitation/sessions/:id/stage5`) is fully synchronous. NestJS awaits FastAPI LLM output, evaluates quality gates, and writes project records within the single request cycle (90-second HTTP timeout). `[APP]` `[SRS]`

**BR-ELI-03 — Scenario B Tech Team Delegation.**  
During Stage 4 Scenario B, the CEO invites a Tech Team member via email. The system generates a signed handoff link allowing the Tech Team member to authenticate and submit technical context (`PUT /elicitation/sessions/:id/stage4-handoff`). `[APP]` `[SRS]`

**BR-ELI-04 — Dynamic CMS Prompt & Taxonomy Ingestion.**  
FastAPI fetches prompt templates from NestJS `GET /internal/prompts/:stage` (cached 60 seconds) and ingests active CMS tables (`domain_definitions`, `seam_definitions`, `archetype_definitions`, `void_code_definitions`) at runtime, ensuring hot-reload without container restarts. `[APP]`

**BR-ELI-05 — Critical Artifact Requirement & Completeness Score Capping.**  
If Stage 1 identifies missing proprietary documents (e.g. data schemas, rulesets), they are tracked in `critical_artifacts_json`. If unsubmitted by Stage 4, Stage 5 synthesis caps `completeness_score <= 0.60` and appends SDLC warning notices. `[APP]`

**BR-ELI-06 — Three-Gate Publication Requirement.**  
A project specification reaches `PUBLISHED` state if and only if: (1) `completeness_score >= 0.70`, (2) no unresolved `HIGH` severity void codes exist, and (3) at least 1 qualified expert matches the footprint. `[APP]`

**BR-ELI-07 — Self-Correcting Spec Auto-Return Routing.**  
When the Stage 5 quality gate fails, `elicitation_sessions.state` becomes `RETURNED` and `current_stage` is updated to the specific failing stage (mapped via `void_code`). A `SPEC_AUTO_RETURN` decision is logged in `platform_decisions`. `[APP]`

**BR-ELI-08 — Atomic Project Creation on Quality Gate Pass.**  
When Stage 5 passes, a single atomic database transaction creates the `projects` row, marks `elicitation_sessions.state = 'COMPLETED'`, links `tech_team_profiles.linked_project_id`, and logs a `PUBLISHED` platform decision. `[DB: atomic TX]`

**BR-ELI-09 — Stage 4 Auto-Save Draft Endpoint.**  
`PATCH /elicitation/sessions/:id/stage4-draft` persists incremental technical form edits into `stage4_draft_json` without advancing session stage, enabling loss-free auto-save. `[APP]`

**BR-ELI-10 — Session Reversion Stage Constraints.**  
`PUT /elicitation/sessions/:id/revert` permits rewinding `current_stage` to an earlier index (1–4). Forward reverting is blocked. `[APP]`

**BR-ELI-11 — Single Active Session Constraint.**  
A CEO user can have at most one elicitation session in `IN_PROGRESS` state at any given time. Calling `POST /elicitation/sessions` returns the active session if one exists. `[APP]`

**BR-ELI-12 — Stage 4 AI Recommendation Fallback.**  
`POST /elicitation/sessions/:id/stage4-recommend` generates recommended technical context (stack, integration, volume) based on Stage 1–3 inputs for non-technical CEOs. `[APP]`

**BR-ELI-13 — Session Hard Deletion Restriction.**  
`DELETE /elicitation/sessions/:id` is permitted only if `state != 'COMPLETED'`. Sessions already published as projects cannot be deleted. `[APP]`

---

## 7. Expert Profile & Capability (BR-EXP & BR-VER)

**BR-EXP-01 — Domain Depth Uniqueness Constraint.**  
Each expert can hold at most one domain depth record per domain code (`@@unique([expertId, domainCode])` on `expert_domain_depths`). `[DB: UNIQUE]` `[SRS]`

**BR-EXP-02 — Seam Claim Uniqueness Constraint.**  
Each expert can hold at most one seam claim record per seam code (`@@unique([expertId, seamCode])` on `expert_seam_claims`). `[DB: UNIQUE]` `[SRS]`

**BR-EXP-03 — Tier 2 Automatic Upgrade via Portfolio Evidence.**  
Submitting portfolio evidence (`POST /portfolio-submissions`) triggers FastAPI `/llm/portfolio-eval`. If `passed_boolean = true` (confidence score ≥ 0.85 threshold), `expert_seam_claims.verification_tier` upgrades automatically from `CLAIMED` to `EVIDENCE_BACKED`. `[APP]` `[SRS]`

**BR-EXP-04 — Cooldown Lockout after 5 Rejections.**  
If an expert accumulates 5 failed portfolio evaluations on a seam claim (`submission_count >= 5`), the claim enters a 30-day lockout period (`locked_until = now() + 30 days`). New evidence submissions during lockout return 429 Too Many Requests. `[APP]` `[SRS]`

**BR-VER-01 — Bounded Domain Depths.**  
`expert_domain_depths.depth_level CHECK IN ('SURFACE','OPERATIONAL','DEEP')`. `[DB: CHECK]`

**BR-VER-02 — Bounded Verification Tiers.**  
`expert_seam_claims.verification_tier CHECK IN ('CLAIMED','EVIDENCE_BACKED')`. `[DB: CHECK]`

**BR-VER-03 — Expert Pro Gate for Tier 2 Portfolio Submission.**  
`POST /portfolio-submissions` requires `users.subscription_expert_tier = 'pro'`. Free-tier experts cannot submit evidence for Tier 2 upgrade. `[ROUTE]`

**BR-VER-04 — Seam Sync Protection for Historical Claims.**  
Experts cannot remove seam claims that have prior evaluation submissions (`submissionCount > 0`). Attempts to drop historically evaluated claims via `PUT /expert-profile/seams/sync` are rejected. `[APP]`

**BR-VER-05 — Domain Sync Synchronization.**  
`PUT /expert-profile/domains/sync` updates an expert's domain proficiency records in an atomic transaction, replacing omitted non-locked domains while preserving claim integrity. `[APP]`

---

## 8. Projects & Composite Matching (BR-PRJ & BR-MAT)

**BR-PRJ-01 — Published State Requirement for Bidding.**  
A project must be in `PUBLISHED` state for an expert to submit a bid. Bidding on projects in `DRAFT`, `RETURNED_TO_CLIENT`, or `SUSPENDED` states is blocked with 422 Unprocessable Entity. `[APP]` `[SRS]`

**BR-PRJ-02 — Shortlist Eligibility Guard.**  
Only experts present in `project_shortlist_cache.results_json` for a given project are eligible to submit bids. Non-shortlisted expert bids are rejected with 403 Forbidden. `[ROUTE]` `[APP]` `[SRS]`

**BR-PRJ-03 — Self-Exclusion Rule.**  
A project's client owner (`projects.client_id`) cannot bid on their own project, even if operating under an active EXPERT role context. `[APP]` `[SRS]`

**BR-PRJ-04 — Expert Pro Tier Gate for Tier 2 & Tier 3 Projects.**  
Experts bidding on projects classified as `TIER_2` or `TIER_3` volume tiers must hold `subscription_expert_tier = 'pro'`. Free-tier experts are restricted to `TIER_1` projects. `[ROUTE]` `[APP]` `[SRS]`

**BR-PRJ-05 — Single Active Engagement per Expert-Project Pair.**  
An expert who holds an active or pending engagement (`state NOT IN ('DECLINED', 'CANCELLED')`) on a project cannot create a second engagement or submit another bid for that project. `[APP]` `[SRS]`

**BR-PRJ-06 — CEO Shortlist Force Refresh.**  
The CEO can trigger a manual re-scoring of candidate experts via `GET /matching/:projectId/shortlist?refresh=true`. This evicts the cache and re-runs matching with `source = 'FORCE_REFRESH'`. `[APP]` `[SRS]`

**BR-MAT-01 — 5-Dimension Composite Score Formula.**  
Matching ranks candidate experts using the exact weighted composite formula:  
$$\text{Score} = 0.40(S) + 0.25(D) + 0.20(P) + 0.10(A) + 0.05(E)$$  
Where $S$ = Seam Alignment (criticality-weighted), $D$ = Domain Depth Match, $P$ = Portfolio Quality, $A$ = Archetype History Match, $E$ = Engagement Model Fit (1.0). `[APP]`

**BR-MAT-02 — Seam Criticality Weights.**  
Seam coverage weight factors: `load_bearing` = 3.0, `significant` = 2.0, `contributing` = 1.0. `[APP]`

**BR-MAT-03 — Claimed vs Verified Seam Confidence Multipliers.**  
In match scoring, an expert's seam claim contributes a confidence multiplier of 1.0 if `EVIDENCE_BACKED` and 0.5 if `CLAIMED`. Unclaimed seams contribute 0.0. `[APP]`

**BR-MAT-04 — Hard Gate Claimed-to-Verified Ratio (4:1).**  
Among seams relevant to a project, if an expert's ratio of `CLAIMED` to `EVIDENCE_BACKED` seams exceeds 4.0 (4:1) *and* `evidence_backed_count > 0`, the expert is hard-filtered from the shortlist. `[APP]`

**BR-MAT-05 — Match Strength Label Boundaries.**  
Match composite scores map to qualitative labels:  
- `STRONG_MATCH`: score ≥ 0.85  
- `GOOD_MATCH`: 0.70 ≤ score < 0.85  
- `POSSIBLE_MATCH`: 0.55 ≤ score < 0.70  
- `WEAK_MATCH`: score < 0.55  
Raw numeric scores are stripped before returning responses to frontends. `[APP]`

---

## 9. Information Release & Artifact Protection (BR-ART)

**BR-ART-01 — Public Visibility of Artifact A.**  
`projects.artifact_a_json` (business intent, scope tags, high-level requirements) is accessible to matched shortlisted experts prior to bidding (`GET /projects/:id/artifact-a`). `[ROUTE]`

**BR-ART-02 — 4-Condition Gate for Artifact B Access.**  
`GET /projects/:id/artifact-b` grants access to `artifact_b_json` (deep technical spec, schemas, architecture) if and only if ALL 4 conditions are met simultaneously:  
1. `engagements.state IN ('CONNECTED', 'ACTIVE')`  
2. `capability_bids.state IN ('TECH_APPROVED', 'CEO_REVIEW', 'SELECTED')`  
3. `engagements.expert_nda_accepted_at IS NOT NULL`  
4. `engagements.client_nda_accepted_at IS NOT NULL`  
Evaluated via FastAPI `check_artifact_b_access`. `[ROUTE]` `[APP]`

**BR-ART-03 — Permanent CEO Exclusion from Artifact B.**  
Client CEOs (`activeRole = 'CLIENT'`, `clientSubtype = 'CEO'`) are permanently blocked from requesting Artifact B. Attempts return 403 Forbidden. `[ROUTE]`

**BR-ART-04 — Dual NDA Signature Requirement for Engagement Connection.**  
An engagement transitions from `PENDING` to `CONNECTED` automatically when both `client_nda_accepted_at` and `expert_nda_accepted_at` timestamps are non-null. `[APP]`

**BR-ART-05 — Automatic Release of Staged Pay-Gated Documents.**  
Pay-gated documents uploaded before milestone funding receive `release_state = 'STAGED'`. When the milestone payment is confirmed via IPN, all staged documents for that milestone transition atomically to `RELEASED`. `[APP]` `[DB: atomic TX]`

**BR-ART-06 — Role Restrictions on Pay-Gated Documents.**  
`GET /milestones/:id/paygated-docs` permits download access only to the assigned Expert, linked Tech Team members, or Admins. CEOs are permanently excluded. `[ROUTE]`

**BR-ART-07 — Non-Blocking Bank Account Setup Prompt.**  
When an Expert accepts an NDA connection without a linked bank account (`sepay_bank_account_xid IS NULL`), the API response includes `prompt_bank_link = true`. Connection proceeds, but payout warnings are surfaced. `[APP]`

---

## 10. Bids & Commercial Negotiations (BR-BID)

**BR-BID-01 — Commercial Party Restriction.**  
Only the Client CEO (`clientSubtype = 'CEO'`) and the assigned Expert can conduct commercial pricing negotiations. Tech Team members are excluded from pricing actions. `[ROUTE]` `[SRS]`

**BR-BID-02 — Expert Bid Withdrawal Window.**  
An Expert can withdraw a bid (`DELETE /bids/:id`) only while it is in `SUBMITTED` or `TECH_REVIEW` state. Withdrawal updates bid state to `WITHDRAWN` and engagement state to `DECLINED`. `[APP]` `[SRS]`

**BR-BID-03 — Tech Team Approval Precondition for Non-Self-Technical Bids.**  
For projects where `self_technical = false`, a bid must receive `techStatus = 'APPROVED'` from the linked Tech Team (`PUT /bids/:id/tech-review`) before advancing to CEO review. `[APP]` `[SRS]`

**BR-BID-04 — Automatic Tech Review Bypass for Self-Technical Projects.**  
When `project.self_technical = true`, the Tech Team review stage is automatically bypassed: `techStatus` is set to `APPROVED` upon bid submission, routing the bid directly to the CEO. `[APP]` `[SRS]`

**BR-BID-05 — Recipient-Only Offer Acceptance Rule.**  
In multi-round offer negotiations, an offer can only be accepted or declined by the recipient role (`recipientRole`); the proposer role (`proposerRole`) cannot accept their own offer. `[APP]` `[SRS]`

**BR-BID-06 — Concurrency Protection via Serializable Transactions.**  
All bid creation, counter-offer, and acceptance mutations execute under PostgreSQL `Serializable` transaction isolation with up to 3 automatic retries to prevent race conditions during concurrent negotiation actions. `[DB: Serializable TX]` `[SRS]`

**BR-BID-07 — Restricted Technical View for Tech Team.**  
When a Tech Team member views a bid (`GET /bids/:id`), commercial pricing, financial offer history, and total contract amounts are hidden from the response payload. `[APP]` `[SRS]`

**BR-BID-08 — Immutability of Accepted Contract Terms.**  
When a bid offer is accepted (`SELECTED` state), the agreed milestone framework, deliverables, criteria, and prices become permanently locked (`termsLocked = true`). Subsequent modifications are blocked with 409 Conflict. `[APP]` `[SRS]`

**BR-BID-09 — Technical Scope Revision Triggers Re-Review.**  
If a counter-offer alters technical deliverables, criteria, or stack tags on a non-self-technical project, `techStatus` resets to `PENDING` and `state` reverts to `TECH_REVIEW`. `[APP]`

**BR-BID-10 — Single Selected Bid per Project.**  
Accepting a bid for a project automatically marks all competing active bids for the same project as `DECLINED` and sets their parent engagements to `DECLINED`. `[APP]` `[DB: atomic TX]`

**BR-BID-11 — Versioned Negotiation Envelope Structure.**  
Bid negotiation history is stored in `conditional_pricing_json` as a versioned JSON envelope (`formatVersion: 1`, array of offers, `currentOfferId`, `acceptedOfferId`, `technicalReview` metadata). `[DB: JSONB]`

---

## 11. Engagements (BR-ENG)

**BR-ENG-01 — Mutual NDA Acceptance Rule.**  
An engagement transitions from `PENDING` to `CONNECTED` if and only if both `client_nda_accepted_at` and `expert_nda_accepted_at` are non-null. Duplicate signing attempts return 409 Conflict. `[APP]` `[SRS]`

**BR-ENG-02 — Expert Connection Recline Scope.**  
Only the assigned Expert can decline a connection request (`PUT /engagements/:id/decline`), and only while the engagement is in `PENDING` state. `[APP]` `[SRS]`

**BR-ENG-03 — Cancellation Block during Active Milestone Execution.**  
An engagement cannot be cancelled (`PUT /engagements/:id/cancel`) if any of its milestones are currently in `FUNDED`, `SUBMITTED`, or `IN_REVISION` state. Active milestones must be resolved first. `[APP]` `[SRS]`

**BR-ENG-04 — Bank Hub Prompt Flag.**  
If the Expert has no linked bank account at NDA acceptance, `acceptConnect` includes `prompt_bank_link: true` in the API response. `[APP]` `[SRS]`

**BR-ENG-05 — Tech Team Project Isolation.**  
Tech Team members can view and access only engagements whose `projectId` matches their profile's `linked_project_id`. `[ROUTE]` `[SRS]`

---

## 12. Milestones (BR-MIL)

**BR-MIL-01 — CEO Ownership Gate for Milestone Management.**  
Only the Client CEO who owns the parent engagement can create (`POST /milestones`), edit (`PATCH /milestones/:id`), delete (`DELETE /milestones/:id`), or bulk-initialize (`POST /milestones/bulk`) milestones. `[ROUTE]` `[SRS]`

**BR-MIL-02 — Non-Empty Criteria Requirement.**  
A milestone must contain at least one acceptance criterion upon creation. Submitting a milestone with an empty criteria array is rejected with 400 Bad Request. `[APP]` `[SRS]`

**BR-MIL-03 — Positive Payment Amount Requirement.**  
Milestone `payment_amount_vnd` must be greater than zero (`CHECK (payment_amount_vnd >= 0)`). Zero or negative payment amounts are rejected. `[DB: CHECK]` `[APP]` `[SRS]`

**BR-MIL-04 — Milestone Number Uniqueness per Engagement.**  
Milestone numbers must be unique within a single engagement (`@@unique([engagementId, milestoneNumber])` on `milestones`). Duplicates return 409 Conflict. `[DB: UNIQUE]` `[SRS]`

**BR-MIL-05 — Tech Team Handoff Precondition for Non-Self-Technical Milestones.**  
For non-self-technical projects, the invited Tech Team member must complete their handoff registration before milestones can be created or bulk-initialized. `[APP]` `[SRS]`

**BR-MIL-06 — One-Time Bulk Initialization Gate.**  
`POST /milestones/bulk` can be called only once per engagement. If any instantiated milestones already exist in the database, bulk initialization is blocked with 409 Conflict. `[APP]` `[SRS]`

**BR-MIL-07 — Asynchronous Criterion Quality Gate Evaluation.**  
Newly created acceptance criteria asynchronously trigger FastAPI `/llm/criterion-check`. Criteria containing subjective or unmeasurable wording log an advisory `CRITERION_QUALITY_GATE` entry in `platform_decisions` without blocking milestone creation. `[APP]` `[SRS]`

**BR-MIL-08 — Programmatic Sign-Off Authority Derivation.**  
Milestone `signOffAuthority` is derived automatically: `CEO` if the project is `selfTechnical = true`; `JOINT` if `selfTechnical = false` (requiring both Tech Team and CEO verification). `[APP]` `[SRS]`

**BR-MIL-09 — Automatic Default Criterion for Service Purchases.**  
For `SERVICE_PURCHASE` and `TECH_DISCOVERY` engagements, if milestone #1 has no explicit criteria, a default acceptance criterion referencing the service title is auto-created. `[APP]` `[SRS]`

**BR-MIL-10 — Funding Virtual Account Generation.**  
Initiating milestone funding (`PUT /milestones/:id/fund`) creates a 24-hour virtual account (`entity_type = 'MILESTONE'`, `fixed_amount = payment_amount_vnd`) and transitions milestone state to `AWAITING_PAYMENT`. `[APP]` `[SRS]`

**BR-MIL-11 — Active Payment Window Protection.**  
A milestone in `AWAITING_PAYMENT` state with an unexpired active VA (`expires_at > now()`) cannot regenerate a new VA. The client must pay using the existing QR code or wait for expiration. `[APP]` `[SRS]`

**BR-MIL-12 — Post-Acceptance Term Lock.**  
Once a bid offer is accepted, milestone terms (deliverable statement, payment amount) are locked via the negotiation envelope. Attempts to edit locked terms return 409 Conflict. `[APP]` `[SRS]`

---

## 13. Deliverables, Criteria & Definition of Done (BR-DEL, BR-ACC & BR-DOD)

**BR-DEL-01 — Assigned Expert Submission Restriction.**  
Only the Expert assigned to the parent engagement can submit deliverables for a milestone (`POST /milestones/:id/submit`). `[ROUTE]` `[SRS]`

**BR-DEL-02 — Milestone State Precondition for Deliverables.**  
Deliverable submission is accepted only when the milestone is in `FUNDED`, `IN_PROGRESS`, or `IN_REVISION` state. Submissions from other states are rejected with 422 Unprocessable Entity. `[APP]` `[SRS]`

**BR-DEL-03 — Mandatory Required DoD Checklist Gate.**  
All required Definition of Done items (`isRequired = true`) must be in `status = 'COMPLETED'` before a deliverable submission is accepted. Unfinished required items return 422 `REQUIRED_DOD_INCOMPLETE` with a list of missing items. `[APP]` `[SRS]`

**BR-DEL-04 — Submission Retraction State Restriction.**  
The assigned Expert can retract a submitted deliverable (`DELETE /milestones/:id/submissions/latest`) only while the milestone is in `SUBMITTED` state. `[APP]` `[SRS]`

**BR-DEL-05 — Submission Retraction Reversal.**  
Retracting a submission deletes the latest `milestone_submissions` row, reverts milestone state to `IN_PROGRESS`, and notifies the client via WebSocket. `[APP]` `[SRS]`

**BR-DEL-06 — Pay-Gated Document Access Security.**  
Pay-gated deliverable documents (`paygated_documents`) in `RELEASED` status can be downloaded (`GET /milestones/:id/paygated-docs`) only by the assigned Expert, linked Tech Team members, or Admins. CEOs are blocked. `[ROUTE]` `[SRS]`

**BR-DEL-07 — Pre-Funding Staging Status.**  
Documents uploaded prior to escrow funding receive `releaseState = 'STAGED'`. Documents uploaded after escrow funding are set to `RELEASED` immediately. `[APP]` `[SRS]`

**BR-ACC-01 — Unverified Precondition for Dispute Filing.**  
A dispute can be filed against an acceptance criterion if and only if `verifiedAt IS NULL`. Criteria already signed off cannot be disputed. `[APP]` `[SRS]`

**BR-ACC-02 — Role-Gated Criterion Sign-Off.**  
`PUT /criteria/:id/verify` verifies a criterion for the calling role: Tech Team sets `techVerifiedAt = now()`; CEO sets `ceoVerifiedAt = now()` and `verifiedAt = now()`. `[ROUTE]` `[APP]`

**BR-ACC-03 — Revision Request Feedback Length Requirement.**  
Requesting criterion revision (`PUT /criteria/:id/revision`) requires a feedback note of at least 10 characters (`revision_note`). It clears verification timestamps and sets milestone state to `IN_REVISION`. `[APP]`

**BR-ACC-04 — Full Verification Triggers Milestone Approval.**  
When all required criteria on a milestone have `verifiedAt IS NOT NULL` and no active disputes exist, the milestone automatically transitions to `APPROVED` and triggers escrow release. `[APP]`

**BR-DOD-01 — Database Check Constraint on Required DoD Items.**  
`CONSTRAINT dod_required_cannot_be_na CHECK (NOT (is_required = TRUE AND status = 'NOT_APPLICABLE'))` is enforced at the database level. `[DB: CHECK]` `[SRS]`

**BR-DOD-02 — Completion Note Requirement for Completed Required DoD Items.**  
Marking a required DoD item as `COMPLETED` requires a non-empty `completion_note`. `[APP]`

**BR-DOD-03 — Explanation Note Requirement for N/A DoD Items.**  
Marking an optional DoD item as `NOT_APPLICABLE` requires a non-empty `not_applicable_note`. `[APP]`

**BR-DOD-04 — Role Restrictions on DoD Editing.**  
Only the assigned Expert or CEO can create or update DoD checklist items. Tech Team members have read-only access to DoD checklists. `[ROUTE]`

**BR-DOD-05 — Deletion Restriction for Actioned DoD Items.**  
DoD items can be deleted (`DELETE /milestones/:id/dod/:itemId`) only while in `PENDING` status. Completed or N/A items cannot be deleted. `[APP]`

**BR-DOD-06 — Bulk DoD Creation Atomicity.**  
`POST /milestones/:id/dod/items/bulk` creates multiple DoD items atomically within a single transaction. `[DB: atomic TX]`

---

## 14. Escrow & Dispute Resolution (BR-DIS & BR-ESC)

**BR-DIS-01 — Unverified Criterion Dispute Anchor.**  
A dispute (`POST /disputes`) must anchor to an unverified criterion (`criterion_id` where `verifiedAt IS NULL`). `[APP]` `[SRS]`

**BR-DIS-02 — Milestone State Precondition for Disputes.**  
A dispute can be filed only when the parent milestone is in `SUBMITTED` or `IN_REVISION` state. `[APP]` `[SRS]`

**BR-DIS-03 — Engagement Party Restriction.**  
Disputes can be filed only by an authenticated party to the engagement (Client CEO or Expert). Third parties and unlinked users are blocked. `[ROUTE]` `[SRS]`

**BR-DIS-04 — Held Escrow Precondition.**  
Filing a dispute requires the milestone's escrow account to exist in `HELD` status. `[APP]` `[SRS]`

**BR-DIS-05 — Atomic Escrow Freeze on Dispute Filing.**  
Filing a dispute atomically transitions `escrow_accounts.status` to `FROZEN` and `milestones.state` to `DISPUTED` within a single database transaction. `[DB: atomic TX]` `[SRS]`

**BR-DIS-06 — 80% AI Confidence Auto-Resolution Threshold.**  
FastAPI `/llm/dispute-eval` evaluates disputes. If `confidence_score >= 0.80`, the dispute state becomes `AUTO_RESOLVED` and escrow settlement executes automatically without human admin intervention. `[APP]` `[SRS]`

**BR-DIS-07 — Manual Admin Escalation for Low Confidence.**  
If AI `confidence_score < 0.80`, the dispute transitions to `MANUAL_REVIEW` state and appears in the Admin Dispute Monitor queue for human resolution. `[APP]` `[SRS]`

**BR-DIS-08 — AI Unavailability Fallback to Manual Review.**  
If the AI evaluation service is unreachable during dispute filing, the dispute safely defaults to `LAYER_1_EVAL` state with escrow remaining `FROZEN` until admin review. `[APP]` `[SRS]`

**BR-DIS-09 — EXPERT_WINS Dispute Settlement.**  
`EXPERT_WINS` decision: marks disputed criterion verified, unfreezes escrow to `HELD` (or releases payment if all criteria are satisfied), and transitions milestone to `APPROVED`. `[APP]` `[SRS]`

**BR-DIS-10 — CLIENT_WINS Dispute Settlement.**  
`CLIENT_WINS` decision: refunds full escrowed amount to client's `available_balance` (`ESCROW_REFUND` ledger entry) and updates escrow status to `REFUNDED`. `[APP]` `[SRS]`

**BR-DIS-11 — SPLIT Dispute Settlement.**  
`SPLIT` decision: divides escrowed amount 50/50 between client and expert (`ESCROW_SPLIT` ledger entries) and updates escrow status to `SPLIT`. `[APP]` `[SRS]`

**BR-DIS-12 — Resolution State Guard.**  
A dispute can be resolved (by AI auto-resolution or Admin) only while in `LAYER_1_EVAL` or `MANUAL_REVIEW` state. Already-resolved disputes cannot be re-resolved. `[APP]` `[SRS]`

**BR-ESC-01 — Dual-Parent Parent Exclusivity Constraint.**  
`CONSTRAINT escrow_has_one_parent CHECK ((milestone_id IS NOT NULL AND engagement_id IS NULL) OR (milestone_id IS NULL AND engagement_id IS NOT NULL))` is enforced at the database level. `[DB: CHECK]`

**BR-ESC-02 — Partial Unique Indexes on Escrow Parents.**  
`CREATE UNIQUE INDEX escrow_milestone_unique ON escrow_accounts(milestone_id) WHERE milestone_id IS NOT NULL` and `CREATE UNIQUE INDEX escrow_engagement_unique ON escrow_accounts(engagement_id) WHERE engagement_id IS NOT NULL`. `[DB: UNIQUE INDEX]`

**BR-ESC-03 — Frozen Escrow Lock.**  
No release, refund, or split operation can execute on an escrow account while its status is `FROZEN`, except through formal dispute resolution functions. `[APP]`

---

## 15. Messaging & Notifications (BR-MSG & BR-NOT)

**BR-MSG-01 — Mutually Exclusive Message Scope.**  
A message record in `messages` must be scoped to either an engagement (`engagement_id`) or a project (`project_id`), but never both. `[APP]`

**BR-MSG-02 — Party Access Control on Chat Threads.**  
Users can access messages only for engagements where they are client, expert, or linked Tech Team member (`linked_project_id`). `[ROUTE]`

**BR-MSG-03 — Atomic Message Read Receipts.**  
Marking messages as read (`POST /conversations/:engagementId/read`) uses `createMany` with `skipDuplicates: true` on `message_reads` (`@@unique([messageId, userId])`). `[DB: UNIQUE]` `[APP]`

**BR-MSG-04 — Real-Time WebSocket Mirroring.**  
All chat messages and status updates emitted over Socket.io are persisted to PostgreSQL before broadcast, ensuring messages survive page refreshes. `[APP]`

**BR-MSG-05 — Attachment URL Validation.**  
Optional message attachments (`attachment_url`) must be valid HTTP/HTTPS URLs. `[APP]`

**BR-NOT-01 — Dual Emission & DB Persistence.**  
System events (bids, milestone updates, payments, disputes) write a record to `notifications` table AND emit a `notification:generic` WebSocket event to the target user's personal channel. `[APP]`

**BR-NOT-02 — Role-Aware Notification Link Resolution.**  
Notification link paths are dynamically resolved based on the recipient's active role and subtype (e.g. mapping `/engagements/:id` to `/expert/inbox/:id` or `/ceo/engagements/:id/milestones`). `[APP]`

---

## 16. Reviews & Reputation (BR-REV)

**BR-REV-01 — Closed Engagement Precondition for Reviews.**  
Reviews (`POST /reviews`) can be submitted only after the engagement has reached `CLOSED` state. Unclosed engagement review attempts return 409 Conflict. `[APP]` `[SRS]`

**BR-REV-02 — Single Review per Reviewer-Engagement Pair.**  
Each participant can submit at most one review per engagement (`@@unique([engagementId, reviewerId])` on `reviews`). Duplicate attempts return 409 Conflict. `[DB: UNIQUE]` `[SRS]`

**BR-REV-03 — CEO Review Subject Restriction.**  
CEO reviewers (`reviewerRole = 'CEO'`) can target only the assigned Expert of that engagement as the review subject (`target_id = engagement.expert_id`). `[APP]` `[SRS]`

**BR-REV-04 — Expert Review Subject Restriction.**  
Expert reviewers (`reviewerRole = 'EXPERT'`) can target only the Client CEO of that engagement as the review subject (`target_id = engagement.client_id`). `[APP]` `[SRS]`

**BR-REV-05 — Mandatory Structured Signals for Tech Team Reviews.**  
Tech Team reviewers (`reviewerRole = 'TECH_TEAM'`) must supply valid `structuredSignalsJson` (code quality, communication, per-seam ratings, recommendation flag). Submissions without structured signals are rejected with 400 Bad Request. `[APP]` `[SRS]`

**BR-REV-06 — Bounded 1–5 Integer Star Rating.**  
Review star ratings must be an integer between 1 and 5 inclusive (`CHECK (rating BETWEEN 1 AND 5)`). `[DB: CHECK]` `[SRS]`

**BR-REV-07 — Tech Team Linkage Precondition for Reviews.**  
Tech Team members must be verified as linked to the engagement's project via `tech_team_profiles.linked_project_id` before their review is accepted. `[APP]` `[SRS]`

---

## 17. Admin Governance, CMS & System Invariants (BR-ADM & BR-INT)

**BR-ADM-01 — Admin Account Provisioning.**  
ADMIN role users cannot be created via public registration. Admin accounts are provisioned via database seed scripts only (`SEED_ADMIN_PASSWORD`). `[APP]`

**BR-ADM-02 — Emergency Project Spec Suspension.**  
`PUT /admin/projects/:id/suspend-spec` updates project state to `SUSPENDED` and logs a `SPEC_AUTO_RETURN` entry in `platform_decisions`. Reopening uses `PUT /admin/projects/:id/reopen`. `[APP]`

**BR-ADM-03 — User Account Suspension & Reactivation.**  
Admin can suspend users (`PUT /admin/users/:id/suspend` → `is_active = false`) or reactivate them (`PUT /admin/users/:id/reactivate` → `is_active = true`). Suspended users are blocked from logging in. `[APP]`

**BR-ADM-04 — Dynamic CMS Configuration Endpoints.**  
Admins manage CMS entities via `/admin/config/*` endpoints (Domains, Seams, Archetypes, Probe Questions, Void Codes). Endpoints under `/config/*` serve active CMS data to public and client frontends. `[APP]`

**BR-ADM-05 — Hot-Reloadable Prompt Template Overrides.**  
Admins edit AI stage prompts via `PUT /admin/prompts/:stage`. Saved templates in `prompt_templates` override on-disk `.txt` files and are fetched by FastAPI with a 60-second TTL cache. Deleting a template (`DELETE /admin/prompts/:stage`) reverts to on-disk defaults. `[APP]`

**BR-ADM-06 — Platform Settings Maintenance.**  
Admins configure platform fee percentage and platform wallet via `PUT /admin/platform-settings`. `platform_fee_pct` must be in range `[0, 1]`. `[APP]`

**BR-ADM-07 — Subscription Package CRUD & Deletion Protection.**  
Admins manage subscription plans via `/admin/subscriptions/packages`. Packages with existing purchase history (`subscription_purchase_logs`) cannot be deleted (`DELETE` returns 422); they must be deactivated (`isActive = false`) instead. `[APP]`

**BR-INT-01 — Universal UUID v4 Primary Keys.**  
All entity primary keys use UUID v4 generated via `gen_random_uuid()` (except 1:1 extension tables using `user_id` PK). `[DB]`

**BR-INT-02 — Timestamptz (UTC) Standard.**  
All date/time columns use PostgreSQL `TIMESTAMPTZ` stored in UTC. `[DB]`

**BR-INT-03 — Non-Negative Wallet Balances.**  
`CHECK (available_balance >= 0)` and `CHECK (locked_balance >= 0)` on `wallets` are enforced at the database level. `[DB: CHECK]`

**BR-INT-04 — Positive Transaction & Escrow Amounts.**  
`CHECK (amount > 0)` on `wallet_transactions` and `escrow_accounts`. Zero or negative monetary amounts are rejected at the DB level. `[DB: CHECK]`

**BR-INT-05 — Engagement Type FK Consistency.**  
`CONSTRAINT engagement_type_fk CHECK ((type = 'PROJECT_BASED' AND project_id IS NOT NULL AND service_id IS NULL) OR (type IN ('SERVICE_PURCHASE','TECH_DISCOVERY') AND project_id IS NULL AND service_id IS NOT NULL))` is enforced by database check constraint. `[DB: CHECK]`

**BR-INT-06 — One-to-One Capability Bid to Engagement Relationship.**  
`capability_bids.engagement_id UNIQUE` guarantees at most one bid per engagement. `[DB: UNIQUE]`

**BR-INT-07 — One-to-One User Wallet Relationship.**  
`wallets.user_id UNIQUE` guarantees exactly one wallet per user account. `[DB: UNIQUE]`

**BR-INT-08 — Seam Definition Inverse Unique Constraint.**  
`@@unique([domainCode1, domainCode2])` on `seam_definitions` prevents duplicate or inverse seam declarations. `[DB: UNIQUE]`

**BR-INT-09 — Read-Only Write-Once Audit Tables.**  
`platform_decisions`, `subscription_purchase_logs`, and `wallet_transactions` are append-only audit tables. Application code executes `INSERT` operations only — no `UPDATE` or `DELETE` statements target these tables. `[APP]`

---

## 18. Cross-Domain Interaction Rules (BR-XD)

**BR-XD-01 — Elicitation → Shortlist Seed Chain.**  
When a project passes Stage 5 elicitation quality gates (`elicitation_sessions.state = 'COMPLETED'`), the Elicitation Service emits `project.published` via EventEmitter2. The Matching Service handles this event synchronously to populate `project_shortlist_cache` with `source = 'AUTO'`. `[APP]`

**BR-XD-02 — Shortlist → Bid Validation Chain.**  
Submitting a capability bid (`POST /bids`) validates that the Expert appears in `project_shortlist_cache` for that project. Non-shortlisted experts cannot bid. `[APP]`

**BR-XD-03 — Bid Selection → Milestone Instantiation Chain.**  
Accepting an offer (`POST /bids/:id/offers/:offerId/accept`) sets `capability_bids.state = 'SELECTED'`, locks contract terms, instantiates real `milestones` and `acceptance_criteria` rows from the accepted offer terms, and marks all competing bids on the project as `DECLINED`. `[DB: atomic TX]` `[APP]`

**BR-XD-04 — SePay IPN → Escrow Lock → Document Release Chain.**  
When SePay IPN confirms payment for a milestone VA, a single atomic database transaction: (1) locks client wallet escrow balance, (2) creates `escrow_accounts` row in `HELD` status, (3) sets `milestones.state = 'IN_PROGRESS'`, (4) marks `virtual_accounts.status = 'USED'`, and (5) releases all staged `paygated_documents` for that milestone (`releaseState = 'RELEASED'`). `[DB: atomic TX]` `[APP]`

**BR-XD-05 — Required DoD Gate → Deliverable Submission Chain.**  
Expert deliverable submission (`POST /milestones/:id/submit`) validates that 100% of required DoD checklist items (`isRequired = true`) have `status = 'COMPLETED'`. Submissions with incomplete required DoD items are rejected. `[APP]`

**BR-XD-06 — Full Verification → Milestone Approval → Escrow Release Chain.**  
When the final required acceptance criterion on a milestone is verified, NestJS executes `releaseMilestoneWithTx` in a single transaction: calculates platform fee, credits platform wallet, credits net payout to expert wallet, updates escrow status to `RELEASED`, sets milestone state to `APPROVED`, and if the expert has a linked bank account, creates an auto `MILESTONE_RELEASE` withdrawal request. `[DB: atomic TX]` `[APP]`

**BR-XD-07 — Final Milestone Release → Engagement Closure Chain.**  
When the final milestone of an engagement reaches `APPROVED` / `RELEASED` status and zero unreleased milestones remain, the parent engagement state automatically transitions to `CLOSED`, unlocking post-engagement peer reviews (`POST /reviews`). `[APP]`

**BR-XD-08 — Dispute Filing → Escrow Freeze Chain.**  
Filing a dispute (`POST /disputes`) against an unverified criterion atomically sets `escrow_accounts.status = 'FROZEN'`, transitions `milestones.state = 'DISPUTED'`, and calls FastAPI `/llm/dispute-eval` for Layer 1 AI arbitration. `[DB: atomic TX]` `[APP]`

**BR-XD-09 — Portfolio Pass → Seam Tier Upgrade Chain.**  
Passing an AI portfolio evidence evaluation (`POST /portfolio-submissions` with confidence ≥ 0.85) automatically upgrades `expert_seam_claims.verification_tier` from `CLAIMED` to `EVIDENCE_BACKED` and logs a `SEAM_TIER_UPGRADE` entry in `platform_decisions`. `[APP]`

**BR-XD-10 — Direct Service Purchase → Instant Engagement Activation Chain.**  
Purchasing a marketplace service (`POST /services/:id/purchase`) generates a service VA. On IPN payment confirmation, an atomic transaction creates milestone #1 with a default criterion, locks escrow, creates a shadow project record, and sets engagement state directly to `ACTIVE`, bypassing bid negotiation and NDA steps. `[DB: atomic TX]` `[APP]`

**BR-XD-11 — CMS Config Update → Live AI System Propagation.**  
CMS updates to prompt templates, domain definitions, seam boundaries, archetypes, and void codes take effect dynamically across the AI service without requiring application redeployments or container restarts. `[APP]`