# AITasker — All Scenario Paths & Branches by Actor
**Purpose:** Complete enumeration of every screen journey, decision point, and branch for all human actors.  
**Next step:** Use this as the source of truth to write screen-by-screen flow documents.  
**Naming convention:** `{ACTOR}-{JOURNEY #}{BRANCH LETTER}` — e.g. CEO-3B = CEO journey 3, branch B.

---

# ACTOR 1: CLIENT / CEO

---

## CEO-0 · Onboarding & Account Setup

### CEO-0.1 · Fresh Registration
**Entry:** Unauthenticated user lands on AITasker  
**Screens:** Landing → Register form → Email verification → CEO dashboard (Free tier)  
**DB outcome:** `users`, `client_profiles`, `wallets` (balance=0), `virtual_accounts` (WALLET_TOPUP, permanent) all created atomically  
**Branches from here:**  
→ Wallet empty → must top up before anything paid (CEO-0.2)  
→ Want to run elicitation immediately → must subscribe first (CEO-0.3)

### CEO-0.2 · Top Up Wallet (any time, any state)
**Entry:** Any point where CEO wants to add funds  
**Screens:** Wallet panel → "Top Up" → QR code display → pending state → confirmation toast  
**Decision points:**  
→ CEO scans QR and pays → IPN fires → balance updated ✓  
→ CEO does not pay within session → QR remains valid (permanent VA, no expiry) → no state change  
→ IPN arrives as duplicate (SePay retry) → idempotency guard fires → 200 returned, no double-credit  

### CEO-0.3 · Activate Client Pro Subscription
**Entry:** CEO tries to access a Pro-gated feature or opens Subscription panel  
**Screens:** Subscription panel → Plan detail (500K VND / 6 months) → Confirm → Success  
**Decision points:**  
→ Balance ≥ 500K → payment deducted atomically → `subscription_client_tier = 'pro'` ✓  
→ Balance < 500K → 422 INSUFFICIENT_BALANCE → redirect to CEO-0.2 (top up) → return here  
→ Already Pro and not expired → 409 ALREADY_SUBSCRIBED → show renewal date  
→ Pro expired with active engagement → show grandfathered notice → activate renews features  

### CEO-0.4 · Add Expert Role (Dual-Role Acquisition)
**Entry:** CEO opens Account Settings → Add Role  
**Screens:** Account Settings → "Become an Expert" → Identity verification → Role added confirmation  
**Outcome:** `users.roles = ["CLIENT_CEO","EXPERT"]` → role switcher appears in nav  
**Note:** Expert dashboard now accessible. Self-exclusion rule active permanently (cannot bid on own projects).

---

## CEO-1 · Project Creation via AI Elicitation (Path A)

### CEO-1.0 · Start Elicitation (Subscription Check Entry Point)
**Entry:** CEO clicks "Post a Project"  
**Screen:** Subscription gate check  
→ Pro active → proceed to CEO-1.1  
→ Free tier → gate screen with "Upgrade to Pro" CTA → routes to CEO-0.3 → returns here on success  

### CEO-1.1 · Stage 1 — Symptom Intake
**Entry:** Elicitation session created (`state=IN_PROGRESS, current_stage=1`)  
**Screen:** Open text area — "Describe what's hurting in your business"  
**CEO action:** Types free-form symptom description  
**System action:** Calls FastAPI stage1-extract → void detection, intent separation, scale signals  
**Decision points:**  
→ LLM extraction successful → `void_list_json` populated → proceed to Stage 2 (CEO-1.2)  
→ FastAPI timeout/error → error state shown → retry button  

### CEO-1.2 · Stage 2 — Archetype Selection + SDLC Void Injection
**Screens:** Archetype picker (2–3 options in plain language) → Void injection confirmations  
**CEO actions:**  
1. Select archetype → `elicitation_sessions.archetype` locked (immutable)  
2. For each detected void: system shows injection rationale → CEO acknowledges each mandatory Phase 0 milestone  
**Decision points:**  
→ CEO accepts all injections → `void_list_json` updated (injected: true) → proceed to Stage 3 (CEO-1.3)  
→ CEO tries to remove a mandatory void → blocked (UI shows lock icon + explanation, cannot proceed without acknowledgment)

### CEO-1.3 · Stage 3 — Behavioral Architecture Probes
**Screen:** 4 behavioral questions (sync/async, thundering herd, stateful memory, HITL) — no technical knowledge required  
**CEO action:** Answers each question; all 4 required  
**System action:** Evaluates answers against infrastructure tier thresholds  
**Decision points after submission:**  
→ Stage 4 NOT required (no existing system integration) → skip to CEO-1.5 (synthesis)  
→ Stage 4 required + TECH_TEAM route → CEO-1.4A  
→ Stage 4 required + no TECH_TEAM → CEO-1.4B (Scenario A)  
→ Stage 4 required + self_technical=true → CEO-1.4C (Scenario B)

### CEO-1.4A · Stage 4 — Send TECH_TEAM Handoff Link
**Screen:** "Your project requires technical architecture input" → Handoff Link generated → Copy/share panel  
**CEO action:** Copies JWT handoff link (72h expiry) → shares externally with their tech lead  
**System state:** CEO hard-blocked from Stage 4 form. `elicitation_sessions` stays `IN_PROGRESS`  
**Decision points:**  
→ TECH_TEAM registers and completes Stage 4 (TECH-1) → synthesis triggered (CEO-1.5)  
→ TECH_TEAM link expires unused (72h) → CEO sees "Link Expired" banner → can regenerate  
→ CEO returns to dashboard before TECH_TEAM completes → session preserved, pending indicator  

### CEO-1.4B · Stage 4 — Scenario A: No TECH_TEAM Available
**Screen:** "No technical team? Choose how to proceed:" → Two options  
**Option A:** "Add Tech Discovery as Milestone 0"  
→ System injects TECH_DISCOVERY milestone → `scenario_type = 'SCENARIO_A'`  
→ Project will publish with incomplete technical blueprint  
→ Winning expert's scope includes discovery in Milestone 0  
→ Proceed to synthesis (CEO-1.5)  
**Option B:** "Purchase a Tech Discovery service first"  
→ Routes to CEO-2.3 (buy TECH_DISCOVERY service)  
→ Current elicitation session preserved (`IN_PROGRESS`) with `current_stage` held  
→ After service engagement closes, CEO resumes elicitation with architectural doc in hand  

### CEO-1.4C · Stage 4 — Scenario B: Self-Technical CEO
**Screen:** Stage 4 form presented directly to CEO (same form TECH_TEAM sees)  
**CEO action:** Inputs stack tags, integration method, legacy data volume, deployment targets; optionally uploads schemas  
**System action:** Writes to `artifact_b_json` staging; sets `project.self_technical = true`; updates JWT `self_technical_projects` claim  
→ Submit → proceed to synthesis (CEO-1.5)  

### CEO-1.5 · Stage 5 — Synthesis + Quality Gate
**Screen:** "Analyzing your project…" loading state (Stage 5 is system-only)  
**System action:** FastAPI synthesis → quality gate (completeness ≥ 0.70 + match pre-check ≥ 1 expert + voids resolved)  
**Decision points:**  
→ ALL three gates pass → `projects` row created (`state=PUBLISHED`) → CEO-1.6  
→ Completeness gate fails → `RETURNED_TO_CLIENT` → advisory note shown → CEO-1.7  
→ No experts found in pre-check → `RETURNED_TO_CLIENT` → advisory: "No experts with required seams" → CEO-1.7  
→ Unresolved void → `RETURNED_TO_CLIENT` → advisory points to specific void → CEO-1.7  

### CEO-1.6 · Project Published — View Shortlist (Pro Required)
**Screens:** Project dashboard → Expert shortlist (3–5 match cards)  
**Each card shows:** Match strength label (Strong/Qualified/Conditional), domain coverage, seam gap map (Amber/Yellow/Red), expert engagement model  
**CEO actions from here:**  
→ Message an expert pre-bid → CEO-4.1  
→ Wait for expert to bid → CEO-4.2  

### CEO-1.7 · Returned Spec — Fix and Resubmit
**Screen:** Spec status panel → "Your project was returned" → `platform_decisions.advisory_note` displayed  
**CEO action:** Reads specific void that failed → re-enters elicitation at that void (NOT from Stage 1)  
→ Current `current_stage` preserved → CEO picks up mid-flow  

### CEO-1.8 · Resume Abandoned Elicitation Session
**Entry:** CEO left mid-elicitation and returns to "Post a Project"  
**Screen:** "You have an unfinished project" → Resume or Start Over  
→ Resume → returns to `current_stage` exactly as left  
→ Start Over → previous session abandoned → fresh session begins at Stage 1  

---

## CEO-2 · Marketplace & Service Purchasing (Path B / Path C)

### CEO-2.1 · Browse Path B Marketplace (Free Tier)
**Entry:** Any CEO (Free or Pro) opens marketplace  
**Screen:** Service listings grid — filter by domain, seam, service_type, price  
**Data shown per card:** Title, domains, seams, service_type, price, expert name, avg rating, engagement count  
→ Click card → service detail page → CEO-2.2 or CEO-2.3

### CEO-2.2 · Buy AI Service (SERVICE_PURCHASE — Path B)
**Entry:** CEO on service detail page, service_type = AI_SERVICE  
**Screens:** Service detail → "Buy Service" → QR code display → payment pending → engagement created  
**Decision points:**  
→ CEO scans QR and pays exactly → IPN fires → `engagements {type:SERVICE_PURCHASE, state:ACTIVE}` + `escrow_accounts {engagement_id}` + `milestones {FUNDED}` created  
→ VA expires (24h) → "Payment window expired" → CEO must re-click "Buy Service" → new VA generated  
→ Wrong amount transferred → SePay rejects at source, no IPN fires → CEO shown "awaiting correct payment" state  
→ After engagement ACTIVE → routes to CEO-5 (milestone management)

### CEO-2.3 · Buy Tech Discovery Service (TECH_DISCOVERY — Path C)
**Entry:** CEO on service detail, service_type = TECH_DISCOVERY, OR redirected from CEO-1.4B  
**Screens:** Same as CEO-2.2 (QR → payment → engagement created)  
**After engagement created:**  
→ Engagement ACTIVE → CEO-5 (milestone management, CEO-only sign-off)  
→ After engagement CLOSED: CEO receives architecture document → can resume elicitation from CEO-1.4B (if paused) or start fresh elicitation with knowledge  

---

## CEO-3 · Bid Review & Expert Selection (Path A)

### CEO-3.1 · View Incoming Bids
**Entry:** CEO notified "A new bid is ready for your review" (tech_status = APPROVED triggers notification)  
**Screen:** Bids panel — list of bids with tech_status badge  
→ Bids with tech_status = PENDING: shown but grayed out with "Awaiting technical review" label  
→ Bids with tech_status = APPROVED: active, CEO can review  
→ Bids with tech_status = REVISION_REQUESTED: shown as "Under revision" (expert notified separately)  

### CEO-3.2 · Review an Approved Bid
**Screen:** Bid detail — footprint alignment, approach summary, pricing, TECH_TEAM's tech_feedback notes  
**CEO actions:**  
→ Optionally write counter-offer (CEO-3.3)  
→ Approve bid (CEO-3.4)  
→ Decline bid (CEO-3.5)

### CEO-3.3 · Write Counter-Offer (Optional, One Round)
**Screen:** Price negotiation panel on bid detail → numeric input for `negotiated_price_vnd`  
**Decision points:**  
→ CEO submits counter-offer → `negotiated_price_vnd` set (immutable after first write) → expert notified  
→ Expert sees counter-offer → no formal accept/decline mechanism for expert (expert simply accepts implicitly or the bid goes to CEO decision)  
→ CEO proceeds to approve/decline as usual (CEO-3.4 or CEO-3.5)

### CEO-3.4 · Approve Bid → Connection Flow
**Screen:** Confirm selection modal → "Select This Expert"  
**System:** `ceo_status = 'APPROVED'`, `capability_bids.state = 'SELECTED'`, all other bids → DECLINED  
→ Connection flow initiated → CEO-4.3

### CEO-3.5 · Decline a Bid
**Screen:** Confirm decline modal → optional decline reason  
**Outcome:** `ceo_status = 'DECLINED'`, `capability_bids.state = 'DECLINED'` → expert notified  
→ CEO returns to bid list → other experts' bids still visible  
→ If all bids declined → CEO waits for new bids or extends project visibility  

---

## CEO-4 · Messaging & Connection

### CEO-4.1 · Respond to Expert Pre-Bid Questions
**Entry:** CEO notified of expert message in project channel  
**Screen:** Project messages thread → CEO reads question → types response → sends  
**Note:** Uses shared messages channel. No spec_clarifications table. CEO and TECH_TEAM can both respond.

### CEO-4.2 · Wait for Expert to Bid (Passive)
**Screen:** Project dashboard → "Awaiting bids" state → bid count indicator  
→ Expert submits bid → TECH_TEAM reviews → TECH_TEAM approves → CEO notified → CEO-3.1

### CEO-4.3 · Complete NDA Click-Through (Connection)
**Entry:** Bid SELECTED, connection request auto-sent to expert  
**Screen:** NDA acknowledgment modal → checkbox → "Confirm"  
**Outcome:** `engagements.client_nda_accepted_at = now()`  
**Decision points:**  
→ Expert has not yet accepted → engagement stays PENDING → CEO sees "Awaiting expert acceptance"  
→ Expert accepts and signs NDA → both timestamps set → `engagements.state = CONNECTED` → CEO-5 begins  
→ Expert declines → CEO notified → can select next expert from remaining bids if any  

### CEO-4.4 · Engagement Messaging (Post-Connection)
**Entry:** Engagement CONNECTED or ACTIVE  
**Screen:** Engagement messages panel → shared thread with expert and TECH_TEAM  
**CEO actions:** Send text, attach one file per message  
→ Expert messages arrive in real time (Socket.io)  
→ TECH_TEAM messages arrive in real time  

---

## CEO-5 · Milestone Management

### CEO-5.1 · Fund a Milestone
**Entry:** Milestone in DEFINED state, CEO opens "Fund Milestone"  
**Screens:** Milestone detail → "Fund Milestone" → QR code (fixed amount) → payment pending → funded confirmation  
**Decision points:**  
→ CEO pays exact amount → IPN fires → `milestones.state = FUNDED → IN_PROGRESS` atomically  
→ Pay-gated documents for this milestone automatically released to TECH_TEAM  
→ If first milestone: `engagements.state = ACTIVE`  
→ VA expires (24h) → "Payment window expired" → re-click "Fund" → new VA  
→ Wrong amount → SePay rejects → no IPN → still AWAITING_PAYMENT  

### CEO-5.2 · Approve Business Milestone Criteria
**Entry:** `milestones.state = SUBMITTED` + `sign_off_authority = CEO or JOINT`  
**Screen:** Milestone review panel → deliverable description → files → acceptance criteria list  
**CEO action:** Read deliverable → verify each required criterion → click checkmark per criterion  
**Decision points per criterion:**  
→ Criterion met → `verified_at` set  
→ Criterion not met → write revision note → `milestones.state = IN_REVISION` → expert notified  
→ All required criteria verified → APPROVED guard passes → atomic ledger fires (CEO-5.3)

### CEO-5.3 · Milestone Approved — Watch Escrow Release
**Screen:** Milestone status panel → "Approved — disbursement processing" → "Released — payment sent"  
**Sequence shown:** APPROVED → chi hộ fires → RELEASED  
**Decision points:**  
→ Chi hộ succeeds → `milestones.state = RELEASED` ✓  
→ If last milestone → `engagements.state = CLOSED` → routes to CEO-6 (review)

### CEO-5.4 · JOINT Milestone — Waiting for TECH_TEAM to Complete Their Side
**Entry:** CEO has verified their CEO-criteria but TECH_TEAM's criteria still unverified  
**Screen:** Milestone panel → CEO criteria: all verified ✓ → TECH_TEAM criteria: pending indicator  
→ TECH_TEAM verifies their criteria → APPROVED fires → CEO-5.3  
→ TECH_TEAM flags a criterion as not met → milestone IN_REVISION → expert notified  

### CEO-5.5 · Milestone IN_REVISION (After CEO or TECH_TEAM Flags)
**Entry:** `milestones.state = IN_REVISION`  
**Screen:** Milestone panel → revision note shown to expert → "Awaiting revised submission"  
→ Expert reads revision note → re-submits deliverable → `milestones.state = SUBMITTED` → back to CEO-5.2

### CEO-5.6 · File a Dispute (Instead of Approving)
**Entry:** CEO on milestone review panel, not satisfied, does not want to approve or write revision  
**Screen:** "File Dispute" button → dispute form → select criterion to dispute → describe issue  
**Outcome:** `disputes` created, `escrow_accounts.status = FROZEN`, `milestones.state = DISPUTED`  
→ LLM Layer 1 evaluates → routes to CEO-5.6A or CEO-5.6B  

### CEO-5.6A · Dispute Auto-Resolved (LLM confidence ≥ 0.80)
**Screen:** "Your dispute has been automatically resolved"  
→ Expert wins: escrow released to expert  
→ Client wins: escrow refunded to CEO  
→ Milestone → APPROVED in both cases  

### CEO-5.6B · Dispute Escalated to Admin (LLM confidence < 0.80)
**Screen:** "Your dispute is under admin review" → passive wait state  
→ Admin resolves via dashboard → CEO notified of outcome → escrow settled  

---

## CEO-6 · Post-Engagement & Account

### CEO-6.1 · Submit Post-Engagement Review
**Entry:** `engagements.state = CLOSED`  
**Screen:** Review form → Overall rating (1–5) → Communication clarity → Milestone structure → Open text → Submit  
**Constraint:** `UNIQUE(engagement_id, reviewer_id)` — cannot submit twice  

### CEO-6.2 · View Wallet & Transaction History
**Screen:** Wallet panel → available_balance, locked_balance → transaction list (TOP_UP, ESCROW_LOCK, SUBSCRIPTION, ESCROW_RELEASE, etc.)  
**Buttons:** "Top Up" → CEO-0.2 · "Upgrade" → CEO-0.3  

### CEO-6.3 · Subscription Expiry & Renewal
**Entry:** `sub_client_expires_at` within 7 days or already expired  
**Screen:** Dashboard banner "Your Pro subscription expires in X days" → renew CTA  
→ Renew → CEO-0.3 flow → subscription extended 6 months from now  
→ Expired with active engagement → grandfathered notice → engagement continues but new elicitation blocked  

---

---

# ACTOR 2: CLIENT / TECH_TEAM

---

## TECH-0 · Onboarding (Handoff Link Only)

### TECH-0.1 · Register via Handoff Link — Valid
**Entry:** TECH_TEAM member opens handoff link URL (within 72h)  
**Screens:** Landing with project context hint → Register form (name, email, password) → Verify email → TECH_TEAM dashboard  
**DB outcome:** `users {client_subtype: TECH_TEAM}`, `tech_team_profiles {linked_project_id}` created atomically  
→ Immediately redirected to Stage 4 form (TECH-1.1)

### TECH-0.2 · Register via Handoff Link — Expired
**Entry:** TECH_TEAM member opens link after 72h  
**Screen:** Error page "This invitation has expired" → "Ask your project owner to send a new link"  
→ No registration possible → CEO must generate a new handoff link  

### TECH-0.3 · Login (Returning TECH_TEAM)
**Entry:** Previously registered TECH_TEAM logs in  
**Screen:** Login → TECH_TEAM dashboard for their one linked project  
**Constraint:** Scope is permanently locked to `linked_project_id` — no access to any other project  

---

## TECH-1 · Stage 4 Technical Architecture Handoff

### TECH-1.1 · Complete Stage 4 Form
**Entry:** Immediately after registration or returning to dashboard with Stage 4 pending  
**Screen:** Stage 4 form — stack tags multi-select, integration method (REST/gRPC/message queue/etc.), legacy data volume range, deployment expectation  
**Optional:** Schema uploads, payload samples, integration contracts  
**Decision points:**  
→ Submit → inputs written to `projects.artifact_b_json` + `artifact_a_json` → synthesis triggered → CEO notified  
→ Save draft and continue later → session preserved, synthesis not triggered yet  

### TECH-1.2 · Stage 4 Submitted — Await Project Publication
**Screen:** "Technical input submitted — awaiting project analysis" → passive wait  
→ Synthesis passes quality gate → `projects.state = PUBLISHED` → TECH_TEAM notified  
→ Synthesis fails (quality gate) → CEO is notified and re-enters elicitation → TECH_TEAM sees "project returned" banner  

---

## TECH-2 · Bid Technical Review (Surface B)

### TECH-2.1 · Receive Bid Notification & Review Panel
**Entry:** Expert submits a bid, TECH_TEAM notified  
**Screen:** Bid review panel → Expert's footprint_alignment_json (do their seam claims match our actual system?), approach_summary (does approach address our architecture?), conditional_pricing_json  
**TECH_TEAM has context:** They know the actual system from Stage 4 inputs and Artifact B

### TECH-2.2 · Approve Bid
**Screen:** Approve button → confirm modal  
**Outcome:** `capability_bids.tech_status = 'APPROVED'` → CEO review unlocked → CEO notified  

### TECH-2.3 · Request Bid Revision
**Screen:** "Request Revision" → free-text `tech_feedback` field → submit  
**Outcome:** `tech_status = 'REVISION_REQUESTED'`, `tech_feedback` written → expert notified  
→ Expert revises bid → `tech_status` reset to `PENDING` → TECH_TEAM notified to re-review  
→ Repeat loop until TECH_TEAM approves or project is abandoned  

### TECH-2.4 · Re-Review Revised Bid
**Entry:** Expert has revised bid → `tech_status = PENDING` again  
**Screen:** Same bid review panel with updated components and `version_number` indicator  
→ Same branches as TECH-2.2 or TECH-2.3  

---

## TECH-3 · Post-Connection Access

### TECH-3.1 · View Artifact B (Technical Vault)
**Entry:** `engagements.state ≥ CONNECTED` + both NDA timestamps set  
**Screen:** Tech Dashboard → "Project Blueprint" panel → unlocked → view artifact_b_json  
**Contents:** TECH_TEAM's own Stage 4 inputs (schemas, payload samples, integration contracts, stack tags)  
→ Read-only. No edit capability.

### TECH-3.2 · Access Pay-Gated Reasoning Documents
**Entry:** `milestones.state ≥ FUNDED` → `paygated_documents.release_state = RELEASED`  
**Screen:** Document inbox → list of released documents per milestone → download links  
**Access rule:** TECH_TEAM only. CEO is permanently excluded at route level.  
→ Documents contain expert's architecture design rationale (staged before funding, released atomically when CEO pays)  

### TECH-3.3 · Answer Expert Pre-Bid Technical Questions
**Entry:** Expert posts question in project messages channel pre-bid  
**Screen:** Messages panel → read question → type technical answer → send  
**Outcome:** `messages` row written. Expert and CEO both see it in real time.

---

## TECH-4 · Technical Milestone Sign-Off

### TECH-4.1 · Receive Submission Notification
**Entry:** Expert submits milestone deliverable → `milestones.state = SUBMITTED`  
**Screen:** Dashboard notification → Milestone panel  
**TECH_TEAM actions from here:** Review deliverable files, read DoD checklist (read-only), verify criteria

### TECH-4.2 · Verify Technical Criteria
**Screen:** Acceptance criteria list → verify each required criterion → set `verified_at` per criterion  
**Decision points per criterion:**  
→ Criterion met → `verified_at` set  
→ Criterion not met → write `revision_note` → `milestones.state = IN_REVISION` → expert notified  

### TECH-4.3 · TECH_TEAM-Authority Milestone Fully Verified
**Entry:** All required criteria verified for TECH_TEAM-authority milestone  
**System:** APPROVED guard count = 0 → atomic ledger fires → escrow released → chi hộ fires  
**Screen:** "Milestone approved — payment disbursed" ✓  

### TECH-4.4 · JOINT Milestone — TECH_TEAM Partial Verification
**Entry:** TECH_TEAM has verified their criteria; CEO criteria still pending  
**Screen:** Milestone panel → TECH_TEAM section: all checked ✓ → CEO section: pending  
→ CEO verifies their criteria → APPROVED fires → TECH-4.3 outcome  
→ CEO flags revision → milestone IN_REVISION → expert notified  

### TECH-4.5 · File a Dispute (TECH_TEAM can also dispute)
**Entry:** TECH_TEAM disagrees with deliverable quality on a submitted milestone  
**Screen:** "File Dispute" → select criterion → describe issue  
→ Same dispute flow as CEO-5.6 → LLM Layer 1 → Auto or Admin resolution  

---

## TECH-5 · Post-Engagement

### TECH-5.1 · Submit Post-Engagement Review (Structured Form)
**Entry:** `engagements.state = CLOSED`  
**Screen:** TECH_TEAM review form → Overall rating → Seam-specific performance questions (e.g. "Did expert proactively address ground truth baseline?") → Open text → Submit  
**Outcome:** `reviews {reviewer_role: TECH_TEAM, structured_signals_json: [...]}` written  
**Note:** `structured_signals_json` is informational only in MVP — no automatic Tier 4 seam upgrade triggered.

### TECH-5.2 · Engagement Messaging (All Phases)
**Screen:** Engagement messages panel → shared thread with CEO and Expert  
**TECH_TEAM sends:** Technical clarifications, feedback on deliverables, pre-submission notes  
**TECH_TEAM receives:** Expert questions, CEO instructions, system notifications  

---

---

# ACTOR 3: EXPERT

---

## EXP-0 · Onboarding & Profile Setup

### EXP-0.1 · Register as Expert
**Entry:** Unauthenticated user lands on AITasker → "Join as Expert"  
**Screens:** Landing → Register form → Email verification → Expert dashboard (Free tier)  
**DB outcome:** `users`, `expert_profiles`, `wallets` (balance=0), `virtual_accounts` (WALLET_TOPUP) created atomically  

### EXP-0.2 · Build Taxonomy Profile
**Screen:** Profile builder → Domain depths (6 domains, SURFACE/OPERATIONAL/DEEP) → Seam claims (10 seams, self-declare Tier 1) → Stack tags (multi-select JSONB) → Engagement model → Archetype history  
**DB:** `expert_domain_depths` rows, `expert_seam_claims` rows (`verification_tier = CLAIMED`), `expert_profiles` updated  
**Outcome:** Discoverable in matching at Tier 1 confidence weight (0.20)  
**From here:**  
→ Submit for free → discoverable but lower-weighted  
→ Upgrade to Expert Pro → unlock Tier 2 verification and bidding on better projects → EXP-0.3  

### EXP-0.3 · Top Up Wallet (Expert)
**Entry:** Expert wants to buy Expert Pro or needs to fund personal use  
**Screens:** Wallet panel → QR code → pay → balance updated  
→ Same IPN WALLET_TOPUP flow as CEO-0.2  

### EXP-0.4 · Activate Expert Pro Subscription
**Entry:** Expert tries to access Pro-gated feature or opens Subscription panel  
**Screens:** Subscription panel → Expert Pro (300K VND / 6 months) → Confirm → Success  
**Decision points:**  
→ Balance ≥ 300K → deducted → `subscription_expert_tier = 'pro'` ✓  
→ Balance < 300K → INSUFFICIENT_BALANCE → redirect to EXP-0.3  
→ Already Pro → 409 ALREADY_SUBSCRIBED  
**Unlocks:** Tier 2 verification, Tier 2–3 project bidding, AI Service Generator, earnings analytics  

### EXP-0.5 · Link Bank Account (Bank Hub)
**Entry:** Expert opens "Link Bank Account" (prompted on first withdrawal attempt or proactively)  
**Screens:** Dashboard → "Link Bank Account" → redirected to SePay Bank Hub WebView → OTP in SePay UI → return to dashboard with success  
**Outcome:** `users.sepay_bank_account_xid` set by webhook (bank-verified, not self-reported)  
**Decision points:**  
→ OTP verified → `bank_account_xid` set → withdrawal enabled  
→ OTP fails in SePay UI → TECH_TEAM stays on SePay's error handling → expert tries again  
→ Expert skips → can still bid and work, but withdrawal blocked until linked  

### EXP-0.6 · Add CEO Role (Dual-Role)
**Entry:** Expert opens Account Settings → Add Role  
**Screen:** "Also join as a Client CEO?" → verification → role added  
**Outcome:** `users.roles = ["CLIENT_CEO","EXPERT"]` → role switcher appears  

---

## EXP-1 · Tier 2 Seam Verification

### EXP-1.1 · Submit Portfolio Evidence for a Seam
**Entry:** Expert selects a seam for Tier 2 upgrade (must be at Tier 1 currently)  
**Screens:** Seam selection → Portfolio evidence form → Three structured decision-point questions → Submit  
**Pre-checks:**  
→ Expert Pro active? → else gated (route to EXP-0.4)  
→ `locked_until <= now()`? → else show lockout timer  
**Decision points after submission:**  
→ LLM confidence ≥ 0.85 → EXP-1.2 (Tier 2 granted)  
→ LLM confidence < 0.85 → EXP-1.3 (rejected)

### EXP-1.2 · Tier 2 Upgrade Granted
**Screen:** "Seam verified! Your {seam code} claim is now Evidence-Backed (Tier 2)"  
**DB:** `expert_seam_claims.verification_tier = 'EVIDENCE_BACKED'` + `platform_decisions {SEAM_TIER_UPGRADE}` written  
**Effect:** Composite score weight for this seam rises from 0.20 → 0.55; gap map color upgrades from Yellow → Amber  

### EXP-1.3 · Tier 2 Verification Rejected
**Screen:** Rejection notice + `platform_decisions.advisory_note` (names missing signal types)  
**Status:** `submission_count` incremented  
**Decision points:**  
→ `submission_count < 5` → "Try again" CTA available  
→ `submission_count = 5` → `locked_until = now() + 30 days` → lockout countdown shown → EXP-1.4  

### EXP-1.4 · 30-Day Lockout State
**Screen:** Seam card shows "Verification locked — {days} remaining"  
→ Expert can still claim other seams or work on other seams  
→ After 30 days: lockout expires → submission_count resets → EXP-1.1 available again  

---

## EXP-2 · Service Listing Management (Path B/C)

### EXP-2.1 · Create Service Listing — AI Generator Route (Expert Pro)
**Entry:** Expert clicks "Create Service Listing" (Pro active)  
**Screens:** Input capabilities + target use cases → AI generates draft (title, description, scope, timeline, suggested_price) → Expert edits → Set price, service_type, domains, seams → Publish  
**DB:** `services {state: DRAFT}` → `services {state: PUBLISHED}`  

### EXP-2.2 · Create Service Listing — Manual Route (Free Tier)
**Entry:** Expert clicks "Create Service Listing" (Free tier or Pro)  
**Screens:** Manual form → Title, description, scope, service_type, price, domains, seams → Publish  
**DB:** `services {state: DRAFT}` → `services {state: PUBLISHED}`  

### EXP-2.3 · View/Edit Existing Listing
**Screen:** Listing management panel → edit service details → save  
**Note:** Cannot change service_type after publication (immutable)  

---

## EXP-3 · Shortlist & Bidding (Path A)

### EXP-3.1 · Receive Shortlist Notification & Browse Projects
**Entry:** Matching engine places expert in shortlist after project publishes  
**Screen:** Expert dashboard → "New project match" notification → Project shortlist view  
**Each card shows:** Artifact A summary, required seams, expert's seam gap map (personal to this expert), match strength label  
**Expert actions:**  
→ Ask a pre-bid question → EXP-3.2  
→ Proceed to bid → EXP-3.3  
→ Ignore / decline to bid → no action required  

### EXP-3.2 · Ask Pre-Bid Technical Questions
**Screen:** Project messages channel → type question → send  
**Outcome:** CEO and/or TECH_TEAM notified → they respond in same thread  
→ Expert reads response → makes bidding decision  

### EXP-3.3 · Submit Capability Bid (3 Required Components)
**Entry:** Expert opens bid form for a project  
**Screen:** Three-panel bid form:  
Panel 1: Footprint Alignment — confirm seam claims, load-bearing seam warning shown if Tier 1 only  
Panel 2: Architectural Approach Summary — describe approach without proprietary design (Artifact B not yet accessible)  
Panel 3: Conditional Milestone Pricing — per-milestone pricing (free-text "TBD" rejected)  
**Decision points:**  
→ All 3 complete → submit → `engagements {type:PROJECT_BASED, state:PENDING}` + `capability_bids {state:SUBMITTED, tech_status:PENDING}` created → TECH_TEAM notified  
→ Any component missing → 422 with name of missing component → fix and resubmit  

### EXP-3.4 · Bid Revision Loop (tech_status = REVISION_REQUESTED)
**Entry:** TECH_TEAM sets REVISION_REQUESTED + writes tech_feedback → expert notified  
**Screen:** Bid panel → `tech_feedback` displayed prominently → editable bid form  
**Expert action:** Read tech_feedback → edit one or more components → submit revision  
**DB:** `capability_bids` updated in-place, `tech_status → PENDING`, `version_number += 1`  
→ TECH_TEAM re-reviews → approves or requests another revision  
→ Loop has no hard limit  

### EXP-3.5 · Bid Declined by CEO
**Entry:** CEO sets `ceo_status = DECLINED`  
**Screen:** "Your bid was not selected" notification → bid detail shows DECLINED status  
→ Expert can continue to bid on other projects  
→ No feedback given from CEO (no structured decline reason in MVP)  

### EXP-3.6 · Counter-Offer Received (negotiated_price_vnd)
**Entry:** CEO wrote `negotiated_price_vnd` before approving/declining  
**Screen:** Bid panel shows CEO's counter-offer amount → "Review counter-offer"  
**Expert decision:**  
→ Accept implicitly — no formal accept action; CEO approves and engagement proceeds  
→ Expert can discuss in messages channel if they disagree  
→ No formal counter-counter-offer mechanism in MVP  

---

## EXP-4 · Connection & Artifact B Access

### EXP-4.1 · Receive Connection Request
**Entry:** CEO approved bid → `engagements.state = PENDING` → expert notified  
**Screen:** Connection request panel → Artifact A summary (Artifact B still locked) → "Accept" or "Decline"  

### EXP-4.2 · Accept Connection → NDA → CONNECTED
**Screen:** NDA click-through modal → checkbox acknowledgment → "Confirm"  
**Outcome:** `engagements.expert_nda_accepted_at = now()`  
**Decision points:**  
→ CEO NDA already signed → both timestamps set → `engagements.state = CONNECTED` → Artifact B unlocked → EXP-4.3  
→ CEO NDA not yet signed → "Awaiting client confirmation" pending state → advance when CEO signs  
**Bank prompt:** If `bank_account_xid IS NULL` → non-blocking prompt "Link bank account to receive payments" → EXP-0.5  

### EXP-4.3 · View Artifact B (Technical Vault)
**Entry:** `engagements.state ≥ CONNECTED`, both NDA timestamps set  
**Screen:** Artifact B panel → TECH_TEAM's schemas, payload samples, integration contracts, stack specs  
**Route guard:** Expert role confirmed at FastAPI route level. CEO requests → 403.  
→ Read-only. Expert now has full technical context to plan deliverables.

### EXP-4.4 · Decline Connection
**Screen:** "Decline" → confirm modal → decline reason (optional free text)  
**Outcome:** CEO notified → CEO can select another expert from remaining bids  
→ Expert's bid status returns to declined  

---

## EXP-5 · Pay-Gated Document Staging

### EXP-5.1 · Stage a Reasoning Document
**Entry:** `engagements.state ≥ CONNECTED` → expert opens "Documents" panel  
**Screen:** Document upload → file picker → tag to milestone (dropdown of milestones for this engagement) → "Stage"  
**Outcome:** `paygated_documents {release_state: STAGED}` created  
→ Document remains STAGED until CEO funds the tagged milestone  
→ On milestone IPN: automatically released → TECH_TEAM inbox updated  

### EXP-5.2 · Check Document Release Status
**Screen:** Document panel → list of staged/released docs per milestone  
→ STAGED: "Waiting for milestone funding"  
→ RELEASED: "Released — available to technical team"  

---

## EXP-6 · Milestone Delivery (Path A & B/C)

### EXP-6.1 · Receive Milestone Funded Notification
**Entry:** `milestones.state = IN_PROGRESS` (after CEO funds via QR)  
**Screen:** Dashboard notification → "Milestone {n} is funded — begin work"  
→ Expert begins billable work  

### EXP-6.2 · Create DoD Checklist
**Entry:** `milestones.state = IN_PROGRESS`  
**Screen:** DoD panel → Add items → for each: description, is_required toggle  
**Constraints enforced in UI:**  
→ Required items: COMPLETED or remain PENDING only (NOT_APPLICABLE blocked at DB level)  
→ Non-required items: COMPLETED or NOT_APPLICABLE  
**Expert marks items as work progresses**  

### EXP-6.3 · Submit Milestone Deliverable
**Entry:** Expert believes work is complete  
**Screen:** Submission form → description + file upload → "Submit Deliverable"  
**System DoD guard fires:**  
→ All `is_required=true` items are COMPLETED? → proceed → `milestone_submissions` created → `milestones.state = SUBMITTED` → sign-off authority notified  
→ Any required item NOT COMPLETED → 422 → list of blocking items shown → expert must complete them first → EXP-6.2  

### EXP-6.4 · Milestone IN_REVISION — Resubmit
**Entry:** Sign-off authority (CEO or TECH_TEAM) flagged a criterion → `milestones.state = IN_REVISION`  
**Screen:** Milestone panel → revision note shown (from `acceptance_criteria.revision_note`) → "Address revision and resubmit"  
→ Expert reads feedback → makes changes → resubmits deliverable → `milestones.state = SUBMITTED` again  
→ Back to sign-off authority review  

### EXP-6.5 · Milestone Approved — Earnings Credited
**Entry:** Sign-off authority completes verification → APPROVED fires  
**Screen:** "Milestone approved — payment processing" → "Payment sent to your bank" (after RELEASED)  
**Earnings:** `wallets.available_balance += amount * (1 - platform_fee)` where fee read from `platform_settings`  

### EXP-6.6 · File Dispute on a Milestone
**Entry:** Expert believes criteria are being rejected unfairly  
**Screen:** "File Dispute" → select specific criterion being disputed → describe dispute → submit  
**Outcome:** `disputes` created, `escrow FROZEN`, `milestones.state = DISPUTED`  
→ LLM Layer 1 evaluates → auto-resolves or escalates to admin (same paths as CEO-5.6A / CEO-5.6B)  

---

## EXP-7 · Earnings & Withdrawal

### EXP-7.1 · View Wallet & Earnings
**Screen:** Wallet panel → `available_balance`, `locked_balance` → transaction history (ESCROW_RELEASE earnings, WITHDRAWAL history) → `withdrawal_requests` list with status  

### EXP-7.2 · Request Withdrawal — Happy Path
**Entry:** Expert has `available_balance > 0` and `bank_account_xid IS NOT NULL`  
**Screen:** Withdraw panel → enter amount → confirm → "Withdrawal initiated"  
**Sequence:** Atomic ledger deduct → `withdrawal_requests {PENDING}` → chi hộ fires async → credit IPN → `status = COMPLETED`  
**Screen updates:** PENDING → PROCESSING → COMPLETED  

### EXP-7.3 · Request Withdrawal — Bank Not Linked
**Entry:** Expert tries to withdraw without linked bank  
**Screen:** 422 error → "Link your bank account first" → CTA → EXP-0.5 (Bank Hub) → return  

### EXP-7.4 · Request Withdrawal — Insufficient Balance
**Screen:** 422 error → current balance shown → "You need at least {amount} available"  

### EXP-7.5 · Withdrawal Failed (Chi Hộ Error)
**Entry:** Chi hộ API returns error after ledger committed  
**Screen:** "Withdrawal failed — your balance has been restored" notification  
**DB:** Atomic compensation: `wallets.available_balance += amount`, REVERSAL ledger row, `withdrawal_requests.status = FAILED`  

---

## EXP-8 · Post-Engagement

### EXP-8.1 · Submit Post-Engagement Review
**Entry:** `engagements.state = CLOSED`  
**Screen:** Expert review form → Overall rating → "Was Artifact B complete when first accessed?" → CEO communication clarity → Milestone sign-off timeliness → Open text → Submit  
**Constraint:** `UNIQUE(engagement_id, reviewer_id)` — one submission only  

---

---

# ACTOR 4: ADMIN

---

## ADM-1 · Platform Integrity Monitor (Read-Only)

### ADM-1.1 · View Spec Auto-Return Log
**Entry:** Admin opens Platform Integrity Monitor  
**Screen:** Log of all `platform_decisions WHERE decision_type = 'SPEC_AUTO_RETURN'` — shows: project_id, which void failed, LLM advisory_note, timestamp  
**Decision from here:**  
→ Sees a suspicious pattern of repeated auto-returns for one CEO → investigate account → ADM-3.2  
→ Sees a systemic elicitation failure → may trigger spec pull-back if project somehow published → ADM-4.1  

### ADM-1.2 · View Seam Verification Log
**Screen:** All `platform_decisions WHERE decision_type IN ('SEAM_TIER_UPGRADE', 'PORTFOLIO_EVAL')` — shows: expert_id, seam_code, llm_confidence, decision, advisory_note, submission count  
→ Monitors for abuse patterns (rapid failures, suspicious approval patterns)  
→ Monitors for lockout events  

### ADM-1.3 · View Dispute Resolution Log
**Screen:** All `disputes` — shows: state, llm_confidence, resolution, filed_by, filed_at  
→ Monitors auto-resolution rate and manual escalation rate  
→ Spots disputes with very low LLM confidence (systematic delivery issues)  

---

## ADM-2 · Transaction Ledger (Read-Only)

### ADM-2.1 · View All Wallet Transactions
**Screen:** Full `wallet_transactions` table — all users, all transaction types, all amounts  
**Filters:** Date range, user, transaction_type, engagement  

### ADM-2.2 · View Escrow Accounts Status
**Screen:** All `escrow_accounts` — status (HELD/RELEASED/FROZEN/REFUNDED/SPLIT), amount, parent entity  
→ Identifies FROZEN escrows (active disputes) quickly  

### ADM-2.3 · View Withdrawal Requests Audit Trail
**Screen:** All `withdrawal_requests` — status (PENDING/PROCESSING/COMPLETED/FAILED), amounts, disbursement IDs, timestamps  

---

## ADM-3 · Account Management

### ADM-3.1 · Browse User Accounts
**Screen:** User list — filter by role, subscription tier, active/suspended status  

### ADM-3.2 · Suspend a User Account
**Entry:** Admin identifies a problematic account  
**Screen:** User detail → "Suspend Account" → confirm + reason  
**Outcome:** `users.is_active = false` → user's existing JWTs invalidated on next verification → user sees "Account suspended" on next login  
**Decision points:**  
→ User has active engagements with funded escrow → escrow stays HELD (escrow not released on suspension — a separate admin dispute action is needed)  

### ADM-3.3 · Reactivate a Suspended Account
**Screen:** Suspended user detail → "Reactivate Account" → confirm  
**Outcome:** `users.is_active = true` → user can log in again  

---

## ADM-4 · Emergency Spec Pull-Back

### ADM-4.1 · Pull Back a Published Spec
**Entry:** Admin identifies a problematic published spec (from Integrity Monitor or external report)  
**Screen:** Project search → find project → "Emergency Pull-Back" → enter reason → confirm  
**Guard check:**  
→ `projects.state = PUBLISHED` → action proceeds  
→ `projects.state ≠ PUBLISHED` (already DRAFT, RETURNED, or SUSPENDED) → 422 "Cannot pull back a spec in {state}" → action blocked  
**Outcome:** `projects.state = SUSPENDED`, `platform_decisions {SPEC_AUTO_RETURN, advisory_note: admin reason}` written  
→ Spec hidden from all expert views and matching engine  
→ CEO notified: "Your project spec was pulled back — contact support"  

---

## ADM-5 · Dispute Monitor & Manual Resolution

### ADM-5.1 · View All Disputes
**Screen:** Dispute Monitor → all `disputes` — filter by state (AUTO_RESOLVED / MANUAL_REVIEW / RESOLVED)  
→ AUTO_RESOLVED: LLM handled it — read-only display of outcome  
→ MANUAL_REVIEW: admin must act → ADM-5.2  
→ RESOLVED: admin already handled — historical record  

### ADM-5.2 · Review a MANUAL_REVIEW Dispute
**Entry:** `disputes.state = MANUAL_REVIEW` (LLM confidence was < 0.80)  
**Screen:** Dispute detail →  
- Criterion text (what was promised)  
- Milestone submission (what was delivered)  
- LLM confidence score and its finding  
- Escrow amount at stake  
- Messages thread (read-only — admin sees all engagement messages for dispute audit)  

### ADM-5.3 · Release to Expert
**Screen:** "Release to Expert" button → confirm modal  
**Outcome:** ESCROW_RELEASE chain fires (same as normal milestone APPROVED) → `disputes.state = RESOLVED`, `milestones.state = APPROVED`  

### ADM-5.4 · Refund to Client
**Screen:** "Refund to Client" button → confirm modal  
**Outcome:** ESCROW_REFUND → CEO's locked → available → `escrow_accounts.status = REFUNDED` → `disputes.state = RESOLVED`, `milestones.state = APPROVED`  

### ADM-5.5 · Split 50/50
**Screen:** "Split 50/50" button → confirm modal showing exact amounts  
**Outcome:** ESCROW_SPLIT → both wallets credited 50% → `escrow_accounts.status = SPLIT` → `disputes.state = RESOLVED`, `milestones.state = APPROVED`  

---

## ADM-6 · Analytics Dashboard

### ADM-6.1 · View Platform Metrics
**Screen:** Analytics dashboard showing:  
- Active projects by archetype and tier  
- Elicitation completion rate and auto-publish pass rate  
- Portfolio auto-upgrade rate and auto-rejection rate  
- Dispute rate and LLM auto-resolution rate  
- Milestone completion rate and average review cycle time  
- Review completion rate and average ratings  

### ADM-6.2 · Export Research Data
**Screen:** Export panel → select date range → export CSV  
→ Used for research evidence (RQ1: matching accuracy, RQ2: AI scope definition, RQ3: trust factors)  

---

---

# CROSS-ACTOR HANDOFF POINTS (Triggers across actor boundaries)

These are the moments where one actor's action creates a notification or screen state change for another actor. Critical for screen flow design.

| Trigger Actor | Action | Receiving Actor | Resulting Screen/State |
|---|---|---|---|
| CEO | Generates handoff link | TECH_TEAM | Link opens registration form |
| CEO | Funds milestone | EXPERT | "Milestone {n} funded — begin work" notification |
| CEO | Funds milestone | TECH_TEAM | Pay-gated documents appear in doc inbox |
| CEO | Approves bid | EXPERT | Connection request notification |
| CEO | Completes NDA | EXPERT | "Client signed — your acceptance unlocks Artifact B" |
| CEO | Verifies last criterion | EXPERT | Earnings credited notification |
| CEO | Writes revision note | EXPERT | "Revision requested" notification with note text |
| CEO | Files dispute | EXPERT | Escrow frozen notification |
| CEO | Files dispute | ADMIN | Appears in Dispute Monitor (after LLM layer) |
| TECH_TEAM | Approves bid | CEO | "Technical review complete — your review is unlocked" |
| TECH_TEAM | Requests bid revision | EXPERT | "Revision requested" + tech_feedback shown |
| TECH_TEAM | Verifies all TECH_TEAM criteria (JOINT) | CEO | "Technical criteria verified — your sign-off needed" |
| EXPERT | Submits bid | TECH_TEAM | "New bid for technical review" notification |
| EXPERT | Accepts connection + NDA | CEO | `engagements.state = CONNECTED` — connection confirmed |
| EXPERT | Submits deliverable | CEO (or TECH_TEAM) | "Milestone {n} submitted for your review" |
| EXPERT | Files dispute | CEO | Escrow frozen notification |
| EXPERT | Files dispute | ADMIN | Appears in Dispute Monitor |
| ADMIN | Resolves dispute | CEO + EXPERT | "Dispute resolved — [outcome]" notification |
| ADMIN | Pulls back spec | CEO | "Your project spec was suspended" banner |
| ADMIN | Suspends account | Any actor | Logout + "Account suspended" on next login attempt |
| SePay IPN | MILESTONE payment confirmed | TECH_TEAM | Pay-gated docs released in inbox |
| SePay IPN | Chi hộ COMPLETED | EXPERT | "Payment of {amount} sent to your bank" |