# AITasker End-to-End QA Execution Manual

**Document purpose:** A click-by-click, screen-by-screen, state-aware manual for validating the integrated React frontend, NestJS backend, FastAPI AI service, PostgreSQL/Prisma persistence, Socket.io events, SePay-style payment callbacks, and role-based business rules.

**Audience:** Manual QA, E2E automation engineers, backend/frontend developers supporting defect triage, product owners, and acceptance-test reviewers.

**Source basis:** The uploaded full codebase snapshot, including React routes and feature screens, NestJS controllers/services/DTOs, FastAPI OpenAPI routes, Prisma schema, simulation scripts, and existing T01–T17 E2E suites; plus the runtime NestJS Swagger export supplied from branch `feat/Hung/FE-BE-Wiring`.

> **Authoritative endpoint baseline for this build:** The running NestJS application exposes **222 REST operations** in `swagger.json`, counted only across `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`. This runtime Swagger export is the canonical denominator for frontend-to-backend REST coverage on the tested branch. The earlier claims of **225** or **255 backend endpoints** are not supported by this runtime artifact and must not appear in QA sign-off unless a later release Swagger export proves a different count.
>
> The uploaded FastAPI OpenAPI document separately exposes **12 internal AI-service HTTP operations**. These are NestJS-to-FastAPI or operational contracts, not additional browser-consumed NestJS endpoints. Therefore maintain separate coverage totals:
>
> - **Frontend ↔ NestJS REST coverage:** `222/222`
> - **NestJS ↔ FastAPI internal HTTP coverage:** `12/12`
> - **Socket.io events, email delivery, SePay callbacks, and other non-REST contracts:** tracked separately and never added to the 222 REST denominator
>
> The obsolete 228-operation static extraction has been removed from this manual. It mixed runtime NestJS routes with internal AI-service operations and source-level decorator findings, so it is not suitable as a QA inventory.

---

## 1. What “Pass” Means

A scenario passes only when all six layers agree:

1. **Gesture/UI:** The intended control is visible, enabled only when valid, gives loading/disabled feedback, and prevents duplicate submission.
2. **HTTP/socket contract:** The expected request or event fires once, with the correct method, URL, authentication, role, payload, and correlation IDs.
3. **Response handling:** Success, validation, authorization, conflict, timeout, and server-error responses render correctly without stale or contradictory UI.
4. **Persistence:** The expected Prisma rows/fields are created or updated exactly once; unrelated records remain unchanged.
5. **State machine:** Project, bid, offer, engagement, milestone, escrow, dispute, withdrawal, notification, and document-release states transition only through valid branches.
6. **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh and re-login.

A visually successful click with a wrong DB state, duplicate ledger entry, missing socket event, or inaccessible follow-up screen is a **failure**.

## 2. Required Evidence Per Test Case

For every case, capture:

- Test case ID, build/commit, environment, tester, timestamp.
- Actor account and active role/subtype.
- Starting DB/business state.
- Browser route and screen/component.
- Exact gestures and entered values.
- Network request/response evidence.
- Before/after screenshots.
- Relevant DB row IDs and before/after values.
- Socket event/notification evidence when applicable.
- Result: Pass / Fail / Blocked / Not Applicable.
- Defect ID and reproducibility notes.

## 3. Test Environments

### 3.1 Isolated automated/manual integration environment

Use the repository test stack so destructive tests do not touch Neon or production-like data:

```bash
docker compose -f docker-compose.test.yml up -d
cd backend
npm run test:e2e
```

The test stack uses PostgreSQL 16 on host port `5433`, a NestJS test container, and a FastAPI test container. Stop and recreate it between destructive suites when strict isolation is required.

### 3.2 Full UI environment

```bash
docker compose up --build
```

Expected default entry points from the snapshot:

- Frontend: `http://localhost/`
- NestJS through host mapping: `http://localhost:3001`
- FastAPI: `http://localhost:8000`

### 3.3 Required observability

Keep open during manual execution:

- Browser DevTools: Network, Console, Application/Storage.
- Backend logs.
- FastAPI logs for AI-mediated flows.
- PostgreSQL query console or Prisma Studio.
- Socket.io event inspection/logging.
- Email test inbox for OTP/reset/handoff flows.

## 4. Canonical Test Personas and Seed Data

Create isolated accounts; do not reuse one mutable account across the entire suite.

| Persona | Required role/subtype | Starting conditions |
|---|---|---|
| CEO-A | CLIENT / CEO | Verified, wallet funded, no subscription |
| CEO-B | CLIENT / CEO | Verified, Pro subscription, wallet funded |
| CEO-C | CLIENT / CEO | Verified, insufficient wallet balance |
| EXP-A | EXPERT | Complete profile, linked bank, eligible seams/domains |
| EXP-B | EXPERT | Incomplete profile, no linked bank |
| EXP-C | EXPERT | Tier-2 portfolio rejection/lockout candidate |
| TECH-A | CLIENT / TECH_TEAM | Registered through valid handoff |
| TECH-B | CLIENT / TECH_TEAM | Assigned to active project/engagement |
| ADMIN-A | ADMIN | Full administrative access |
| SUSPENDED | Any | Suspended by admin |

Seed at least these business objects:

- One draft elicitation session at each stage.
- One published project with shortlist results.
- One invited expert and one non-invited expert.
- Bids in DRAFT, SUBMITTED, REVISION_REQUESTED, TECH_APPROVED, SELECTED, and legacy/reconciliation-needed conditions.
- Engagements in PENDING, CONNECTED, ACTIVE, COMPLETED, and suspended/closed-like conditions supported by the schema.
- Milestones in DEFINED, FUNDING_PENDING, IN_PROGRESS, SUBMITTED, REVISION_REQUESTED, APPROVED, and disputed conditions.
- One expired and one active virtual account.
- One pending withdrawal and one failed/refunded withdrawal.
- One auto-resolvable and one manual-review dispute.
- Unread/read notifications and conversations with unread messages.

## 5. Universal Checks Applied to Every Screen

Before scenario-specific checks, verify:

- Direct URL access respects authentication and role guards.
- Browser Back/Forward does not resurrect forbidden or stale state.
- Refresh preserves authenticated state or cleanly redirects to login.
- Repeated click/Enter does not create duplicate records.
- Buttons are keyboard reachable; modal focus is trapped and restored.
- Forms trim input where intended and clearly display field-level errors.
- Empty, loading, partial, error, and retry states are testable.
- Tables preserve filters/pagination after detail navigation where intended.
- IDs from one actor cannot be substituted to access another actor’s data.
- A 401 clears/refreshes authentication correctly; a 403 explains lack of permission; a 404 does not leak resource existence; a 409/422 keeps user input.
- Socket reconnect does not duplicate messages or notifications.
- Money is displayed in VND consistently and server values—not formatted strings—drive calculations.

---

## F01. Identity, Registration, OTP, Login, Password Recovery, and Role Switching

**Actors:** All actors

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Landing/Auth modal**<br>`/` | Open sign-up; choose CEO or Expert; enter name/email/password; submit | Registration request is sent once; OTP step appears; password rules and duplicate-email errors are visible |
| 2 | **OTP verification**<br>`Auth modal` | Enter invalid OTP, expired OTP, resend, then valid OTP | Invalid/expired attempts fail without login; resend invalidates or supersedes old code as designed; valid code issues JWT and routes by active role |
| 3 | **Login**<br>`/` | Test valid login, wrong password, unknown email, suspended account | Only valid active account enters dashboard; errors do not disclose sensitive account status beyond intended policy |
| 4 | **Forgot/reset password**<br>`/ and /reset-password/:token` | Request reset; open malformed, expired, reused, and valid token; change password | Only valid unused token succeeds; prior password stops working; active sessions behave according to policy |
| 5 | **Role management**<br>`Profile/RoleSwitcher` | Add second role; switch CEO↔Expert; refresh | Token/user context updates; route/nav changes; role-specific cache does not leak data |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F02. CEO and Expert Profile Completion, Tax Verification, Domains, Seams, and Portfolio

**Actors:** CEO, Expert

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Account settings**<br>`/ceo/account-setting or /expert/account-setting` | Edit all fields; cancel; save; submit invalid/oversized values | PUT/PATCH persists allowed fields only; refresh shows saved values |
| 2 | **CEO tax verification**<br>`CEO profile/settings` | Enter invalid and valid Vietnamese tax code; retry external failure | Verification status is accurate; failed verification does not mark verified |
| 3 | **Expert profile**<br>`/expert/service/expert-profile` | Edit bio, stack tags, engagement model; sync domains and seams | Grid selections persist atomically; removed claims disappear; matching inputs reflect latest profile |
| 4 | **Portfolio submission**<br>`Expert profile/verification` | Submit incomplete, valid, failed AI, passed AI, and repeated entries | AI call and platform decision are recorded; tier/failure/lockout state follows response; history is visible |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F03. Wallet Top-up, Subscription, Bank Linking, and Withdrawal Eligibility

**Actors:** CEO, Expert

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Wallet**<br>`/ceo/wallet or /expert/wallet` | Inspect balance and transactions; refresh and paginate | Displayed totals reconcile with ledger; actor sees only own wallet |
| 2 | **Top-up**<br>`Wallet top-up panel` | Enter invalid/valid amount; create VA; let expire; recreate; simulate IPN twice | One credit only; duplicate callback is idempotent; QR/expiry updates |
| 3 | **Subscription plans**<br>`/ceo/subscriptions/plans or /expert/subscriptions/plans` | Activate with insufficient and sufficient balance; repeat activation | Balance and tier update atomically; duplicate activation is prevented; gated UI updates after token/profile refresh |
| 4 | **Bank link**<br>`/expert/wallet/link-bank` | Submit invalid and valid account details; simulate provider failure | Only verified link unlocks withdrawal; sensitive details are masked |
| 5 | **Withdrawal**<br>`/expert/wallet/withdraw` | Request below minimum/above balance/valid; cancel pending request | Hold/deduction and restoration are atomic; transaction history and admin queue agree |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F04. Elicitation Stage 1–5, Draft Persistence, Handoff, Quality Gate, and Project Publication

**Actors:** CEO, Tech Team

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Start session**<br>`/ceo/projects/elicitation` | Create session; type problem; navigate away during autosave | Session ID is created once; draft survives refresh |
| 2 | **Stage 1**<br>`Stage1Symptoms` | Submit empty, gibberish, valid symptom text; inspect extracted results | Validation/gibberish handling is clear; AI extraction maps into session without losing original input |
| 3 | **Stage 2**<br>`Stage2Archetype` | Select/reselect archetype; go back/forward | Selection persists; downstream data is invalidated or retained consistently |
| 4 | **Stage 3**<br>`Stage3Probes` | Answer probes with vague and concrete responses | Vagueness feedback blocks or guides correctly; accepted answers advance exactly once |
| 5 | **Stage 4A**<br>`Stage4ScenarioA` | Choose self-technical; enter stack/integration/volume; upload artifacts; save draft | Required artifacts enforced; draft and final submission are distinct |
| 6 | **Stage 4B**<br>`Stage4HandoffLink / HandoffRegister / Stage4Form` | Generate link; open logged out; register/log in; submit; reuse and expire link | Claims bind tech member to intended session; invalid/reused/expired link fails; CEO receives update |
| 7 | **Stage 5**<br>`Stage5Loading / QualityGatePassed / QualityGateFailed` | Trigger synthesis; test AI success, timeout, malformed response, score above/below threshold | No duplicate project; returned stage/advisory is correct; published project appears in CEO projects and marketplace as intended |
| 8 | **Session history**<br>`/ceo/projects/session-history` | Continue, revert, abandon, and delete sessions | Confirmation and state restrictions work; deleted session cannot be restored |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F05. Project Detail, Matching, Shortlist, Invitations, and Expert Marketplace Access

**Actors:** CEO, Expert

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **CEO projects**<br>`/ceo/projects` | Filter/open draft, returned, published project | Correct status/actions shown; unauthorized project ID denied |
| 2 | **Shortlist**<br>`/ceo/projects/:projectId/shortlist` | Load results; inspect score/gaps; invite expert; invite twice | Matching output maps correctly; duplicate invite prevented; invited expert notified |
| 3 | **Expert marketplace**<br>`/expert/marketplace or /expert/service/projects` | Browse/filter/open project; inspect missing-requirements badges | Only eligible/published projects shown; Artifact B remains hidden |
| 4 | **Invitation handling**<br>`Expert project/invitation UI` | Accept/decline invitation; repeat action | State updates once and appears to CEO |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F06. Bid Creation, Versioned Offers, Technical Review, CEO Decision, and Reconciliation

**Actors:** Expert, Tech Team, CEO

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Bid form**<br>`/expert/bids/:projectId` | Enter footprint, approach, conditional pricing; save/edit/submit; invalid totals | Draft mutation and final submission follow allowed states; server validation preserved |
| 2 | **Tech review list/detail**<br>`/tech-team/bids and /tech-team/bids/:bidId` | Open submitted bid; request revision; approve; try both actions twice | Only assigned tech team can act; revision returns to expert; approval moves to CEO gate |
| 3 | **CEO bid detail**<br>`/ceo/projects/:projectId/bids/:bidId` | Review tech-approved bid; attempt action before approval | CEO gate blocks premature decision; offer timeline is complete |
| 4 | **Counter-offer**<br>`CounterOfferPanel / CounterOfferReceived` | CEO creates offer; expert accepts/declines/counters where supported; act on stale version | Only latest pending version is actionable; stale version returns conflict; accepted terms are immutable |
| 5 | **Legacy reconcile**<br>`Legacy bid detail` | Open legacy bid and trigger reconcile | Versioned offer baseline is created once; repeated reconcile is idempotent |
| 6 | **Selection**<br>`BidDecisionConfirm` | Accept final offer | Bid SELECTED; competing bids handled per policy; engagement PENDING; milestone contract generated atomically |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F07. NDA Gate, Engagement Connection, Artifact B, and Technical Vault Access

**Actors:** CEO, Expert, Tech Team

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **CEO NDA**<br>`/ceo/engagements/:engagementId/nda` | Read/accept; refresh; repeat | Acceptance timestamp persists once; state remains pending until other party |
| 2 | **Expert NDA**<br>`/expert/engagements/:engagementId/nda` | Attempt Artifact B before signing; sign; refresh | Artifact B denied before all conditions; after both signatures engagement becomes CONNECTED and content unlocks |
| 3 | **Authorization matrix**<br>`Project/engagement detail` | Try non-selected expert, unrelated CEO, unassigned tech member, and altered IDs | No technical content leakage through body, errors, logs, or cached query |
| 4 | **Pay-gated vault**<br>`Expert/Tech vault screens` | Inspect staged, locked, released documents across funding states | Release state is server-driven and remains correct after re-login |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F08. Service Listing Creation, AI Drafting, Publishing, Purchase, and Direct Checkout

**Actors:** Expert, CEO

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Expert services**<br>`/expert/service` | Create manually; use AI generator; edit; publish; unpublish/delete where supported | AI draft is reviewable and not auto-persisted; CRUD state matches listing grid |
| 2 | **Service detail**<br>`/ceo/marketplace/service/:id` | Open active/inactive/other expert listing | Only purchasable listing exposes checkout |
| 3 | **Purchase**<br>`/ceo/marketplace/service/:id/purchase` | Buy with invalid state; create exact VA; expire/recreate; simulate IPN twice | One SERVICE_PURCHASE engagement; escrow locks exactly once; engagement transitions directly to ACTIVE as designed |
| 4 | **Expert orders**<br>`/expert/service/orders` | Observe new purchase and refresh | Order, amount, buyer-safe details, and state are correct |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F09. Milestone Definition, Terms Lock, Criteria, DoD, Funding, and Pay-gated Documents

**Actors:** CEO, Expert, Tech Team

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Milestone list/create**<br>`/ceo/engagements/:id/milestones` | Bulk initialize; create/edit/delete before lock; attempt after lock | Pre-lock CRUD works; post-lock changes blocked except explicit negotiation path |
| 2 | **Criteria editor**<br>`AcceptanceCriteriaEditor` | Add/edit/delete objective and subjective criteria | Criterion AI check/suggestions render; role and state rules enforced |
| 3 | **DoD**<br>`DodChecklist/DoDEditor` | Create items; mark required complete without note; mark N/A; edit after submission | Required notes/gates enforced; locked states immutable |
| 4 | **Stage documents**<br>`PaygatedDocsStaging` | Stage one/bulk docs; remove/re-stage; inspect metadata | Documents start locked and bind to correct milestone |
| 5 | **Fund**<br>`/ceo/.../milestones/:milestoneId/fund` | Create funding VA; duplicate click; expire/recreate; callback with wrong amount/reference and valid callback | Only valid callback moves escrow/milestone; one ledger effect; staged docs release |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F10. Deliverable Submission, Retraction, Revision, Criteria Sign-off, Approval, and Escrow Release

**Actors:** Expert, Tech Team, CEO

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Submit**<br>`ExpertMilestoneDetail/DeliverableSubmit` | Attempt with pending DoD; complete DoD; upload/link; submit twice | 422 on unmet gate; one submission on success; milestone SUBMITTED; reviewers notified |
| 2 | **Retract**<br>`Latest submission action` | Retract latest submission before review; attempt after review | Only allowed latest submission is deleted/retracted; milestone returns to valid state |
| 3 | **Tech sign-off**<br>`TechTeamMilestoneDetail/CriteriaSignOff` | Approve criteria or request revision with/without note | Reviewer role recorded; revision reopens expert workflow |
| 4 | **CEO sign-off**<br>`CEO MilestoneDetail/CriteriaVerify` | Verify after tech review; attempt before prerequisites | Final gate enforced; all criteria approval transitions milestone APPROVED |
| 5 | **Release**<br>`Wallet/ledger` | Observe approval transaction, available balance, optional auto-withdrawal | Escrow release and ledger entries are atomic/idempotent; expert and CEO balances reconcile |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F11. Dispute Filing, AI Layer-1 Arbitration, Manual Review, and Ledger Resolution

**Actors:** CEO, Expert, Admin

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **File dispute**<br>`DisputeFile` | File against eligible criterion; omit reason; duplicate; file in wrong milestone state | Only eligible dispute created; escrow freezes; actors notified |
| 2 | **AI arbitration**<br>`DisputeResult` | Run ≥0.80 expert win, ≥0.80 client win, <0.80, timeout/error | High-confidence result auto-resolves exactly once; low confidence enters MANUAL_REVIEW; failure does not move money incorrectly |
| 3 | **Admin monitor**<br>`/admin/disputes` | Filter/open dispute; review evidence and AI reasoning | Queue/state accurate; sensitive data scoped |
| 4 | **Manual resolve**<br>`/admin/disputes/:id/resolve` | Release, refund, split; double-submit and concurrent admin action | One terminal resolution; ledger totals equal frozen amount; all parties notified |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F12. Messaging, Inbox, Notifications, and Milestone AI Assistant

**Actors:** All actors

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Conversation list**<br>`/ceo/messages, /expert/messages` | Open project and engagement threads; paginate; unread/read | Correct scope; unread count agrees across list and top nav |
| 2 | **Message thread**<br>`/.../engagements/:id/messages` | Send text, empty, oversized, rapid duplicate; disconnect/reconnect | Persisted message appears once and socket delivery is ordered; fallback refresh works |
| 3 | **Notifications**<br>`/.../notifications` | Mark one/all read, clear, refresh, receive while offline | DB persistence and unread badge reconcile; no cross-user leakage |
| 4 | **Milestone assistant**<br>`MilestoneChatAssistant/MilestoneChatPanel` | Ask explanation; request structured edit; apply as CEO; copy as expert; reload history | Session history persists; valid edit schema only; unauthorized actor cannot mutate milestones; copy action does not mutate |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F13. Reviews and Engagement Completion

**Actors:** CEO, Expert, Tech Team

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Review forms**<br>`Role-specific engagement review routes` | Submit valid review; duplicate; edit where supported; review before completion | Eligibility and uniqueness enforced; aggregates update correctly |
| 2 | **Public profile**<br>`UserProfilePage` | Inspect rating/profile after review | Only intended public data shown; aggregate matches accepted reviews |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.

## F14. Admin Oversight, Configuration, Prompts, Integrity, Ledger, and Withdrawals

**Actors:** Admin

### Preconditions

- Use dedicated seeded records in the exact starting state required by each branch.
- Record actor IDs and entity IDs before starting.
- Clear DevTools network log and preserve log on navigation.

### Screen-by-screen execution

| Step | Screen / route | Tester gestures | Expected observable result |
|---:|---|---|---|
| 1 | **Admin overview/analytics**<br>`/admin` | Load widgets, empty/error states, export | Metrics reconcile with source queries; export respects filters |
| 2 | **Users**<br>`/admin/users` | Search; suspend/reactivate; act on self/other admins where restricted | Auth is invalidated or blocked according to policy; audit/notification generated |
| 3 | **Projects/engagements/experts**<br>`/admin/oversight/*` | Filter/open; suspend/pull back/reactivate supported objects | Public visibility and actor screens update consistently |
| 4 | **CMS configs**<br>`/admin/config/*` | Create/edit/reorder/delete domains, seams, archetypes, probes, voids, packages | Validation/referential integrity enforced; new elicitation/profile sessions use updated configuration |
| 5 | **Prompts**<br>`/admin/config/prompts` | Edit template; test invalid Jinja2-like syntax; save; invoke AI flow | Version/content persist; malformed template handled safely; downstream request uses expected prompt |
| 6 | **Integrity**<br>`/admin/integrity` | Inspect dispute, seam, and auto-return decisions | Decision log links to source entity and is immutable/auditable |
| 7 | **Ledger**<br>`/admin/ledger` | Filter/paginate/export; compare wallet/escrow transactions | Double-entry or platform ledger invariants reconcile |
| 8 | **Withdrawals**<br>`/admin/withdrawals` | Mark sent; fail/refund; duplicate and concurrent action | Terminal state once; balances/ledger/notifications correct |


### Mandatory branch matrix

For every mutation in this flow, execute:

| Branch | Required check |
|---|---|
| Happy path | Correct role, valid payload, valid state |
| Client validation | Blank, malformed, minimum/maximum, whitespace, duplicate input |
| Server validation | Bypass UI and send malformed payload; expect 400/422 |
| Authentication | Missing, expired, malformed token |
| Authorization | Correct token but wrong role, subtype, ownership, or assignment |
| State conflict | Repeat action, act on stale entity/version, act from terminal state |
| Not found / IDOR | Random UUID and another actor’s valid UUID |
| Dependency failure | AI, email, payment provider, DB, or socket unavailable |
| Concurrency | Two tabs/two actors submit competing actions |
| Refresh/re-login | Final state remains correct after cache loss |

### Exit criteria

- All happy and negative branches have evidence.
- Final UI state matches persisted DB state.
- Cross-actor notification and visibility checks pass.
- Every observed endpoint is linked to an Endpoint Coverage Ledger row.


---

## 6. Cross-Flow End-to-End Journeys

These journeys validate integration boundaries that isolated screen tests miss.

### J01 — Complete custom-project success journey

1. CEO registers and verifies OTP.
2. CEO tops up wallet and optionally activates subscription.
3. CEO completes elicitation through Stage 5 and publishes.
4. Matching produces shortlist; CEO invites EXP-A.
5. EXP-A submits bid.
6. TECH-A requests revision, EXP-A resubmits, TECH-A approves.
7. CEO counters; EXP-A accepts; engagement is created.
8. CEO and EXP-A sign NDA; Artifact B unlocks.
9. Milestones/criteria/DoD are finalized.
10. EXP-A stages pay-gated documents.
11. CEO funds milestone; callback activates milestone and releases documents.
12. EXP-A submits deliverable.
13. TECH-A and CEO sign off all criteria.
14. Escrow releases; expert wallet and ledger update.
15. Parties exchange reviews.

**Invariant checkpoints:** no duplicate project, bid, offer, engagement, milestone, VA, submission, escrow release, withdrawal, message, or notification.

### J02 — Revision-heavy journey

Exercise Stage 3 vagueness, quality-gate return, bid revision, counter-offer version conflict, DoD gate failure, deliverable retraction, technical revision request, and successful resubmission.

### J03 — Dispute journey

Complete a funded/submitted milestone, file a dispute, test one auto-resolution and one manual resolution, and reconcile frozen escrow to final ledger balances.

### J04 — Service-purchase journey

Expert creates an AI-assisted listing, CEO purchases it, duplicate IPN is sent, engagement becomes active once, execution completes, and both parties review.

### J05 — Security and tenancy journey

Across two CEOs, two experts, and two tech members, substitute project, bid, engagement, milestone, submission, dispute, wallet, withdrawal, message, notification, and config IDs. Confirm zero cross-tenant data leakage.

## 7. Payment and Webhook Simulation Protocol

### 7.1 Milestone/service payment

Use the repository script documented in the handover, for example:

```bash
npm run simulate:ipn -- --va MILESTONEHdj293
```

Also execute these negative callbacks:

- Unknown VA.
- Expired/cancelled VA.
- Wrong amount.
- Same provider transaction ID twice.
- New provider transaction ID for an already-paid VA.
- Callback before the UI begins polling/listening.
- Callback while the user is logged out.
- Concurrent callbacks.
- Invalid/missing HMAC.

### 7.2 Required payment invariants

- A provider event affects money at most once.
- The sum of wallet, escrow, platform, refund, and payout entries balances.
- A failed DB transaction leaves no partial state transition.
- UI polling and sockets are presentation mechanisms, not the source of truth.
- Reopening the screen obtains the same final state from REST.

## 8. AI-Service Failure Injection

For Stage 1/3/4/5, matching, portfolio evaluation, dispute evaluation, criterion checking, service generation, Artifact B gate, and milestone chat, test:

- Normal valid JSON.
- Slow response just below timeout.
- Timeout.
- 422 from FastAPI validation.
- 500/503.
- Empty body.
- Malformed JSON.
- Valid JSON missing required fields.
- Out-of-range confidence/score.
- Prompt injection-like user content.
- Duplicate NestJS retry.

Record whether each NestJS flow is fail-open, fail-closed, retryable, or manually recoverable. The Stage 3 vagueness route is documented as failing open internally; QA must verify the actual observable behavior.

## 9. Socket and Notification Contract Checks

For each event-producing action:

1. Keep recipient online in another browser/profile.
2. Perform the action and record socket event name/payload.
3. Confirm UI updates without manual refresh.
4. Refresh recipient and confirm REST/DB state matches.
5. Repeat with recipient offline, then log in.
6. Disconnect/reconnect socket and ensure no duplicate event rendering.
7. Confirm the event is scoped to intended user/project/engagement rooms.

At minimum cover: handoff submitted, invitation, bid submitted/revised/approved/selected, NDA completion, payment success, document release, deliverable submission, revision request, criterion sign-off, milestone approval, dispute updates, withdrawal updates, messages, and notifications.

## 10. Existing Automated Test Alignment

The snapshot includes these backend E2E suites; manual cases should cite and extend them rather than duplicate them blindly:

| Suite | Primary manual coverage linkage |
|---|---|
| T01 IPN idempotency | F03, F08, F09, F10 |
| T02 ledger atomicity | F03, F10, F11, F14 |
| T03 DoD gate | F09, F10 |
| T04 Artifact B guard | F07 |
| T05 bid CEO gate | F06 |
| T06 wallet check | F03, F09 |
| T07 DoD DB check | F09, F10 |
| T08 Chi Hộ failure | F03, F14 |
| T09 escrow check | F09–F11 |
| T10 criteria role | F09, F10 |
| T11 subscription balance | F03 |
| T12 approved guard | F10 |
| T13 elicitation full flow | F04 |
| T14 system updates | Cross-flow state transitions |
| T15 UX refinements | Universal screen checks |
| T16 handoff claims and gibberish | F04 |
| T17 WebSocket FE contract | F04–F14 event checks |

## 11. Defect Severity Guidance

| Severity | Examples |
|---|---|
| Blocker | Cannot start app; data corruption; money duplicated/lost; auth bypass; Artifact B leak |
| Critical | Mainflow cannot complete; invalid state transition; cross-tenant access; webhook non-idempotent |
| Major | Important branch broken; stale UI causes wrong action; notification absent with no recovery |
| Minor | Validation copy/layout/accessibility issue with safe workaround |

## 12. Release Sign-off Dashboard

Do not use “100% wired” as the sign-off metric. Use:

- Route coverage: tested frontend routes / registered routes.
- Endpoint coverage: endpoint operations with at least one executed case / canonical Swagger operations.
- Mutation branch coverage: happy + validation + auth + authorization + conflict + dependency + concurrency.
- Role matrix coverage.
- State transition coverage.
- Socket event coverage.
- Ledger invariant coverage.
- Known defects by severity.

Recommended final acceptance rule:

- 100% of critical business mutations tested.
- 100% of canonical endpoints classified as UI-called, system/internal, webhook, socket-adjacent, admin-only, or intentionally unreachable.
- Zero open Blocker/Critical defects.
- No unexplained endpoint-count mismatch.

---

# Appendix A — Canonical Runtime HTTP Contract Inventories

This appendix deliberately contains **two separate HTTP inventories**:

1. **NestJS public/application API:** 222 runtime Swagger operations.
2. **FastAPI internal AI service:** 12 OpenAPI operations.

Do not merge them into a single frontend endpoint denominator. The React application is expected to call NestJS. NestJS, in turn, calls FastAPI for AI-assisted operations and technical access checks.

## Appendix A.1 — Full NestJS Runtime Endpoint Inventory

**Authoritative runtime count for `feat/Hung/FE-BE-Wiring`: 222 operations.**

This is the complete inventory supplied from the running Swagger document. QA should use these exact method/path pairs as the endpoint-coverage ledger baseline. No Swagger regeneration instructions are repeated here because the runtime export has already been produced and verified.

| # | Method | Path | Functional area | Primary actor/caller | Typical trigger |
|---:|---|---|---|---|---|
| 1 | `GET` | `/health` | Health / Operations | System | Health probe |
| 2 | `POST` | `/auth/register` | Authentication | All / Anonymous | Auth screen or session action |
| 3 | `POST` | `/auth/login` | Authentication | All / Anonymous | Auth screen or session action |
| 4 | `PUT` | `/auth/switch-role` | Authentication | All / Anonymous | Auth screen or session action |
| 5 | `POST` | `/auth/refresh` | Authentication | All / Anonymous | Auth screen or session action |
| 6 | `POST` | `/auth/register/handoff` | Authentication | All / Anonymous | Auth screen or session action |
| 7 | `POST` | `/auth/verify-otp` | Authentication | All / Anonymous | Auth screen or session action |
| 8 | `POST` | `/auth/verify-tax-code` | Authentication | All / Anonymous | Auth screen or session action |
| 9 | `POST` | `/auth/claim-handoff` | Authentication | All / Anonymous | Auth screen or session action |
| 10 | `POST` | `/auth/forgot-password` | Authentication | All / Anonymous | Auth screen or session action |
| 11 | `POST` | `/auth/reset-password` | Authentication | All / Anonymous | Auth screen or session action |
| 12 | `GET` | `/auth/verify-reset-token/{token}` | Authentication | All / Anonymous | Auth screen or session action |
| 13 | `POST` | `/auth/logout` | Authentication | All / Anonymous | Auth screen or session action |
| 14 | `PUT` | `/auth/me/password` | Authentication | All / Anonymous | Auth screen or session action |
| 15 | `POST` | `/auth/resend-otp` | Authentication | All / Anonymous | Auth screen or session action |
| 16 | `POST` | `/users/me/add-role` | Users & Roles | Authenticated user | Profile or role action |
| 17 | `GET` | `/users/me` | Users & Roles | Authenticated user | Profile or role action |
| 18 | `PUT` | `/users/me` | Users & Roles | Authenticated user | Profile or role action |
| 19 | `GET` | `/users/{userId}/public-profile` | Users & Roles | Authenticated user | Profile or role action |
| 20 | `PUT` | `/users/me/tax-code` | Users & Roles | Authenticated user | Profile or role action |
| 21 | `GET` | `/wallets/me` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 22 | `GET` | `/wallets/me/transactions` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 23 | `POST` | `/wallets/virtual-accounts/topup` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 24 | `POST` | `/withdrawals` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 25 | `GET` | `/withdrawals` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 26 | `DELETE` | `/withdrawals/{id}` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 27 | `POST` | `/webhooks/sepay/ipn` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 28 | `POST` | `/webhooks/sepay/chi-ho-credit` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 29 | `POST` | `/webhooks/sepay/bank-linked` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 30 | `POST` | `/bank-hub/initiate-link` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 31 | `PUT` | `/bank-hub/link` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 32 | `GET` | `/bank-hub/link` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 33 | `POST` | `/subscriptions/activate` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 34 | `GET` | `/subscriptions/status` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 35 | `GET` | `/subscriptions/history` | Financials & Subscription | CEO / Expert / Admin / System | Wallet, payment, subscription, or webhook flow |
| 36 | `POST` | `/elicitation/sessions` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 37 | `GET` | `/elicitation/sessions` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 38 | `GET` | `/elicitation/sessions/active` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 39 | `PUT` | `/elicitation/sessions/{id}/abandon` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 40 | `GET` | `/elicitation/sessions/history` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 41 | `GET` | `/elicitation/sessions/{id}` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 42 | `DELETE` | `/elicitation/sessions/{id}` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 43 | `PUT` | `/elicitation/sessions/{id}/stage1` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 44 | `PUT` | `/elicitation/sessions/{id}/stage2` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 45 | `PUT` | `/elicitation/sessions/{id}/stage3` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 46 | `PUT` | `/elicitation/sessions/{id}/stage4` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 47 | `PUT` | `/elicitation/sessions/{id}/stage4-handoff` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 48 | `POST` | `/elicitation/sessions/{id}/stage5` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 49 | `POST` | `/elicitation/sessions/{id}/generate-handoff-link` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 50 | `PUT` | `/elicitation/sessions/{id}/self-technical` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 51 | `POST` | `/elicitation/sessions/{id}/retry-synthesis` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 52 | `PUT` | `/elicitation/sessions/{id}/revert` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 53 | `PUT` | `/elicitation/sessions/{id}/continue` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 54 | `POST` | `/elicitation/sessions/{id}/stage4-recommend` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 55 | `PATCH` | `/elicitation/sessions/{id}/draft` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 56 | `PATCH` | `/elicitation/sessions/{id}/stage4-draft` | Elicitation | CEO / Tech Team | Elicitation wizard or session management |
| 57 | `GET` | `/projects/marketplace` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 58 | `GET` | `/projects/{id}` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 59 | `GET` | `/projects` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 60 | `GET` | `/projects/{id}/artifact-a` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 61 | `GET` | `/projects/{id}/artifact-b` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 62 | `PUT` | `/projects/{id}/name` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 63 | `PUT` | `/projects/{id}/milestones` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 64 | `POST` | `/projects/{id}/milestone-chat` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 65 | `GET` | `/projects/{id}/milestone-chat/sessions` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 66 | `GET` | `/projects/{id}/milestone-chat/sessions/{sessionId}` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 67 | `GET` | `/matching/{projectId}/shortlist` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 68 | `GET` | `/expert-profile/me` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 69 | `PUT` | `/expert-profile/me` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 70 | `GET` | `/expert-profile/search` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 71 | `GET` | `/expert-profile/{userId}` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 72 | `GET` | `/expert-profile/me/domains` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 73 | `GET` | `/expert-profile/me/seams` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 74 | `POST` | `/expert-profile/domains` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 75 | `PUT` | `/expert-profile/domains/sync` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 76 | `PUT` | `/expert-profile/domains/{id}` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 77 | `DELETE` | `/expert-profile/domains/{id}` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 78 | `POST` | `/expert-profile/seams` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 79 | `PUT` | `/expert-profile/seams/sync` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 80 | `POST` | `/portfolio-submissions` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 81 | `GET` | `/portfolio-submissions` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 82 | `GET` | `/portfolio-submissions/{id}` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 83 | `DELETE` | `/portfolio-submissions/me/portfolio/{id}` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 84 | `GET` | `/portfolio-submissions/me/portfolio/{id}` | Expert Profile & Verification | Expert / Public / CEO | Profile, capability, or portfolio action |
| 85 | `GET` | `/services/me` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 86 | `GET` | `/services/me/purchases` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 87 | `GET` | `/services` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 88 | `POST` | `/services` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 89 | `GET` | `/services/{id}` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 90 | `PUT` | `/services/{id}` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 91 | `DELETE` | `/services/{id}` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 92 | `POST` | `/services/{id}/purchase` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 93 | `PUT` | `/services/{id}/publish` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 94 | `PUT` | `/services/{id}/unpublish` | Services Marketplace | CEO / Expert | Service browse, manage, publish, or purchase |
| 95 | `GET` | `/engagements` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 96 | `GET` | `/engagements/{id}` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 97 | `PUT` | `/engagements/{id}/accept-nda` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 98 | `POST` | `/engagements/{id}/connect` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 99 | `PUT` | `/engagements/{id}/decline` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 100 | `GET` | `/engagements/{id}/milestones` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 101 | `GET` | `/engagements/{id}/submissions` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 102 | `GET` | `/engagements/{id}/bid` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 103 | `GET` | `/engagements/{id}/disputes` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 104 | `PUT` | `/engagements/{id}/cancel` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 105 | `POST` | `/bids` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 106 | `GET` | `/bids` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 107 | `GET` | `/bids/{id}` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 108 | `PUT` | `/bids/{id}` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 109 | `DELETE` | `/bids/{id}` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 110 | `PUT` | `/bids/{id}/tech-review` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 111 | `PUT` | `/bids/{id}/ceo-decision` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 112 | `PUT` | `/bids/{id}/counter-offer` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 113 | `POST` | `/bids/{id}/offers` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 114 | `POST` | `/bids/{id}/offers/{offerId}/accept` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 115 | `POST` | `/bids/{id}/offers/{offerId}/decline` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 116 | `POST` | `/bids/{id}/reconcile` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 117 | `POST` | `/disputes` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 118 | `GET` | `/disputes` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 119 | `GET` | `/disputes/{id}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 120 | `POST` | `/milestones` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 121 | `GET` | `/milestones` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 122 | `GET` | `/milestones/{id}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 123 | `PATCH` | `/milestones/{id}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 124 | `DELETE` | `/milestones/{id}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 125 | `PUT` | `/milestones/{id}/fund` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 126 | `GET` | `/milestones/{id}/disputes` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 127 | `POST` | `/milestones/bulk` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 128 | `POST` | `/milestones/{id}/dod/items` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 129 | `POST` | `/milestones/{id}/dod/items/bulk` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 130 | `GET` | `/milestones/{id}/dod` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 131 | `DELETE` | `/milestones/{id}/dod/{itemId}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 132 | `PUT` | `/milestones/{id}/dod/{itemId}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 133 | `PUT` | `/criteria/{id}/verify` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 134 | `PUT` | `/criteria/{id}/revision` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 135 | `GET` | `/criteria/{milestoneId}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 136 | `POST` | `/criteria/{milestoneId}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 137 | `DELETE` | `/criteria/{id}` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 138 | `POST` | `/milestones/{id}/submit` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 139 | `POST` | `/milestones/{id}/paygated-docs` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 140 | `GET` | `/milestones/{id}/paygated-docs` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 141 | `POST` | `/milestones/{id}/paygated-docs/bulk` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 142 | `DELETE` | `/milestones/{id}/submissions/latest` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 143 | `GET` | `/milestones/{id}/submissions/latest` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 144 | `GET` | `/milestones/{id}/submissions` | Milestones, Criteria & Disputes | CEO / Expert / Tech Team / Admin | Milestone execution, review, or dispute action |
| 145 | `GET` | `/engagements/{id}/messages` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 146 | `GET` | `/projects/{id}/messages` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 147 | `POST` | `/messages/{id}/read` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |
| 148 | `GET` | `/engagements/{id}/messages/unread-count` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 149 | `GET` | `/conversations` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |
| 150 | `GET` | `/projects/{id}/messages/unread-count` | Projects & Matching | CEO / Expert / Tech Team | Project, marketplace, shortlist, or AI chat action |
| 151 | `POST` | `/conversations/{engagementId}/read` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |
| 152 | `POST` | `/conversations/read-all` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |
| 153 | `GET` | `/invitations` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 154 | `POST` | `/invitations/{id}/decline` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 155 | `GET` | `/invitations/sent` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 156 | `DELETE` | `/invitations/{id}` | Engagements & Bidding | CEO / Expert / Tech Team | Invitation, bid, negotiation, NDA, or engagement action |
| 157 | `POST` | `/reviews` | Reviews | CEO / Expert / Tech Team | Review submission or history view |
| 158 | `GET` | `/reviews/{engagementId}` | Reviews | CEO / Expert / Tech Team | Review submission or history view |
| 159 | `GET` | `/reviews/users/{userId}` | Reviews | CEO / Expert / Tech Team | Review submission or history view |
| 160 | `GET` | `/reviews/me` | Reviews | CEO / Expert / Tech Team | Review submission or history view |
| 161 | `GET` | `/reviews/me/received` | Reviews | CEO / Expert / Tech Team | Review submission or history view |
| 162 | `PUT` | `/admin/projects/{id}/suspend-spec` | Admin | Admin | Admin dashboard action |
| 163 | `PUT` | `/admin/users/{id}/suspend` | Admin | Admin | Admin dashboard action |
| 164 | `PUT` | `/admin/users/{id}/reactivate` | Admin | Admin | Admin dashboard action |
| 165 | `GET` | `/admin/disputes` | Admin | Admin | Admin dashboard action |
| 166 | `PUT` | `/admin/disputes/{id}/resolve` | Admin | Admin | Admin dashboard action |
| 167 | `GET` | `/admin/decisions` | Admin | Admin | Admin dashboard action |
| 168 | `GET` | `/admin/transactions` | Admin | Admin | Admin dashboard action |
| 169 | `GET` | `/admin/analytics` | Admin | Admin | Admin dashboard action |
| 170 | `GET` | `/admin/withdrawals` | Admin | Admin | Admin dashboard action |
| 171 | `PUT` | `/admin/withdrawals/{id}/complete` | Admin | Admin | Admin dashboard action |
| 172 | `PUT` | `/admin/withdrawals/{id}/fail` | Admin | Admin | Admin dashboard action |
| 173 | `GET` | `/admin/platform-settings` | Admin | Admin | Admin dashboard action |
| 174 | `PUT` | `/admin/platform-settings` | Admin | Admin | Admin dashboard action |
| 175 | `GET` | `/admin/subscriptions/packages` | Admin | Admin | Admin dashboard action |
| 176 | `POST` | `/admin/subscriptions/packages` | Admin | Admin | Admin dashboard action |
| 177 | `PUT` | `/admin/subscriptions/packages/{id}` | Admin | Admin | Admin dashboard action |
| 178 | `DELETE` | `/admin/subscriptions/packages/{id}` | Admin | Admin | Admin dashboard action |
| 179 | `GET` | `/admin/users` | Admin | Admin | Admin dashboard action |
| 180 | `GET` | `/admin/users/{id}` | Admin | Admin | Admin dashboard action |
| 181 | `GET` | `/admin/projects` | Admin | Admin | Admin dashboard action |
| 182 | `GET` | `/admin/projects/{id}` | Admin | Admin | Admin dashboard action |
| 183 | `GET` | `/admin/engagements` | Admin | Admin | Admin dashboard action |
| 184 | `GET` | `/admin/experts` | Admin | Admin | Admin dashboard action |
| 185 | `PUT` | `/admin/projects/{id}/reopen` | Admin | Admin | Admin dashboard action |
| 186 | `GET` | `/admin/config/domains` | Admin | Admin | Admin dashboard action |
| 187 | `POST` | `/admin/config/domains` | Admin | Admin | Admin dashboard action |
| 188 | `PUT` | `/admin/config/domains/{id}` | Admin | Admin | Admin dashboard action |
| 189 | `DELETE` | `/admin/config/domains/{id}` | Admin | Admin | Admin dashboard action |
| 190 | `GET` | `/admin/config/seams` | Admin | Admin | Admin dashboard action |
| 191 | `POST` | `/admin/config/seams` | Admin | Admin | Admin dashboard action |
| 192 | `PUT` | `/admin/config/seams/{id}` | Admin | Admin | Admin dashboard action |
| 193 | `DELETE` | `/admin/config/seams/{id}` | Admin | Admin | Admin dashboard action |
| 194 | `GET` | `/admin/config/archetypes` | Admin | Admin | Admin dashboard action |
| 195 | `POST` | `/admin/config/archetypes` | Admin | Admin | Admin dashboard action |
| 196 | `PUT` | `/admin/config/archetypes/{id}` | Admin | Admin | Admin dashboard action |
| 197 | `DELETE` | `/admin/config/archetypes/{id}` | Admin | Admin | Admin dashboard action |
| 198 | `GET` | `/admin/config/probe-questions` | Admin | Admin | Admin dashboard action |
| 199 | `POST` | `/admin/config/probe-questions` | Admin | Admin | Admin dashboard action |
| 200 | `PUT` | `/admin/config/probe-questions/{id}` | Admin | Admin | Admin dashboard action |
| 201 | `DELETE` | `/admin/config/probe-questions/{id}` | Admin | Admin | Admin dashboard action |
| 202 | `GET` | `/admin/config/void-codes` | Admin | Admin | Admin dashboard action |
| 203 | `POST` | `/admin/config/void-codes` | Admin | Admin | Admin dashboard action |
| 204 | `PUT` | `/admin/config/void-codes/{id}` | Admin | Admin | Admin dashboard action |
| 205 | `DELETE` | `/admin/config/void-codes/{id}` | Admin | Admin | Admin dashboard action |
| 206 | `GET` | `/admin/prompts` | Admin | Admin | Admin dashboard action |
| 207 | `GET` | `/admin/prompts/{stage}` | Admin | Admin | Admin dashboard action |
| 208 | `PUT` | `/admin/prompts/{stage}` | Admin | Admin | Admin dashboard action |
| 209 | `DELETE` | `/admin/prompts/{stage}` | Admin | Admin | Admin dashboard action |
| 210 | `GET` | `/config/domains` | Public Configuration | Authenticated / Public UI | Reference-data loading |
| 211 | `GET` | `/config/seams` | Public Configuration | Authenticated / Public UI | Reference-data loading |
| 212 | `GET` | `/config/archetypes` | Public Configuration | Authenticated / Public UI | Reference-data loading |
| 213 | `GET` | `/config/archetypes/{code}/probe-questions` | Public Configuration | Authenticated / Public UI | Reference-data loading |
| 214 | `GET` | `/config/subscription-packages` | Public Configuration | Authenticated / Public UI | Reference-data loading |
| 215 | `GET` | `/config/void-codes` | Public Configuration | Authenticated / Public UI | Reference-data loading |
| 216 | `GET` | `/config/all` | Public Configuration | Authenticated / Public UI | Reference-data loading |
| 217 | `GET` | `/internal/prompts/{stage}` | Internal | Backend / Internal | Internal service lookup |
| 218 | `GET` | `/notifications/me` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |
| 219 | `GET` | `/notifications/me/unread-count` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |
| 220 | `PUT` | `/notifications/{id}/read` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |
| 221 | `PUT` | `/notifications/read-all` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |
| 222 | `DELETE` | `/notifications/{id}` | Messaging & Notifications | Authenticated user | Inbox, chat, read-state, or notification action |

### A.1 coverage rules

1. The QA ledger must contain one evidence row for every entry above.
2. The endpoint number in this table is an inventory index only; it is not an API version or business priority.
3. Each row must identify the invoking screen, component or system trigger, actor, request evidence, response evidence, state change, negative-path evidence, and final QA status.
4. Webhooks, health checks, and internal endpoints are valid runtime operations even though they do not correspond to an ordinary browser click.
5. Socket.io events, email actions, and external provider APIs remain separate contract inventories.
6. The valid frontend-to-NestJS coverage denominator for this build is **222**, not 228, 234, or 255.

## Appendix A.2 — FastAPI Internal AI-Service Inventory

**Runtime/OpenAPI service:** AITasker LLM Service  
**Expected operation count:** **12**  
**Primary caller:** NestJS backend  
**Direct browser consumption:** Not expected  
**Coverage denominator:** `12/12`, maintained separately from the NestJS `222/222` ledger.

| AI ID | Method | Path | Business responsibility | Expected NestJS trigger/caller | Minimum QA contract assertions |
|---|---|---|---|---|---|
| AI-001 | `POST` | `/llm/elicitation/stage1-extract` | Extract symptoms, scale signals, voids, recommended archetypes, and critical artifacts from CEO free text. | Stage 1 processing in the NestJS elicitation flow. | Validate request mapping, successful structured response, persistence into the session, loading state, malformed response handling, timeout handling, and no direct FE call. |
| AI-002 | `POST` | `/llm/elicitation/stage3-vagueness-check` | Detect vague or unusable probe answers before Stage 4. | NestJS Stage 3 submission. | Validate flagged-answer feedback, empty-list success, fail-open behavior where implemented, 422 mapping, and retry/error UX. |
| AI-003 | `POST` | `/llm/elicitation/stage4-recommend` | Recommend technical context for a non-technical CEO. | Stage 4 recommendation action. | Validate recommendation rendering, editability before persistence, request context completeness, and dependency-failure handling. |
| AI-004 | `POST` | `/llm/elicitation/stage5-synthesize` | Synthesize the complete project specification and milestone framework from Stages 1–4. | Stage 5 synthesis and synthesis retry. | Validate completeness score handling, `PUBLISHED` versus `RETURNED` branch, generated artifacts, idempotency/retry behavior, and partial-failure rollback. |
| AI-005 | `POST` | `/llm/elicitation/milestone-chat` | Provide context-aware milestone explanations and structured edit suggestions. | NestJS project milestone-chat endpoint. | Validate conversation context, session history, structured edit JSON, CEO apply-edit flow, Expert copy-suggestion flow, invalid JSON fallback, and authorization. |
| AI-006 | `POST` | `/llm/portfolio-eval` | Evaluate an Expert portfolio submission against seam-boundary competency. | NestJS portfolio submission workflow. | Validate confidence and pass/fail mapping, verification-tier updates, failure counters, lockout threshold, decision logging, and retry behavior without duplicate counters. |
| AI-007 | `POST` | `/llm/matching` | Score and rank Experts against project requirements. | Project publication or shortlist generation. | Validate candidate filtering, score ordering, gap map, empty candidate list, persistence/caching behavior, and no leakage of restricted profile data. |
| AI-008 | `POST` | `/llm/dispute-eval` | Perform Layer 1 neutral arbitration against criterion and deliverable evidence. | NestJS dispute creation. | Validate `>= 0.80` auto-resolution branch, `< 0.80` manual-review branch, finding-to-ledger mapping, escrow freeze, reasoning persistence, and AI failure fallback. |
| AI-009 | `POST` | `/llm/criterion-check` | Detect subjective language in acceptance criteria and suggest measurable wording. | Criterion creation or editing flow. | Validate subjectivity flag, severity, suggestions, optional context fields, UX advisory behavior, and whether saving is blocked or merely warned. |
| AI-010 | `POST` | `/llm/service-generate` | Generate an editable service-listing draft from Expert capabilities and intended use cases. | “Generate with AI” in service creation. | Validate generated fields, zero-price fallback, no automatic publication, editable draft behavior, cancellation, and provider failure handling. |
| AI-011 | `GET` | `/projects/{project_id}/artifact-b` | Evaluate the technical Artifact B access gate using engagement state, bid state, and both NDA acceptances. | NestJS project-detail retrieval before including Artifact B. | Test every individual failing condition, all-conditions-pass case, first-denial reason, 403 handling, cross-project access, and absence of Artifact B in denied payloads. |
| AI-012 | `GET` | `/health` | Report AI-service availability for containers and operational monitoring. | Docker health check and deployment monitoring. | Validate 200 response, dependency status if exposed, container readiness behavior, and NestJS handling while AI service is unavailable. |

### FastAPI execution rules

1. These operations are tested as **NestJS-to-FastAPI contracts**, not as twelve frontend buttons.
2. Each business-flow test should capture both:
   - the browser-to-NestJS request, and
   - the corresponding NestJS-to-FastAPI request where applicable.
3. At least one direct contract test should also be maintained per AI operation to validate request and response schemas independently of the frontend.
4. FastAPI `422` responses indicate schema validation failures and must be distinguished from NestJS business-rule errors such as `400`, `403`, `409`, or `422`.
5. AI provider timeouts, malformed model output, unavailable service, and retry behavior must be tested separately from valid low-confidence model results.
6. No AI endpoint should be exposed as a browser-configured base URL or called directly from React.
7. Sensitive Artifact B content must never be sent to the frontend when `AI-011` denies access.
8. The AI-service ledger is complete only when all **12 operations** have:
   - a mapped NestJS caller or operational caller,
   - positive contract evidence,
   - validation/error evidence,
   - security classification,
   - and a linked automated or manual test case.

### Approved combined statement

Use the following wording when a whole-system HTTP total is useful:

> **The release exposes 222 NestJS HTTP operations and 12 internal FastAPI operations, for 234 HTTP operations across the two services. Frontend REST coverage is measured against the 222-operation NestJS contract; internal AI coverage is measured separately against 12 operations.**

Do not present `234` as “234 frontend endpoints.”

---

# Appendix B — Endpoint Coverage Ledger Template

Create exactly one row per runtime NestJS Swagger operation. For this build, the ledger must contain **222 rows** before coverage can reach 100%. Maintain a second 12-row ledger for internal FastAPI operations.

| Endpoint ID | Method/path | Caller screen/component | Actor | Trigger gesture | Request payload assertions | Success assertion | Negative cases | DB/state assertions | Socket/notification | Test IDs | Result/evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EP-001 |  |  |  |  |  |  |  |  |  |  |  |

**Classification values:** `DIRECT_UI`, `BACKGROUND_UI`, `INTERNAL_NEST_TO_AI`, `WEBHOOK`, `ADMIN`, `SOCKET`, `HEALTH/OPS`, `DEPRECATED`, `UNREACHABLE_DEFECT`.

# Appendix C — Detailed Test Case Template

```markdown
## TC-[FLOW]-[NNN] — [Title]

- Priority:
- Actors:
- Route/screen:
- Endpoint(s):
- Requirement/business rule:
- Preconditions and seed IDs:
- Initial state snapshot:

### Steps
1. [Gesture]
2. [Input]
3. [Navigation/confirmation]

### Expected UI
- ...

### Expected network contract
- Method/path:
- Headers/auth:
- Payload:
- Status/body:
- Must fire exactly: once / zero times / retry policy

### Expected persistence/state
- Table/model:
- Before:
- After:
- Must remain unchanged:

### Cross-actor result
- Socket event:
- Notification:
- Recipient screen state:

### Negative/concurrency variants
- ...

### Evidence
- Screenshots:
- HAR/log:
- DB query/result:
- Defect:
```

# Appendix D — Final QA Handover Checklist

- [ ] Runtime NestJS Swagger exported from the exact release build.
- [ ] FastAPI OpenAPI exported from the exact release build.
- [ ] Runtime NestJS Swagger count confirmed as **222** for the exact release build.
- [ ] Endpoint Coverage Ledger contains exactly **222 unique method/path rows**.
- [ ] Internal FastAPI OpenAPI inventory contains exactly **12 operations** and is tracked separately.
- [ ] No report or sign-off incorrectly uses the unsupported 225/255 counts for this build.
- [ ] Every endpoint classified and linked to one or more tests.
- [ ] Every frontend route opened under valid and invalid roles.
- [ ] Every mutation tested for duplicate click and stale state.
- [ ] Every money movement checked for idempotency and atomicity.
- [ ] Every AI dependency tested for timeout/malformed/failure behavior.
- [ ] Every socket-driven change verified after offline refresh.
- [ ] Every state machine terminal state tested against illegal further actions.
- [ ] IDOR/ownership matrix completed.
- [ ] Browser refresh, Back/Forward, multi-tab, and session expiry completed.
- [ ] All Blocker/Critical defects closed and retested.
- [ ] Test evidence archived and linked.
- [ ] Product owner, QA lead, frontend lead, backend lead, and financial-flow owner sign off.
