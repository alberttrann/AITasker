# AITasker Platform — Main Flows (Scope-Expanded · 40 Tables · 213 Endpoints)
### Cross-Table CRUD Grounding · State Machines · Endpoint Mapping

> **Purpose:** Definitive flow reference grounded directly against the running `backend/src/` code, `prisma/schema.prisma` (40 tables), `ai-service/`, and the 213 NestJS endpoints as of July 2026. Every step traces to a real controller, service method, DTO, or SQL migration.  
> **Conventions:** `[LEDGER]` = wallet_transactions row written. `[API]` = external service call. Tables in **bold** on first reference. `[Pro-C]` / `[Pro-E]` = Client Pro / Expert Pro subscription gate enforced by `SubscriptionGuard`. `[WS]` = WebSocket event emitted.

---

## Table of Contents

1. [Group 1: Onboarding & Identity](#group-1--onboarding--identity)
   - MF-1: CEO Registration, Wallet Top-up & Subscription
   - MF-2: Expert Registration, Profile & Tier 1 Claims
   - MF-3: Tech Team Account Creation via Handoff Link
   - MF-4: Password Reset & Account Security
   - MF-5: Bank Account Linking (Expert)
2. [Group 2: AI Elicitation Engine (Path A)](#group-2--ai-elicitation-engine-path-a)
   - MF-6: Stages 1-3 (Symptom, Archetype, Probe)
   - MF-7: Stage 4 (Tech Context & Handoff)
   - MF-8: Stage 5 (Synthesis & Auto-Publish)
3. [Group 3: Expert Marketplace & Matching](#group-3--expert-marketplace--matching)
   - MF-9: Expert Profile Tier 2 Upgrade (Portfolio Auto-Eval)
   - MF-10: AI Matching & Shortlisting
   - MF-11: Service Listing Creation (Path B) with AI Assist
   - MF-12: Inviting Experts to Bid
4. [Group 4: Bidding & Engagement](#group-4--bidding--engagement)
   - MF-13: Pre-Bid Q&A and Bid Submission
   - MF-14: Tech Team Bid Review
   - MF-15: CEO Bid Review & Counter-Offer
   - MF-16: NDA Acceptance & Engagement Connection
   - MF-17: Service Purchase (Path B) Direct Engagement
5. [Group 5: Milestone Execution & Escrow](#group-5--milestone-execution--escrow)
   - MF-18: Milestone Definition & AI Quality Gate
   - MF-19: Milestone Funding & Escrow Lock
   - MF-20: DoD Checklist & Deliverable Submission
   - MF-21: Pay-gated Document Release
   - MF-22: Criteria Verification & Escrow Release
   - MF-23: Milestone Chat Assistant
6. [Group 6: Dispute Resolution](#group-6--dispute-resolution)
   - MF-24: Dispute Filing & Layer 1 LLM Eval
   - MF-25: Admin Manual Dispute Resolution
7. [Group 7: Financial & Wallet Operations](#group-7--financial--wallet-operations)
   - MF-26: Expert Withdrawal Request
   - MF-27: Admin Withdrawal Management
   - MF-28: Subscription Management & History
8. [Group 8: Communication & Real-time](#group-8--communication--real-time)
   - MF-29: Real-time Messaging (Engagement vs Project)
   - MF-30: WebSocket Notifications & Badge Updates
9. [Group 9: Admin & CMS Governance](#group-9--admin--cms-governance)
   - MF-31: Platform Analytics & Oversight
   - MF-32: Dynamic CMS Management (Domains, Seams, Archetypes)
   - MF-33: Prompt Template Management
   - MF-34: Subscription Package Management
   - MF-35: User & Project Suspension
10. [Appendices](#appendices)

---

## Group 1: Onboarding & Identity

---

### MF-1: CEO Registration, Wallet Top-up & Subscription

**Overview:** Registers a CLIENT/CEO account. On `POST /auth/register`, the system atomically creates `users`, `client_profiles`, `wallets`, and one `virtual_accounts` row (entity_type=WALLET_TOPUP) using an internal VA number generator. Subscription activation is a pure internal wallet deduction.

**Tables touched (5):** `users`, `client_profiles`, `wallets`, `virtual_accounts`, `wallet_transactions`

**Endpoints:** `POST /auth/register`, `POST /wallets/virtual-accounts/topup`, `POST /webhooks/sepay/ipn`, `POST /subscriptions/activate`, `GET /subscriptions/status`, `GET /wallets/me`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO | Fill registration form | — | — | — |
| 3 | NestJS | Validate input; optional VietQR tax lookup | `users` (R — uniqueness) | — | `POST /auth/register` |
| 4 | NestJS | Atomic: user + profile + wallet + VA (local generator) | `users` (C), `client_profiles` (C), `wallets` (C), `virtual_accounts` (C) | New user: roles=["CLIENT_CEO"], active_role="CLIENT", client_subtype="CEO", sub_client_tier="free" | — |
| 5 | NestJS | Sign access_token + refresh_token (store hash) | `users` (U — refresh_token_hash) | — | — |
| 6 | CEO | Dashboard loads free tier | `wallets` (R), `users` (R) | — | `GET /wallets/me`, `GET /subscriptions/status` |
| 7-8 | CEO→NestJS | Request top-up QR; read permanent VA | `virtual_accounts` (R) | — | `POST /wallets/virtual-accounts/topup` |
| 9-11 | CEO→Bank→SePay | External bank transfer + IPN fires | — | — | External |
| 12 | NestJS | IPN: HMAC verify → parse VA → idempotency → credit wallet | `virtual_accounts` (R), `wallets` (U), `wallet_transactions` (C) | wallet.available: 0 → 500,000 | `POST /webhooks/sepay/ipn` |
| 13 | CEO | Poll wallet balance | `wallets` (R) | — | `GET /wallets/me` |
| 14-16 | CEO→NestJS | Activate subscription; debit wallet; update tier | `wallets` (U), `wallet_transactions` (C), `users` (U), `subscription_purchase_logs` (C) | available: 500K→0; sub_client_tier: free→pro | `POST /subscriptions/activate` |
| 17-18 | NestJS→CEO | Reissue JWT; client stores new token | `users` (R) | — | — |

---

### MF-2: Expert Registration, Profile & Tier 1 Claims

**Overview:** Registers an EXPERT account. Expert builds their taxonomy profile via domain depth claims and seam claims (Tier 1, self-declared, `verification_tier="CLAIMED"`).

**Tables touched (6):** `users`, `expert_profiles`, `wallets`, `virtual_accounts`, `expert_domain_depths`, `expert_seam_claims`

**Endpoints:** `POST /auth/register`, `GET /expert-profile/me`, `PUT /expert-profile/me`, `POST /expert-profile/domains`, `POST /expert-profile/seams`, `GET /expert-profile/me/domains`, `GET /expert-profile/me/seams`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-3 | Expert→NestJS | Register EXPERT account | `users` (C), `expert_profiles` (C), `wallets` (C), `virtual_accounts` (C) | active_role="EXPERT", sub_expert_tier="free" | `POST /auth/register` |
| 4 | Expert | Dashboard loads | `users` (R), `wallets` (R) | — | `GET /expert-profile/me` |
| 5-6 | Expert→NestJS | Add domain depth claim (repeatable) | `expert_domain_depths` (C) | verification_tier="CLAIMED" | `POST /expert-profile/domains` |
| 7-8 | Expert→NestJS | Add seam claim (repeatable) | `expert_seam_claims` (C) | verification_tier="CLAIMED", submission_count=0 | `POST /expert-profile/seams` |
| 9-10 | Expert→NestJS | Set engagement model + stack tags | `expert_profiles` (U) | — | `PUT /expert-profile/me` |

---

### MF-3: Tech Team Account Creation via Handoff Link

**Overview:** CEO generates a signed handoff link during Elicitation Stage 4 (Scenario B). This is the **only** way a TECH_TEAM account is created. The link encodes `sessionId`, `ceoId`, and a one-time `jti` (JWT ID). Once consumed, the JWT is invalidated.

**Tables touched (4):** `users`, `tech_team_profiles`, `wallets`, `elicitation_sessions`

**Endpoints:** `POST /elicitation/sessions/:id/generate-handoff-link`, `POST /auth/register/handoff`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Generate signed JWT handoff link; store jti; assert CEO ownership | `elicitation_sessions` (R, U — handoff_token_jti) | — | `POST /elicitation/sessions/:id/generate-handoff-link` |
| 3 | CEO | Copies and shares link externally (no platform email) | — | — | — |
| 4-5 | TECH_TEAM | Opens link, extracts sessionId from JWT, fills form | — | — | `GET /register/handoff/:token` |
| 6 | NestJS | Validate JWT (sig, expiry, purpose, jti match, single-use); register TECH_TEAM | `users` (C), `tech_team_profiles` (C), `wallets` (C), `elicitation_sessions` (U — handoff_consumed_at) | New TECH_TEAM user scoped to CEO; link consumed. `linked_project_id` set immediately if project exists. | `POST /auth/register/handoff` |
| 7 | TECH_TEAM | Tech Dashboard loads | `tech_team_profiles` (R — linked_project_id) | — | — |

---

### MF-4: Password Reset & Account Security

**Overview:** User requests a password reset. System generates a token, hashes it, and stores the hash with an expiry. User clicks the link, FE verifies the token via GET before showing the form, then submits the new password. Logout invalidates the `refresh_token_hash` server-side.

**Tables touched (1):** `users`

**Endpoints:** `POST /auth/forgot-password`, `GET /auth/verify-reset-token/:token`, `POST /auth/reset-password`, `POST /auth/logout`, `PUT /auth/me/password`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | User | Request reset link | `users` (R) | — | `POST /auth/forgot-password` |
| 2 | NestJS | Generate token, hash it, store hash + expiry (15m) | `users` (U) | password_reset_token set | — |
| 3 | User | Clicks link, FE validates token on page load | `users` (R) | — | `GET /auth/verify-reset-token/:token` |
| 4 | User | Submits new password | `users` (U) | password_hash updated, reset token cleared, refresh_token_hash nulled | `POST /auth/reset-password` |
| 5 | User | Logout (clears server hash) / Change password (also clears hash) | `users` (U) | refresh_token_hash nulled | `POST /auth/logout`, `PUT /auth/me/password` |

---

### MF-5: Bank Account Linking (Expert)

**Overview:** Expert links their bank account directly via the Bank Hub endpoint to enable withdrawals. In MVP, this does not make a real SePay API call; it stores the `sepay_bank_account_xid` placeholder for admin reference.

**Tables touched (1):** `users`

**Endpoints:** `POST /bank-hub/initiate-link`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | Expert | Enters bank_account_xid + holder_name | — | — | — |
| 2 | NestJS | Guard: sepay_bank_account_xid IS NOT NULL → 409 ALREADY. Store placeholder. | `users` (U) | sepay_bank_account_xid set, bank_linked_at set | `POST /bank-hub/initiate-link` |

---

## Group 2: AI Elicitation Engine (Path A)

---

### MF-6: Stages 1-3 (Symptom, Archetype, Probe)

**Overview:** CEO starts an elicitation session. Stage 1 uses AI for symptom extraction. Stage 2 validates the chosen archetype against `recommendedArchetypesJson`. Stage 3 uses DB-driven probe questions with a vagueness check.

**Tables touched (3):** `elicitation_sessions`, `domain_definitions`, `archetype_definitions`, `probe_questions`, `void_code_definitions`

**Endpoints:** `POST /elicitation/sessions`, `PUT /elicitation/sessions/:id/stage1`, `PUT /elicitation/sessions/:id/stage2`, `PUT /elicitation/sessions/:id/stage3`, `GET /config/archetypes/:code/probe-questions`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Start session; no subscription guard | `elicitation_sessions` (C) | state=IN_PROGRESS, current_stage=1 | `POST /elicitation/sessions` |
| 3-4 | CEO→FastAPI | Stage 1: symptom extraction; returns recommended_archetypes, voids, critical_artifacts | `elicitation_sessions` (U) | current_stage: 1→2 | `PUT .../stage1` |
| 5-7 | CEO→NestJS | Stage 2: select archetype from recommended set (422 if not in set) | `elicitation_sessions` (U — archetype) | current_stage: 2→3 | `PUT .../stage2` |
| 8-9 | CEO→FastAPI | Stage 3: DB-driven probe Qs; vagueness check. Non-technical CEOs get a more forgiving prompt. | `elicitation_sessions` (U — stage3_probes_json) | current_stage: 3→4 (only if not vague) | `PUT .../stage3` |

---

### MF-7: Stage 4 (Tech Context & Handoff)

**Overview:** CEO (if self-technical) or TECH_TEAM (via handoff) fills the Stage 4 form. Auto-saves drafts. Submits technical artifacts required from Stage 1.

**Tables touched (2):** `elicitation_sessions`, `tech_team_profiles`

**Endpoints:** `PATCH /elicitation/sessions/:id/stage4-draft`, `PUT /elicitation/sessions/:id/stage4`, `PUT /elicitation/sessions/:id/stage4-handoff`, `POST /elicitation/sessions/:id/stage4-recommend`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | CEO/TECH_TEAM | Auto-save draft (every 30s) | `elicitation_sessions` (U — stage4_draft_json) | — | `PATCH .../stage4-draft` |
| 2 | CEO/TECH_TEAM | Optional: AI recommend tech context | — | — | `POST .../stage4-recommend` |
| 3a | CEO→NestJS | Stage 4 (CEO): submit tech context + artifacts | `elicitation_sessions` (U) | current_stage: 4→5 | `PUT .../stage4` |
| 3b | TECH_TEAM→NestJS | Stage 4-handoff: submit tech context | `elicitation_sessions` (U) | current_stage: 4→5 | `PUT .../stage4-handoff` |

---

### MF-8: Stage 5 (Synthesis & Auto-Publish)

**Overview:** Stage 4 auto-chains Stage 5 synthesis. FastAPI generates the full spec. If `completeness_score >= 0.70`, project is published. Matching engine seeds cache.

**Tables touched (4):** `elicitation_sessions`, `projects`, `project_shortlist_cache`, `platform_decisions`

**Endpoints:** `POST /elicitation/sessions/:id/retry-synthesis` (if 503 timeout on auto-chain)

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | NestJS→FastAPI | Auto-chained Stage 5 synthesis | — | — | Internal `POST /llm/elicitation/stage5-synthesize` |
| 2 | NestJS | Auto-publish quality gate: `completeness_score >= 0.70` | `projects` (C), `elicitation_sessions` (U), `platform_decisions` (C) | session: IN_PROGRESS→COMPLETED or RETURNED. project: DRAFT→PUBLISHED | — |
| 3 | NestJS | Seed matching cache | `project_shortlist_cache` (C/U) | — | — |

---

## Group 3: Expert Marketplace & Matching

---

### MF-9: Expert Profile Tier 2 Upgrade (Portfolio Auto-Eval)

**Overview:** Upgrades a seam claim to Tier 2 (`EVIDENCE_BACKED`) by submitting portfolio evidence for LLM auto-evaluation. LLM dynamically fetches seam definitions from DB.

**Tables touched (3):** `portfolio_submissions`, `expert_seam_claims`, `platform_decisions`

**Endpoints:** `POST /portfolio-submissions`, `GET /portfolio-submissions/:id`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Expert→NestJS | Submit portfolio evidence; guards; INSERT submission | `portfolio_submissions` (C) | status="PENDING" | `POST /portfolio-submissions` |
| 3 | NestJS→FastAPI | LLM portfolio evaluation with DB seam context | — | — | Internal `POST /llm/portfolio-eval` |
| 4 | NestJS | Atomic: update submission + seam claim + platform_decisions | `portfolio_submissions` (U), `expert_seam_claims` (U), `platform_decisions` (C) | APPROVED → seam: CLAIMED→EVIDENCE_BACKED; REJECTED → count++, maybe locked | — |

---

### MF-10: AI Matching & Shortlisting

**Overview:** Matching is triggered automatically when Stage 5 synthesis publishes a project. CEO reads the shortlist via GET. CEO can force re-score.

**Tables touched (4):** `projects`, `project_shortlist_cache`, `expert_profiles`, `expert_seam_claims`, `expert_domain_depths`

**Endpoints:** `GET /matching/:projectId/shortlist`, `GET /matching/:projectId/shortlist?refresh=true`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | NestJS (Auto) | At publish time, call FastAPI matching engine | `project_shortlist_cache` (C) | — | Internal |
| 2 | CEO | Open project page to view shortlist | `project_shortlist_cache` (R) | — | `GET /matching/:projectId/shortlist` |
| 3 | CEO | Optional: Force re-score against latest expert profiles | `project_shortlist_cache` (U) | source: AUTO→FORCE_REFRESH | `GET /matching/:projectId/shortlist?refresh=true` |

---

### MF-11: Service Listing Creation (Path B) with AI Assist

**Overview:** Expert (Pro) uses AI Service Generator to create a service listing. AI dynamically uses expert's claimed domains/seams and DB price guidance. Expert reviews and publishes.

**Tables touched (2):** `services`, `expert_profiles`

**Endpoints:** `POST /services`, `PUT /services/:id/publish`, `PUT /services/:id/unpublish`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Expert→NestJS | Create service with `useAiGenerator: true`. NestJS calls FastAPI with expert's claimed competencies + DB price guidance. | `services` (C) | state="DRAFT" | `POST /services` |
| 3 | Expert | Reviews AI draft, edits, then clicks "Publish" | `services` (U) | state: DRAFT→PUBLISHED | `PUT /services/:id/publish` |

---

### MF-12: Inviting Experts to Bid

**Overview:** CEO views the shortlist and invites specific experts to bid. Expert receives a notification. Expert can accept (bid) or decline.

**Tables touched (2):** `invitations`, `notifications`

**Endpoints:** `POST /projects/:id/invite` (internal/undocumented in swagger but exists), `GET /invitations`, `POST /invitations/:id/decline`, `GET /invitations/sent`, `DELETE /invitations/:id`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Selects expert from shortlist, sends invite | `invitations` (C), `notifications` (C) | status="PENDING" | `POST /projects/:id/invite` |
| 3 | Expert | Views inbox | `invitations` (R) | — | `GET /invitations` |
| 4a | Expert | Accepts (navigates to bid form) | — | — | — |
| 4b | Expert | Declines | `invitations` (U) | status="DECLINED" | `POST /invitations/:id/decline` |
| 5 | CEO | Views sent invitations / Retracts pending | `invitations` (R/U) | status="DECLINED" (retracted) | `GET /invitations/sent`, `DELETE /invitations/:id` |

---

## Group 4: Bidding & Engagement

---

### MF-13: Pre-Bid Q&A and Bid Submission

**Overview:** Expert views Artifact A, asks pre-bid questions via the project-scoped messages channel. Submits 3-component bid.

**Tables touched (4):** `capability_bids`, `engagements`, `projects`, `messages`

**Endpoints:** `GET /projects/:id/artifact-a`, `POST /messages`, `GET /messages?projectId=`, `POST /bids`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | Expert | View Artifact A | `projects` (R — artifact_a_json) | — | `GET /projects/:id/artifact-a` |
| 2-4 | Expert/CEO | Pre-bid messaging on project channel | `messages` (C) | — | `POST /messages` |
| 5-6 | Expert→NestJS | Submit 3-component bid; atomic engagement + bid. DTO dehardcoded: seam codes use `↔`, domain codes are any string validated against DB. | `engagements` (C), `capability_bids` (C) | bid.state=SUBMITTED, tech_status=PENDING, ceo_status=PENDING | `POST /bids` |

---

### MF-14: Tech Team Bid Review

**Overview:** TECH_TEAM reviews bid and sets `tech_status`. Expert can revise in-place.

**Tables touched (1):** `capability_bids`

**Endpoints:** `PUT /bids/:id/tech-review`, `PUT /bids/:id` (expert revise)

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | TECH_TEAM→NestJS | Set tech_status + optional feedback | `capability_bids` (U) | tech_status: PENDING→REVISION_REQUESTED or APPROVED | `PUT /bids/:id/tech-review` |
| 3-4 | Expert→NestJS | Revise bid in-place; reset tech_status | `capability_bids` (U) | tech_status→PENDING, state→TECH_REVIEW, version_number++ | `PUT /bids/:id` |

---

### MF-15: CEO Bid Review & Counter-Offer

**Overview:** CEO reviews bid (only after tech_status=APPROVED). Optional one-round counter-offer. CEO selects or declines. Sibling bids are cascade-declined.

**Tables touched (1):** `capability_bids`

**Endpoints:** `PUT /bids/:id/counter-offer`, `PUT /bids/:id/ceo-decision`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | CEO | Optional: Counter-offer (one round only; 409 if already set) | `capability_bids` (U) | negotiated_price_vnd set | `PUT /bids/:id/counter-offer` |
| 2-3 | CEO→NestJS | CEO decision: APPROVED or DECLINED. Cascade decline siblings. | `capability_bids` (U) | ceo_status: PENDING→APPROVED/DECLINED; state→SELECTED/DECLINED | `PUT /bids/:id/ceo-decision` |

---

### MF-16: NDA Acceptance & Engagement Connection

**Overview:** Both parties must accept NDA. When both timestamps are set, engagement transitions to CONNECTED. Artifact B route guard unlocks.

**Tables touched (1):** `engagements`

**Endpoints:** `PUT /engagements/:id/accept-nda`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-3 | CEO+Expert→NestJS | NDA click-through; CONNECTED when both set | `engagements` (U) | state: PENDING→CONNECTED; nda timestamps set | `PUT /engagements/:id/accept-nda` |

---

### MF-17: Service Purchase (Path B) Direct Engagement

**Overview:** CEO browses marketplace and purchases a service. Creates SERVICE_PURCHASE engagement in PENDING state. VA is generated locally. SePay IPN credits escrow atomically, transitions engagement to ACTIVE, and creates a single auto-milestone in FUNDED state.

**Tables touched (6):** `services`, `engagements`, `virtual_accounts`, `escrow_accounts`, `milestones`, `wallets`, `wallet_transactions`

**Endpoints:** `GET /services`, `POST /services/:id/purchase`, `POST /webhooks/sepay/ipn`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-3 | CEO→NestJS | Buy service. Create engagement + local VA. | `engagements` (C), `virtual_accounts` (C) | state="PENDING" | `POST /services/:id/purchase` |
| 4-6 | CEO→Bank→SePay→NestJS | IPN SERVICE branch: atomic escrow lock, milestone creation, engagement ACTIVE. | `escrow_accounts` (C), `milestones` (C), `wallets` (U), `wallet_transactions` (C) | engagement: PENDING→ACTIVE; milestone: FUNDED | `POST /webhooks/sepay/ipn` |

---

## Group 5: Milestone Execution & Escrow

---

### MF-18: Milestone Definition & AI Quality Gate

**Overview:** CEO creates milestones (with criteria inline in one POST). Criteria are async LLM quality-gated after creation (advisory only — milestone is persisted regardless).

**Tables touched (2):** `milestones`, `acceptance_criteria`, `platform_decisions`

**Endpoints:** `POST /milestones`, `GET /milestones/:id`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Create milestone with criteria inline | `milestones` (C), `acceptance_criteria` (C) | state="DEFINED" | `POST /milestones` |
| 3 | NestJS→FastAPI | Async LLM quality gate on each criterion | `platform_decisions` (C) | — | Internal `POST /llm/criterion-check` |

---

### MF-19: Milestone Funding & Escrow Lock

**Overview:** CEO funds milestone via local VA. SePay IPN credits escrow and advances milestone to FUNDED→IN_PROGRESS and releases paygated_documents.

**Tables touched (5):** `milestones`, `virtual_accounts`, `escrow_accounts`, `wallets`, `wallet_transactions`

**Endpoints:** `PUT /milestones/:id/fund`, `POST /webhooks/sepay/ipn`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | CEO→NestJS | Fund milestone. Generate local VA. | `virtual_accounts` (C), `milestones` (U) | state: DEFINED→AWAITING_PAYMENT | `PUT /milestones/:id/fund` |
| 3-5 | CEO→Bank→SePay→NestJS | IPN MILESTONE branch: atomic escrow lock, milestone FUNDED, engagement ACTIVE, paygated docs RELEASED. | `escrow_accounts` (C), `wallets` (U), `wallet_transactions` (C), `milestones` (U), `paygated_documents` (U) | milestone: AWAITING_PAYMENT→FUNDED→IN_PROGRESS | `POST /webhooks/sepay/ipn` |

---

### MF-20: DoD Checklist & Deliverable Submission

**Overview:** Expert creates DoD checklist, marks items complete. Expert submits deliverable (DoD gate enforced: all required items must be COMPLETED).

**Tables touched (2):** `milestone_dod_items`, `milestone_submissions`

**Endpoints:** `POST /milestones/:id/dod/items`, `PUT /milestones/:id/dod/:itemId`, `POST /milestones/:id/submit`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Expert | Create DoD items | `milestone_dod_items` (C) | status="PENDING" | `POST /milestones/:id/dod/items` |
| 3-4 | Expert | Mark items complete | `milestone_dod_items` (U) | status="COMPLETED" | `PUT /milestones/:id/dod/:itemId` |
| 5-6 | Expert→NestJS | Submit deliverable. DoD gate enforced. | `milestone_submissions` (C), `milestones` (U) | milestone: IN_PROGRESS→SUBMITTED | `POST /milestones/:id/submit` |

---

### MF-21: Pay-gated Document Release

**Overview:** Expert stages a paygated document (`release_state="STAGED"`). When the SePay IPN MILESTONE branch fires, ALL staged documents are atomically flipped to `release_state="RELEASED"`. TECH_TEAM and EXPERT can access them; CEO is permanently excluded.

**Tables touched (1):** `paygated_documents`

**Endpoints:** `POST /milestones/:id/paygated-docs`, `GET /milestones/:id/paygated-docs`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | Expert | Stages paygated doc | `paygated_documents` (C) | release_state="STAGED" | `POST /milestones/:id/paygated-docs` |
| 2 | SePay IPN (auto) | Flips all staged docs for milestone to RELEASED | `paygated_documents` (U) | release_state: STAGED→RELEASED | Internal in IPN handler |
| 3 | TECH_TEAM/Expert | Download unlocked docs | `paygated_documents` (R) | — | `GET /milestones/:id/paygated-docs` |

---

### MF-22: Criteria Verification & Escrow Release

**Overview:** Sign-off authority verifies criteria one by one. Last criterion verified triggers atomic escrow release. Platform fee is read from `platform_settings` at APPROVED transaction time.

**Tables touched (5):** `acceptance_criteria`, `milestones`, `escrow_accounts`, `wallets`, `wallet_transactions`, `withdrawal_requests`

**Endpoints:** `PUT /criteria/:id/verify`, `PUT /criteria/:id/revision`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | TECH_TEAM/CEO | Verifies each criterion | `acceptance_criteria` (U) | verified_at set | `PUT /criteria/:id/verify` |
| 3 | NestJS | If all required verified: atomic APPROVED ledger release. Creates `withdrawal_requests` row (type: MILESTONE_RELEASE, status: PENDING). | `milestones` (U), `escrow_accounts` (U), `wallets` (U), `wallet_transactions` (C), `withdrawal_requests` (C) | milestone: SUBMITTED→APPROVED; escrow: HELD→RELEASED | — |
| 4 | TECH_TEAM/CEO | OR: Rejects criterion | `acceptance_criteria` (U), `milestones` (U) | milestone: SUBMITTED→IN_REVISION | `PUT /criteria/:id/revision` |

---

### MF-23: Milestone Chat Assistant

**Overview:** AI assistant embedded in the project dashboard. It answers questions about the spec and suggests edits to the milestone framework. History is persisted server-side.

**Tables touched (1):** `milestone_chat_sessions`

**Endpoints:** `POST /projects/:id/milestone-chat`, `GET /projects/:id/milestone-chat/sessions`, `GET /projects/:id/milestone-chat/sessions/:sessionId`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | CEO/Expert | Sends message (omit chatSessionId for new conversation) | `milestone_chat_sessions` (C/U) | — | `POST /projects/:id/milestone-chat` |
| 2 | NestJS→FastAPI | AI replies, optionally includes `suggestedEdit` | `milestone_chat_sessions` (U) | — | Internal `POST /llm/elicitation/milestone-chat` |
| 3 | CEO/Expert | Lists sessions / views history | `milestone_chat_sessions` (R) | — | `GET .../sessions`, `GET .../sessions/:sessionId` |

---

## Group 6: Dispute Resolution

---

### MF-24: Dispute Filing & Layer 1 LLM Eval

**Overview:** Expert or CEO files a dispute against a specific acceptance criterion. NestJS calls FastAPI for Layer 1 LLM evaluation. If confidence ≥ 0.80, dispute is AUTO_RESOLVED. Below threshold, escalates to MANUAL_REVIEW. Escrow is frozen on dispute filing.

**Tables touched (4):** `disputes`, `escrow_accounts`, `wallets`, `platform_decisions`

**Endpoints:** `POST /disputes`, `GET /disputes/:id`, `POST /disputes/:id/evidence`, `PUT /disputes/:id/withdraw`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Expert/CEO→NestJS | File dispute. Freeze escrow. | `disputes` (C), `escrow_accounts` (U), `milestones` (U) | dispute: PENDING; escrow: HELD→FROZEN; milestone: SUBMITTED→DISPUTED | `POST /disputes` |
| 3-4 | NestJS→FastAPI | LLM dispute eval with context. | `disputes` (U), `platform_decisions` (C) | dispute: PENDING→LAYER_1_EVAL→AUTO_RESOLVED (≥0.80) or MANUAL_REVIEW (<0.80) | Internal `POST /llm/dispute-eval` |
| 5 | Filer | Submit additional evidence | `platform_decisions` (C) | — | `POST /disputes/:id/evidence` |
| 6 | Filer | Withdraw dispute (before resolution) | `disputes` (U), `escrow_accounts` (U) | dispute: LAYER_1_EVAL→WITHDRAWN; escrow: FROZEN→HELD | `PUT /disputes/:id/withdraw` |

---

### MF-25: Admin Manual Dispute Resolution

**Overview:** Admin reviews MANUAL_REVIEW disputes and chooses one of three resolution options.

**Tables touched (5):** `disputes`, `escrow_accounts`, `wallets`, `wallet_transactions`, `milestones`

**Endpoints:** `PUT /admin/disputes/:id/resolve`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Admin→NestJS | Resolve dispute (EXPERT_WINS / CLIENT_WINS / SPLIT). Ledger distribution. | `disputes` (U), `escrow_accounts` (U), `wallets` (U), `wallet_transactions` (C), `milestones` (U) | dispute: MANUAL_REVIEW→RESOLVED; milestone: DISPUTED→APPROVED | `PUT /admin/disputes/:id/resolve` |

---

## Group 7: Financial & Wallet Operations

---

### MF-26: Expert Withdrawal Request

**Overview:** Expert requests cash-out to their linked bank account. System debits wallet and creates a withdrawal request. No automated chi hộ API call exists.

**Tables touched (3):** `wallets`, `wallet_transactions`, `withdrawal_requests`

**Endpoints:** `POST /withdrawals`, `GET /withdrawals`, `DELETE /withdrawals/:id`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Expert→NestJS | Request withdrawal. Debit wallet. | `wallets` (U), `wallet_transactions` (C), `withdrawal_requests` (C) | status="PENDING" | `POST /withdrawals` |
| 3 | Expert | Cancel pending withdrawal | `withdrawal_requests` (U), `wallets` (U), `wallet_transactions` (C) | status: PENDING→CANCELLED; wallet refunded | `DELETE /withdrawals/:id` |

---

### MF-27: Admin Withdrawal Management

**Overview:** Admin manually confirms or fails withdrawals. Completing a withdrawal advances the milestone to RELEASED.

**Tables touched (3):** `withdrawal_requests`, `milestones`, `wallets`, `wallet_transactions`

**Endpoints:** `PUT /admin/withdrawals/:id/complete`, `PUT /admin/withdrawals/:id/fail`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Admin→NestJS | Complete withdrawal. Advance milestone. | `withdrawal_requests` (U), `milestones` (U) | withdrawal: COMPLETED; milestone: APPROVED→RELEASED | `PUT /admin/withdrawals/:id/complete` |
| 3-4 | Admin→NestJS | Fail withdrawal. Refund wallet. | `withdrawal_requests` (U), `wallets` (U), `wallet_transactions` (C) | withdrawal: FAILED; wallet refunded | `PUT /admin/withdrawals/:id/fail` |

---

### MF-28: Subscription Management & History

**Overview:** Pure internal wallet deduction. No VA, no IPN. Body uses `{activeRole, packageId}`. PackageId is required.

**Tables touched (4):** `users`, `wallets`, `wallet_transactions`, `subscription_purchase_logs`, `subscription_packages`

**Endpoints:** `POST /subscriptions/activate`, `GET /subscriptions/status`, `GET /subscriptions/history`, `GET /config/subscription-packages`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | User | Fetch available packages | `subscription_packages` (R) | — | `GET /config/subscription-packages` |
| 2-3 | User→NestJS | Activate Pro. Debit wallet. Update tier. Insert purchase log. | `wallets` (U), `wallet_transactions` (C), `users` (U), `subscription_purchase_logs` (C) | tier: free→pro | `POST /subscriptions/activate` |
| 4 | User | View history | `subscription_purchase_logs` (R) | — | `GET /subscriptions/history` |

---

## Group 8: Communication & Real-time

---

### MF-29: Real-time Messaging (Engagement vs Project)

**Overview:** Messages can be scoped to an engagement (bilateral post-bid thread) or a project (pre-bid open thread). Exactly one of `engagement_id` or `project_id` must be present. WebSocket gateway handles real-time delivery.

**Tables touched (3):** `messages`, `message_reads`, `engagements`

**Endpoints:** `POST /messages`, `GET /messages?engagementId=`, `GET /messages?projectId=`, `PUT /messages/:id/read`, `GET /conversations`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Sender | Sends message (engagement_id XOR project_id) | `messages` (C) | — | `POST /messages` |
| 3 | NestJS | Emit via Socket.io to room | — | — | `[WS] message:received` |
| 4-5 | Recipient | Marks read | `message_reads` (C/U) | — | `PUT /messages/:id/read` |
| 6-7 | User | Get history / conversations | `messages` (R) | — | `GET /messages`, `GET /conversations` |

---

### MF-30: WebSocket Notifications & Badge Updates

**Overview:** When a notification event fires (e.g., bid submitted), NestJS emits a `notification:generic` WebSocket event AND inserts a row into the `notifications` table. FE fetches unread count via REST on page load.

**Tables touched (1):** `notifications`

**Endpoints:** `GET /notifications/me`, `GET /notifications/me/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1 | NestJS (auto) | Event fires (e.g., bid submitted). Insert notification. Emit WS event. | `notifications` (C) | is_read=false | `[WS] notification:generic` |
| 2 | FE | On app mount, fetch unread count | `notifications` (R) | — | `GET /notifications/me/unread-count` |
| 3 | User | Marks read / deletes | `notifications` (U/D) | is_read=true | `PUT /notifications/:id/read`, `DELETE /notifications/:id` |

---

## Group 9: Admin & CMS Governance

---

### MF-31: Platform Analytics & Oversight

**Overview:** Read-only admin dashboard. Displays platform_decisions log, dispute queue, transaction ledger, analytics, and withdrawal queue.

**Tables touched (read only):** `platform_decisions`, `wallet_transactions`, `disputes`, `escrow_accounts`, `users`, `withdrawal_requests`

**Endpoints:** `GET /admin/decisions`, `GET /admin/disputes`, `GET /admin/transactions`, `GET /admin/analytics`, `GET /admin/withdrawals`

---

### MF-32: Dynamic CMS Management (Domains, Seams, Archetypes)

**Overview:** Admin manages taxonomy via CMS endpoints. Changes take effect immediately. Public `/config/*` endpoints filter to `isActive: true`.

**Tables touched (5):** `domain_definitions`, `seam_definitions`, `archetype_definitions`, `probe_questions`, `void_code_definitions`

**Endpoints:** `GET/POST/PUT/DELETE /admin/config/domains`, `/seams`, `/archetypes`, `/probe-questions`, `/void-codes`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Admin | Create/update/delete taxonomy item | `domain_definitions` (C/U/D) | isActive: true/false | `POST/PUT/DELETE /admin/config/domains` |
| 3 | FE | Fetches updated config on next app mount | `domain_definitions` (R) | — | `GET /config/all` |

---

### MF-33: Prompt Template Management

**Overview:** Admin updates Jinja2 prompt templates. Changes take effect within 60 seconds (FastAPI cache TTL).

**Tables touched (1):** `prompt_templates`

**Endpoints:** `GET /admin/prompts`, `GET /admin/prompts/:stage`, `PUT /admin/prompts/:stage`, `DELETE /admin/prompts/:stage`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Admin | Upsert prompt template | `prompt_templates` (C/U) | version++ | `PUT /admin/prompts/:stage` |
| 3 | Admin | Reset to default | `prompt_templates` (D) | version resets | `DELETE /admin/prompts/:stage` |

---

### MF-34: Subscription Package Management

**Overview:** Admin creates/updates/deactivates subscription packages. Hard-delete is blocked if purchase history exists.

**Tables touched (1):** `subscription_packages`

**Endpoints:** `GET/POST /admin/subscriptions/packages`, `PUT/DELETE /admin/subscriptions/packages/:id`

---

### MF-35: User & Project Suspension

**Overview:** Admin emergency pull-back of published project spec. Admin account suspension (no JWT blacklist — JWTs expire naturally after 7d).

**Tables touched (3):** `projects`, `users`, `platform_decisions`

**Endpoints:** `PUT /admin/projects/:id/suspend-spec`, `PUT /admin/projects/:id/reopen`, `PUT /admin/users/:id/suspend`, `PUT /admin/users/:id/reactivate`

#### Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 1-2 | Admin | Suspend project spec | `projects` (U), `platform_decisions` (C) | state: PUBLISHED→SUSPENDED | `PUT /admin/projects/:id/suspend-spec` |
| 3-4 | Admin | Suspend user account | `users` (U) | is_active: true→false | `PUT /admin/users/:id/suspend` |

---

## Appendices

---

### Cross-Table Ledger Operations Summary

Every financial action resolves to one of these atomic wallet transaction patterns:

| Transaction Type | Wallet Debit | Wallet Credit | Trigger | Flow |
|---|---|---|---|---|
| `TOP_UP` | — | `available_balance += amount` | SePay IPN (WALLET_TOPUP VA) | MF-1 |
| `SUBSCRIPTION` | `available_balance -= price` | — | User activates Pro | MF-28 |
| `ESCROW_LOCK` | `available_balance -= amount`, `locked_balance += amount` | — | SePay IPN (MILESTONE or SERVICE VA) | MF-19, MF-17 |
| `ESCROW_RELEASE` | `locked_balance -= gross` | `expert.available += net` | All required criteria verified | MF-22 |
| `PLATFORM_FEE` | — | `platform.available += fee` | Deducted on escrow release | MF-22 |
| `ESCROW_REFUND` | `locked_balance -= amount` | `client.available += amount` | Dispute: CLIENT_WINS | MF-25 |
| `ESCROW_SPLIT` | `locked_balance -= amount` | Both `+= amount/2` | Admin SPLIT | MF-25 |
| `WITHDRAWAL` | `expert.available -= amount` | — | Expert cash-out request | MF-26 |
| `WITHDRAWAL_REFUND` | — | `expert.available += amount` | Admin fails withdrawal OR expert cancels | MF-27 |

---

### 40-Table Coverage Matrix

| # | Table | Created By | Read By | Updated By | Primary Flows |
|---|---|---|---|---|---|
| 1 | `users` | MF-1, MF-2, MF-3 | MF-1,2,5,13,15,17,28,31 | MF-1 (sub tier), MF-2 (bank link), MF-4 (reset), MF-28 (sub tier), MF-35 (is_active) | All |
| 2 | `client_profiles` | MF-1 | — | MF-1 (company_name via taxCode) | MF-1 |
| 3 | `expert_profiles` | MF-2 | MF-10, MF-11 | MF-2 (stack_tags, archetype, engagement_model) | MF-2, MF-10, MF-11 |
| 4 | `tech_team_profiles` | MF-3 | MF-3, MF-6 | MF-3 (linked_project_id set immediately if project exists) | MF-3, MF-6 |
| 5 | `wallets` | MF-1, MF-2 | MF-1,2,26,28 | MF-1,2,17,19,22,25,26,27,28 | All financial |
| 6 | `wallet_transactions` | MF-1,2,17,19,22,25,26,27,28 | MF-31 | — (immutable) | All financial |
| 7 | `virtual_accounts` | MF-1,2 (WALLET_TOPUP at reg), MF-19 (MILESTONE), MF-17 (SERVICE) | MF-1 | MF-17,19 (status→USED on IPN) | MF-1,2,17,19 |
| 8 | `withdrawal_requests` | MF-22 (MILESTONE_RELEASE), MF-26 (EXPERT_MANUAL) | MF-27,31 | MF-26(cancel), MF-27(complete/fail) | MF-22,26,27,31 |
| 9 | `platform_settings` | seed | MF-22 (fee_pct) | — | MF-22 |
| 10 | `elicitation_sessions` | MF-6 | MF-6,7,8 | MF-6,7,8 (all stage updates, handoff jti, consumed_at, drafts) | MF-6,7,8 |
| 11 | `projects` | MF-8 (via synthesis) | MF-10,13,17,31 | MF-35 (SUSPENDED) | MF-8,10,13,17,31,35 |
| 12 | `project_shortlist_cache` | MF-8 | MF-10 | MF-10 (FORCE_REFRESH) | MF-8, MF-10 |
| 13 | `expert_domain_depths` | MF-2 | MF-10 | MF-2 (UPSERT) | MF-2, MF-10 |
| 14 | `expert_seam_claims` | MF-2 | MF-10 | MF-9 (verification_tier, submission_count, locked_until) | MF-2, MF-9, MF-10 |
| 15 | `portfolio_submissions` | MF-9 | MF-9 | MF-9 (status, llm_confidence, evaluated_at) | MF-9 |
| 16 | `services` | MF-11 | MF-17 | MF-11 (state: DRAFT→PUBLISHED) | MF-11, MF-17 |
| 17 | `engagements` | MF-13(PROJECT_BASED), MF-17(SERVICE_PURCHASE) | MF-13,19,22,24,29 | MF-16(NDA→CONNECTED), MF-17,19(IPN→ACTIVE), MF-25(admin→CLOSED) | MF-13,16,17,19,22,24,25,29 |
| 18 | `capability_bids` | MF-13 | MF-13,14,15 | MF-13,14,15 (tech_status, ceo_status, state, version_number, tech_feedback, negotiated_price_vnd) | MF-13,14,15 |
| 19 | `milestones` | MF-18(CEO creates), MF-17(auto-created on IPN) | MF-18,19,20,22,24 | MF-18,19,20,22,24,27 (state machine) | MF-17,18,19,20,22,24,27 |
| 20 | `acceptance_criteria` | MF-18 (inline with milestone POST) | MF-18,22,24 | MF-22 (verified_at, revision_note) | MF-18, MF-22, MF-24 |
| 21 | `milestone_dod_items` | MF-20 | MF-20 | MF-20 (status, completion_note, not_applicable_note) | MF-20 |
| 22 | `milestone_submissions` | MF-20 | MF-20 | — | MF-20 |
| 23 | `paygated_documents` | MF-21 | MF-21 | MF-21 (release_state: STAGED→RELEASED via IPN) | MF-19, MF-21 |
| 24 | `escrow_accounts` | MF-19 (MILESTONE path), MF-17 (SERVICE path) | MF-24,31 | MF-19,22,24,25 (status: HELD→RELEASED/REFUNDED/SPLIT/FROZEN) | MF-17,19,22,24,25 |
| 25 | `disputes` | MF-24 | MF-24,31 | MF-24(state machine), MF-25(RESOLVED) | MF-24, MF-25 |
| 26 | `messages` | MF-29 | MF-29 | — (immutable) | MF-29 |
| 27 | `message_reads` | MF-29 (UPSERT on mark-read) | MF-29 (unread count) | MF-29 | MF-29 |
| 28 | `reviews` | MF (post-CLOSED engagement) | MF-31 | — | Post-engagement |
| 29 | `platform_decisions` | MF-8,18,22,24,25,35 | MF-31 | — (immutable) | MF-8,18,22,24,25,31,35 |
| 30 | `milestone_chat_sessions` | MF-23 | MF-23 | MF-23 (messages_json appended) | MF-23 |
| 31 | `invitations` | MF-12 | MF-12 | MF-12 (status: PENDING→ACCEPTED/DECLINED) | MF-12 |
| 32 | `notifications` | MF-12,13,14,15,22,24,30 | MF-30 | MF-30 (is_read, read_at) | MF-12,13,14,15,22,24,30 |
| 33 | `domain_definitions` | MF-32 | MF-2,6,9,10 (via /config) | MF-32 (isActive, sortOrder) | MF-32 |
| 34 | `seam_definitions` | MF-32 | MF-2,6,9,10 (via /config) | MF-32 (isActive, sortOrder) | MF-32 |
| 35 | `archetype_definitions` | MF-32 | MF-6 (via /config) | MF-32 (isActive, sortOrder) | MF-32 |
| 36 | `probe_questions` | MF-32 | MF-6 (via /config) | MF-32 (isActive, displayOrder) | MF-32 |
| 37 | `void_code_definitions` | MF-32 | MF-6 (via /config) | MF-32 (isActive, sortOrder) | MF-32 |
| 38 | `prompt_templates` | MF-33 | FastAPI (via /internal) | MF-33 (templateText, version) | MF-33 |
| 39 | `subscription_packages` | MF-34 | MF-28 (via /config) | MF-34 (priceVnd, isActive) | MF-28, MF-34 |
| 40 | `subscription_purchase_logs` | MF-28 | MF-28 | — (immutable) | MF-28 |