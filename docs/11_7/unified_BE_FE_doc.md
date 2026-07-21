# AITasker — Unified FE↔BE Integration Reference (Single Source of Truth)

> **SCOPE:** 40 Prisma tables · 213 REST endpoints · 1 WebSocket namespace · 5 internal LLM routes
>
> **Base URL (dev):** `http://localhost:3001`
> **Auth header:** `Authorization: Bearer <access_token>` (JWT, 7-day expiry)
> **BigInt rule:** ALL `*Vnd`, `*Amount`, `balance` fields are serialized as **strings** (`"50000000"`) — never as JSON numbers.
> **Error envelope:** `{ statusCode: number, message: string | string[], error: string }` — DTO validation → `message` is array; service errors → `message` is single string.
>
> **NON-NEGOTIABLE RULE:** Every endpoint in this doc MUST be consumed by the FE. Any BE endpoint with no FE caller = **rot code = red flag**. The "Mandatory FE Consumption Checklist" (Section 14) is the gate.

---

## Table of Contents

1. Architecture & Cross-Cutting Conventions
2. Auth & Account Module
3. User & Profile Module
4. Wallet & Withdrawals Module
5. Bank Linking & SePay Webhooks
6. Subscriptions Module
7. Public Config Module (reference data)
8. Elicitation Engine (CEO + Tech Team)
9. Projects & Milestone Framework
10. Milestone Chat Assistant
11. Expert Profiles (Domains, Seams, Portfolio)
12. Listings / Services Marketplace
13. Engagements, Bids, Milestones, DoD, Criteria, Submissions
14. Disputes
15. Messaging (REST + WebSocket)
16. Notifications (REST + WebSocket)
17. Invitations
18. Reviews
19. Admin Module (Oversight)
20. Admin Config CMS (Domains/Seams/Archetypes/Probes/Void Codes)
21. Admin Subscriptions Packages
22. Admin Prompt Templates
23. Internal Endpoints (NestJS↔FastAPI)
24. WebSocket Event Catalog
25. Full 40-Table Data Model
26. Breaking Changes Cheatsheet
27. Mandatory FE Consumption Checklist (Anti-Rot Gate)

---

## 1. Architecture & Cross-Cutting Conventions

### 1.1 Two Backend Services

| Service | Port | Stack | Role |
|---|---|---|---|
| **NestJS backend** | 3001 (host) → 3000 (container) | NestJS 10 + Prisma + PostgreSQL + Socket.IO | All FE-facing REST + WebSocket; orchestrator |
| **FastAPI ai-service** | 8000 | FastAPI + OpenAI SDK + Jinja2 | Internal LLM microservice — **NEVER called by FE directly** |

FE talks **only** to NestJS. NestJS proxies all LLM calls to FastAPI via `FASTAPI_URL` with `X-Internal-Token` header.

### 1.2 Role System

A `User` has `roles: string[]` (multi-role) and one `activeRole` (current session role). Roles:
- `CLIENT` (with `clientSubtype`: `CEO` | `TECH_TEAM`)
- `EXPERT`
- `ADMIN`

Switch active role: `PUT /auth/switch-role` (body: `{ "role": "EXPERT" }`).
Add a new role to existing account: `POST /users/me/add-role`.

### 1.3 Subscription Gates (Pro vs Free)

| Action | Required Tier |
|---|---|
| Stage 1 elicitation submit | CLIENT pro |
| Bid submission | EXPERT pro |
| Listing publish | EXPERT pro |
| Service purchase | CLIENT pro |

Status comes from `GET /subscriptions/status` → `{ subscriptionTier, isExpired }`. Trust `subscriptionTier` directly — **no FE date math** (server auto-corrects expired → `free`).

### 1.4 BigInt Serialization

```typescript
// CORRECT
const price = Number(service.priceVnd);        // "50000000" → 50000000
// WRONG — will silently truncate precision above 2^53
const price = service.priceVnd as number;
```

### 1.5 Domain/Seam Code Format (DEHARDCODED — DTO Patch)

- Seam codes use the **↔ arrow** character: `"A↔C"`, `"A↔D"`, `"B↔E"`.
- The OLD `A<->C` ASCII format is **rejected** by DB unique constraint and by class-validator.
- Domain codes are **any non-empty string** — admin can create new ones (e.g. `"G"`) via `/admin/config/domains`. FE must NOT hardcode the `A`–`F` set.
- `DomainDepth` (SURFACE/OPERATIONAL/DEEP) and `VerifyTier` (CLAIMED/EVIDENCE_BACKED) remain strict enums — they are business-logic constants, not CMS-driven.

### 1.6 Public Config Bootstrap (Anti-N+1)

On FE app mount, call **one** endpoint:
```
GET /config/all   → { domains, seams, archetypes, voidCodes, subscriptionPackages }
```
This replaces 5 round trips. Cache in React context / Zustand store; refetch on admin-save events.

---

## 2. Auth & Account Module

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 2.1 | POST | `/auth/register` | – | – | CEO registration |
| 2.2 | POST | `/auth/login` | – | – | Login |
| 2.3 | PUT | `/auth/switch-role` | JWT | any | Switch active role |
| 2.4 | POST | `/auth/refresh` | – | – | Refresh access token |
| 2.5 | POST | `/auth/register/handoff` | – | – | Tech team register via invite link |
| 2.6 | POST | `/auth/verify-tax-code` | JWT | CLIENT | Verify Vietnamese tax code |
| 2.7 | POST | `/auth/claim-handoff` | JWT | any | Existing user claims tech team role |
| 2.8 | POST | `/auth/forgot-password` | – | – | Request reset email |
| 2.9 | POST | `/auth/reset-password` | – | – | Reset password (one-time token) |
| 2.10 | GET | `/auth/verify-reset-token/:token` | – | – | Validate reset token BEFORE showing form |
| 2.11 | POST | `/auth/logout` | JWT | any | Invalidate refresh token server-side |
| 2.12 | PUT | `/auth/me/password` | JWT | any | Change password while authenticated |

### 2.1 Register (CEO)

**Request:**
```json
{
  "email": "Albert@Gmail.COM",
  "password": "MyPass123!",
  "fullName": "Albert Tran",
  "phone": "0901234567",
  "roles": "CLIENT_CEO",
  "selfTechnical": false
}
```

**Response 201:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid", "email": "albert@gmail.com", "fullName": "Albert Tran",
    "activeRole": "CLIENT", "clientSubtype": "CEO",
    "subscriptionClientTier": "free", "subscriptionExpertTier": "free",
    "selfTechnical": false
  }
}
```

**FE integration notes (CRITICAL):**
- Email is **normalized to lowercase** server-side. Display `response.user.email`, not the raw input.
- Password validation errors return as `message: string[]` (array) — **iterate** and render as a checklist. All failing rules returned simultaneously (not one at a time).
- Email domain errors return as `message: string` (single). Patterns:
  - `"Temporary or throwaway email addresses are not permitted."`
  - `"Email domain does not exist or cannot receive mail."`
- Login email is **NOT** normalized server-side — FE must always send lowercase.

### 2.2 Login — Unchanged

`POST /auth/login` `{ email, password }` → `{ access_token, refresh_token, user }`.

### 2.3 Switch Role

`PUT /auth/switch-role` `{ role: "EXPERT" }` → returns new `access_token` + `refresh_token` + updated `user` object.

### 2.5 Register via Handoff Link (Tech Team)

`POST /auth/register/handoff` `{ invite_token, email, password, fullName }`.

**Patch applied:** `TechTeamProfile.linkedProjectId` is set **immediately** if the inviting CEO has a published project. FE: `GET /projects` returns the project on first call after registration — no manual refresh.

### 2.7 Claim Handoff (existing user adding tech team role)

`POST /auth/claim-handoff` `{ invite_token }` → `{ message, access_token }`. Same linkedProjectId fix.

### 2.10 Verify Reset Token (NEW)

Call this on **page load** of `/reset-password/:token` BEFORE rendering the form.

`GET /auth/verify-reset-token/:token` → 200 `{ valid: true }` | 400 `"This password reset link is invalid or has expired."`.

On 400 → show expired screen with CTA back to `/forgot-password`. Never show the form on 400.

### 2.11 Logout (NEW)

`POST /auth/logout` → `{ success: true }`. Clears `refreshTokenHash` server-side so the refresh token cannot be replayed. FE must also clear localStorage tokens.

### 2.12 Change Password (NEW)

`PUT /auth/me/password`:
```json
{ "currentPassword": "OldPass123!", "newPassword": "NewPass456@" }
```
Password rules (8+ chars, upper, lower, digit, special). On success, **all sessions invalidated** (refreshTokenHash nulled). FE must redirect to `/login`.

---

## 3. User & Profile Module

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 3.1 | POST | `/users/me/add-role` | JWT | any | Add a role to existing account |
| 3.2 | GET | `/users/me` | JWT | any | Current user profile |
| 3.3 | PUT | `/users/me` | JWT | any | Update profile |
| 3.4 | GET | `/users/:userId/public-profile` | JWT | any | View another user's public profile |
| 3.5 | PUT | `/users/me/tax-code` | JWT | CLIENT | Update tax code |
| 3.6 | GET | `/users/experts` | JWT | CLIENT, ADMIN | Browse experts (CEO talent search) |

### 3.1 Add Role

`POST /users/me/add-role` `{ role: "EXPERT" }`. Triggers creation of empty `ExpertProfile` row. Returns updated user.

### 3.6 Browse Experts (NEW)

`GET /users/experts?stackTag=Python&archetype=1&limit=20`.

Returns:
```json
[{
  "id": "uuid", "fullName": "Jane Doe", "bio": "...",
  "engagementModel": "MILESTONE",
  "stackTags": ["Python", "LangChain"],
  "domainDepths": [{ "domainCode": "A", "depthLevel": "DEEP" }],
  "verifiedSeams": [{ "seamCode": "A↔C", "verificationTier": "EVIDENCE_BACKED" }]
}]
```

FE: use this on the CEO's "Find Talent" page. Map `domainCode`/`seamCode` to human-readable names via cached `/config/all`.

---

## 4. Wallet & Withdrawals Module

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 4.1 | GET | `/wallets/me` | JWT | any | Wallet balance |
| 4.2 | GET | `/wallets/me/transactions?type=&limit=&offset=` | JWT | any | Paginated/filtered tx history |
| 4.3 | POST | `/wallets/virtual-accounts/topup` | JWT | any | Create topup VA |
| 4.4 | POST | `/withdrawals` | JWT | EXPERT | Request cash-out |
| 4.5 | GET | `/withdrawals` | JWT | EXPERT | Own withdrawal history |
| 4.6 | DELETE | `/withdrawals/:id` | JWT | EXPERT | Cancel PENDING withdrawal |

### 4.1 Get Wallet Balance

`GET /wallets/me` → `{ availableBalance: "5000000", lockedBalance: "1000000" }` (both strings).

### 4.2 Transactions (PATCHED — pagination/filter added)

`GET /wallets/me/transactions?type=TOP_UP&limit=50&offset=0`.

Response:
```json
[{ "id": "uuid", "amount": 5000000, "transactionType": "TOP_UP", "createdAt": "2026-..." }]
```
Note: `amount` is **Number** (not string) in this endpoint — historical quirk, but values fit safely within `Number.MAX_SAFE_INTEGER`.

Valid `transactionType` values: `TOP_UP`, `SUBSCRIPTION`, `ESCROW_LOCK`, `ESCROW_RELEASE`, `PLATFORM_FEE`, `ESCROW_REFUND`, `ESCROW_SPLIT`, `WITHDRAWAL`, `WITHDRAWAL_REFUND`.

### 4.3 Topup VA

`POST /wallets/virtual-accounts/topup` `{ amount: 500000 }` → returns VA number + QR payload. SePay IPN will credit the wallet async.

### 4.4 Withdraw

`POST /withdrawals` `{ type: "EXPERT_MANUAL", amount: 1000000 }`. Requires linked bank account (`POST /bank-hub/initiate-link` first).

### 4.6 Cancel Withdrawal (NEW)

`DELETE /withdrawals/:id`. Only `PENDING` can be cancelled. Refunds wallet atomically. Returns `{ cancelled: true, refundedAmount: 1000000 }`.

---

## 5. Bank Linking & SePay Webhooks

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 5.1 | POST | `/bank-hub/initiate-link` | JWT | Start bank linking flow |
| 5.2 | POST | `/webhooks/sepay/ipn` | HMAC | SePay incoming payment notification |
| 5.3 | POST | `/webhooks/sepay/chi-ho-credit` | – | Chi Hò disbursement callback |
| 5.4 | POST | `/webhooks/sepay/bank-linked` | – | Bank account link confirmation |

### 5.1 Initiate Bank Link

`POST /bank-hub/initiate-link` `{ bankCode, accountHolderName }` → returns SePay redirect URL. On callback, `User.sepayBankAccountXid` and `bankLinkedAt` are set.

### 5.2–5.4 Webhooks

**FE never calls these** — they are server-to-server. Documented for completeness. The IPN endpoint verifies `x-sepay-signature` HMAC against `SEPAY_SECRET_KEY`.

---

## 6. Subscriptions Module

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 6.1 | POST | `/subscriptions/activate` | JWT | Activate a package |
| 6.2 | GET | `/subscriptions/status` | JWT | Current tier + expiry |
| 6.3 | GET | `/subscriptions/history` | JWT | Purchase log |

### 6.1 Activate (BREAKING — `packageId` required)

`POST /subscriptions/activate`:
```json
{ "activeRole": "CLIENT", "packageId": "uuid-from-/config/subscription-packages" }
```
Response 201:
```json
{
  "access_token": "eyJ...",
  "activatedPackage": { "name": "Client Pro", "priceVnd": "500000", "durationMonths": 6 }
}
```
Errors: 422 `INSUFFICIENT_BALANCE` | 422 `"package unavailable"` | 422 `"role mismatch"` | 409 `"already active"`.

**FE flow:**
1. `GET /config/subscription-packages?role=CLIENT` → list packages.
2. User picks one → save its `id`.
3. Check `Number(wallet.availableBalance) >= Number(pkg.priceVnd)`. If false, redirect to topup.
4. `POST /subscriptions/activate` with that `packageId`.
5. Replace access token from response.

### 6.2 Status (PATCHED — auto-corrects expired)

`GET /subscriptions/status` → `{ subscriptionTier: "free" | "pro", subscriptionExpires: ISO, isExpired: boolean }`.

When subscription is expired, server returns `subscriptionTier: "free"` and `isExpired: true`. **Remove all FE date-math** — trust `subscriptionTier` directly.

### 6.3 History (NEW)

`GET /subscriptions/history` → array of:
```json
[{
  "id": "uuid", "packageName": "Client Pro", "role": "CLIENT",
  "amountPaidVnd": "500000",
  "purchasedAt": "2026-01-15T...", "expiresAt": "2026-07-15T...",
  "isExpired": false
}]
```
FE: `isExpired` is pre-computed — use directly for badges. Format dates in UTC+7.

---

## 7. Public Config Module (reference data — no auth)

| # | Method | Path | Purpose |
|---|---|---|---|
| 7.1 | GET | `/config/domains` | Active domain definitions |
| 7.2 | GET | `/config/seams` | Active seam definitions |
| 7.3 | GET | `/config/archetypes` | Active archetype definitions |
| 7.4 | GET | `/config/archetypes/:code/probe-questions` | Probe questions for archetype |
| 7.5 | GET | `/config/void-codes` | Active void code definitions |
| 7.6 | GET | `/config/subscription-packages?role=CLIENT\|EXPERT` | Active packages only |
| 7.7 | GET | `/config/all` | **ALL config in one call — use on app mount** |

### 7.7 Single Bootstrap Endpoint (NEW)

`GET /config/all` →
```json
{
  "domains": [{ "id": "uuid", "code": "A", "name": "LLM App Engineering", "sortOrder": 1 }, ...],
  "seams":   [{ "id": "uuid", "code": "A↔C", "name": "LLM output quality", "sortOrder": 1 }, ...],
  "archetypes": [{ "id": "uuid", "code": "1", "name": "RAG/Search", "description": "...", "sortOrder": 1 }, ...],
  "voidCodes": [{ "id": "uuid", "code": "NO_GROUND_TRUTH", "name": "No Ground Truth", "description": "...", "severity": "HIGH" }, ...],
  "subscriptionPackages": [{ "id": "uuid", "role": "CLIENT", "name": "Client Pro", "priceVnd": "500000", "durationMonths": 6 }, ...]
}
```

Cache in FE global store. Refetch after admin saves config changes (rare event).

### 7.4 Probe Questions — used in Stage 3

Response: `[{ "id": "uuid", "archetypeCode": "1", "questionText": "...", "displayOrder": 1 }]`.

The `questionText` is BOTH the display label AND the request body key in Stage 3 submission (see §8.5).

### 7.5 Void Codes (NEW — Dynamic AI)

Used in Stage 2 to display human-readable descriptions of detected voids. FE looks up `stage1.voidListJson[].void_code` against this list to render name + description + severity badge.

---

## 8. Elicitation Engine (CEO + Tech Team)

All `JWT`, role `CLIENT` (CEO) unless noted.

### 8.1 Session Lifecycle Endpoints

| # | Method | Path | Purpose |
|---|---|---|---|
| 8.1.1 | POST | `/elicitation/sessions` | Start new session |
| 8.1.2 | GET | `/elicitation/sessions` | List my sessions |
| 8.1.3 | GET | `/elicitation/sessions/active` | Get currently active session (if any) |
| 8.1.4 | GET | `/elicitation/sessions/history` | Completed sessions only |
| 8.1.5 | GET | `/elicitation/sessions/:id` | Full session detail |
| 8.1.6 | DELETE | `/elicitation/sessions/:id` | Delete session |
| 8.1.7 | PUT | `/elicitation/sessions/:id/abandon` | Mark ABANDONED |
| 8.1.8 | PUT | `/elicitation/sessions/:id/revert` | Go back to previous stage |
| 8.1.9 | PUT | `/elicitation/sessions/:id/continue` | Resume from RETURNED state |

### 8.2 Stage 1 — Submit Symptoms

`PUT /elicitation/sessions/:id/stage1` `{ symptomText: "..." }`.

**Response 200 (key new fields):**
```json
{
  "currentStage": 2,
  "stage1OriginalInput": "We need an AdTech compliance pipeline based on our ruleset...",
  "stage1SymptomsJson": ["No automated ad compliance checking", "Manual review delays"],
  "criticalArtifactsJson": [
    {
      "artifact_key": "compliance_ruleset",
      "label": "Compliance Ruleset",
      "reason": "The AI will judge based on your ruleset — its content defines milestone acceptance criteria",
      "placeholder_prompt": "Paste your compliance rules here"
    }
  ],
  "voidListJson": [{ "void_code": "MISSING_TECHNICAL_ARTIFACT", "severity": "HIGH" }],
  "recommendedArchetypesJson": ["3", "1"],
  "estimatedBudgetVnd": "200000000"
}
```

**FE integration (CRITICAL):**
- Display `stage1OriginalInput` vs `stage1SymptomsJson` as a **side-by-side diff** ("What you wrote" vs "What AI understood").
- If `criticalArtifactsJson` is non-empty → render a **persistent banner** in Stage 4 reminding the CEO to submit these documents.
- Cross-reference `voidListJson[].void_code` against cached `/config/void-codes` to show name + description.
- `estimatedBudgetVnd` is a string — `Number()` it for display.

### 8.3 Stage 2 — Select Archetype

`PUT /elicitation/sessions/:id/stage2`:
```json
{ "archetype": "3", "acknowledgedVoidCodes": ["MISSING_TECHNICAL_ARTIFACT", "NO_GROUND_TRUTH"] }
```

**FE:** fetch archetype grid from `/config/archetypes` (NOT hardcoded). CEO must acknowledge **all** detected voids — `acknowledgedVoidCodes` array length must match `voidListJson` length.

### 8.4 Stage 3 — Probe Questions

`PUT /elicitation/sessions/:id/stage3`:
```json
{
  "probe_responses": {
    "Roughly how many items need classifying per day?": "Around 50,000 ad assets",
    "What should happen when the system isn't confident?": "Route to human reviewer",
    "Where does data come from today?": "Uploaded via our platform API",
    "How quickly must classification complete?": "Under 2 seconds"
  }
}
```

**Key:** the object keys are **EXACT** `questionText` strings from `/config/archetypes/:code/probe-questions`. Do not mutate them.

**Response 200 (NEW `irrelevant_answers` field):**
```json
{
  "currentStage": 4,
  "vaguenessResult": {
    "vague_answers": [],
    "irrelevant_answers": [
      { "question": "Where does data come from today?",
        "issue": "Answer is too generic — missing how AI will authenticate against the AdTech API" }
    ]
  }
}
```

**FE:** render `vague_answers` and `irrelevant_answers` as **two separate warning sections** with different copy:
- Vague → "Please be more specific" 
- Irrelevant → "This doesn't address the project context"

**Neither blocks submission** — both are advisory only. Non-technical CEOs get a more forgiving prompt (server-side injection).

### 8.5 Stage 4 — Auto-Save Draft (NEW)

`PATCH /elicitation/sessions/:id/stage4-draft` `{ draftJson: { ...form values } }`.

Call **every 30s** or on field `blur`. No LLM call, instant response `{ saved: true }`. On page mount, pre-fill the form from `session.stage4DraftJson`.

### 8.6 Stage 4 — Submit Technical Context

`PUT /elicitation/sessions/:id/stage4`:
```json
{
  "current_stack": "Python FastAPI + PostgreSQL",
  "data_available": "50,000 ad assets/day, historical CSV",
  "latency_requirement": "Under 2 seconds at P95",
  "additional_requirement_1": "Must integrate with SSO, stay GDPR-compliant",
  "technical_artifacts": {
    "compliance_ruleset": "Rule 1: No misleading health claims.\nRule 2: Financial products must display APR.\nRule 3: Prohibited: gambling, tobacco."
  }
}
```

**Response 200 (CHANGED SHAPE):**
```json
{
  "session": {
    "currentStage": 5,
    "stage4TechInputsJson": { "technical_artifacts": { "compliance_ruleset": "..." } }
  },
  "missingArtifacts": []
}
```

When artifacts missing:
```json
{
  "session": { "currentStage": 5 },
  "missingArtifacts": [
    { "artifact_key": "compliance_ruleset", "label": "Compliance Ruleset",
      "reason": "...", "placeholder_prompt": "..." }
  ]
}
```

**FE integration (CRITICAL UX):**
- Build a **dynamic form**: one `<textarea>` per `session.criticalArtifactsJson[]` item, keyed by `artifact_key`.
- The `technical_artifacts` object's keys come from `session.criticalArtifactsJson[].artifact_key`.
- If `missingArtifacts` is non-empty → show **warning modal** "Submit incomplete spec?" with Continue / Go Back buttons. Do NOT hard-block.
- Submitted artifacts → AI uses their **actual content** to write milestone acceptance criteria.
- Missing artifacts → AI generates generic spec, `completeness_score` capped at 0.60 (project will be returned to CEO).

### 8.7 Stage 4 AI Recommend (NEW)

`POST /elicitation/sessions/:id/stage4-recommend` → AI suggests `recommended_stack`, `recommended_integration`, `recommended_legacy_volume` based on symptoms/archetype/probes/budget. Use to pre-fill the form for non-technical CEOs.

### 8.8 Stage 4 Handoff (Tech Team path)

`PUT /elicitation/sessions/:id/stage4-handoff` — same body shape as 8.6, same response shape. Used when CEO handed off to a Tech Team member.

### 8.9 Stage 4 — Self-Technical Toggle

`PUT /elicitation/sessions/:id/self-technical` `{ isSelfTechnical: true }`. Switches AI prompt mode (technical vs forgiving).

### 8.10 Stage 5 — Publish Project

`POST /elicitation/sessions/:id/stage5` — no body. Triggers LLM synthesis.

**Response 201 (NEW cost/duration fields):**
```json
{
  "id": "project-uuid",
  "projectName": "AdTech Compliance Classifier",
  "state": "PUBLISHED",
  "archetype": "3",
  "tier": "TIER_2",
  "artifact_a_json": {
    "project_name": "AdTech Compliance Classifier",
    "business_intent": "Automate ad asset review against the client compliance ruleset...",
    "sdlc_notices": ["Compliance ruleset received — milestone criteria grounded to actual rules"]
  },
  "required_domains_json": [{ "domain_code": "A", "required_depth": "OPERATIONAL" }],
  "required_seams_json":   [{ "seam_code": "A↔C", "criticality": "load_bearing" }],
  "milestone_framework_json": [
    {
      "milestone_number": 1,
      "deliverable_statement": "Rule parser ingesting the 3-category ruleset, outputting structured policy objects",
      "sign_off_authority": "JOINT",
      "payment_amount_vnd": 0,
      "estimated_cost_vnd": 40000000,
      "estimated_duration_days": 14
    }
  ],
  "estimatedTotalCostVnd": "120000000",
  "estimatedTotalDurationDays": 42
}
```

**FE notes:**
- `milestone_framework_json` deliverables reference **actual submitted artifact content** (e.g. "Rule 1: No misleading health claims").
- Show `estimatedTotalCostVnd` and `estimatedTotalDurationDays` as "AI estimates" badges on the project dashboard.
- TechTeam linked to CEO sees the project **immediately** in their `GET /projects` response.
- If `completeness_score < 0.70` server-side, project state is `RETURNED_TO_CLIENT` (not PUBLISHED) — show the feedback and let CEO revise via Stage 4.

### 8.11 Stage 5 Retry / Handoff Link

- `POST /elicitation/sessions/:id/retry-synthesis` — re-call LLM if previous synthesis failed (503 timeout).
- `POST /elicitation/sessions/:id/generate-handoff-link` — returns a one-time invite token for a Tech Team member.

---

## 9. Projects & Milestone Framework

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 9.1 | GET | `/projects?slim=true` | JWT | any | List projects (slim version omits JSON blobs) |
| 9.2 | GET | `/projects/:id` | JWT | CLIENT, EXPERT, ADMIN | Full project detail |
| 9.3 | GET | `/projects/:id/artifact-a` | JWT | party | Just artifact_a_json |
| 9.4 | GET | `/projects/:id/artifact-b` | JWT | party (gated) | Just artifact_b_json — see §9.7 |
| 9.5 | PUT | `/projects/:id/name` | JWT | CLIENT | Rename project |
| 9.6 | GET | `/projects/:id/milestones` | JWT | party | List milestones |
| 9.7 | PUT | `/projects/:id/milestones` | JWT | CLIENT | Update entire milestone framework JSON |
| 9.8 | PUT | `/projects/:id/cancel` | JWT | CLIENT | Cancel project (only PUBLISHED, no active engagements) |
| 9.9 | GET | `/projects/:id/engagements` | JWT | CLIENT, EXPERT, ADMIN | List engagements on project |
| 9.10 | GET | `/projects/:id/invitations` | JWT | CLIENT | List expert invitations sent |
| 9.11 | GET | `/projects/:id/team` | JWT | CLIENT, ADMIN | Tech team assigned to project |

### 9.2 Get Project Detail

Includes `required_domains_json`, `required_seams_json`, `milestone_framework_json` (used by Expert BidForm). Expert accesses this to scope their bid.

### 9.4 Artifact B Access — 4-Condition Gate

Artifact B (technical deep-dive: stack, integration method, schemas) is gated behind 4 conditions evaluated server-side via FastAPI `/projects/:id/artifact-b`:

1. `engagement.state ∈ { CONNECTED, ACTIVE }`
2. `bid.state ∈ { TECH_APPROVED, CEO_REVIEW, SELECTED }`
3. `expertNdaAccepted = true`
4. `clientNdaAccepted = true`

If any fails → NestJS returns project detail **without** `artifact_b_json` and adds a `artifactBAccessDenied: "<reason>"` field. FE shows the reason as a tooltip on a locked "Artifact B" card. No FE-side logic — trust the presence/absence of the field.

### 9.8 Cancel Project (NEW)

`PUT /projects/:id/cancel`. Only allowed when `state === PUBLISHED` and no active engagements. Server moves state to `SUSPENDED`.

---

## 10. Milestone Chat Assistant (NEW — E-3)

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 10.1 | POST | `/projects/:id/milestone-chat` | JWT | Send message to AI assistant |
| 10.2 | GET | `/projects/:id/milestone-chat/sessions` | JWT | List chat sessions (sidebar) |
| 10.3 | GET | `/projects/:id/milestone-chat/sessions/:sessionId` | JWT | Full message history |

### 10.1 Send Message

**First message** (new session): `{ "message": "Why 3 milestones?" }`
**Follow-up**: `{ "message": "Can we cut milestone 2 cost?", "chatSessionId": "uuid" }`

History is **server-side persisted** — FE stores only `chatSessionId` in state, never the full message array.

**Response 200:**
```json
{
  "reply": "The AI split into 3 milestones because...",
  "suggestedEdit": {
    "milestone_number": 2,
    "field": "paymentAmountVnd",
    "suggested_value": 30000000,
    "reason": "Standard data pipeline milestone cost at TIER_2 scope"
  },
  "chatSessionId": "session-uuid",
  "sessionTitle": "Chat · 09/07/2026",
  "messageCount": 2
}
```

`suggestedEdit` is `null` when no edit suggested. When present, render a one-click **Apply** button → calls `PATCH /milestones/:id` with the suggested field/value.

### 10.2 / 10.3 List & History

Sessions list: `[{ "id", "title", "messageCount", "updatedAt" }]`
Session detail: `{ "id", "title", "messagesJson": [{ role, content }], "createdAt", "updatedAt" }`

**FE:** fetch sessions list for sidebar on page mount. On session click, fetch full history. Do NOT send history back on subsequent messages — only `chatSessionId`.

---

## 11. Expert Profiles (Domains, Seams, Portfolio)

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 11.1 | GET | `/expert-profile/me` | JWT | EXPERT | My profile |
| 11.2 | PUT | `/expert-profile/me` | JWT | EXPERT | Update profile |
| 11.3 | GET | `/expert-profile/search?domain=&seam=&archetype=&limit=` | JWT | CLIENT, ADMIN | Search experts |
| 11.4 | GET | `/expert-profile/:userId` | JWT | CLIENT, ADMIN | View another expert's public profile |
| 11.5 | GET | `/expert-profile/me/domains` | JWT | EXPERT | My domain claims |
| 11.6 | GET | `/expert-profile/me/seams` | JWT | EXPERT | My seam claims |
| 11.7 | POST | `/expert-profile/domains` | JWT | EXPERT | Create domain depth |
| 11.8 | PUT | `/expert-profile/domains/sync` | JWT | EXPERT | Bulk sync domains |
| 11.9 | PUT | `/expert-profile/domains/:id` | JWT | EXPERT | Update domain depth |
| 11.10 | DELETE | `/expert-profile/domains/:id` | JWT | EXPERT | Delete (only if no portfolio submissions) |
| 11.11 | POST | `/expert-profile/seams` | JWT | EXPERT | Create seam claim |
| 11.12 | PUT | `/expert-profile/seams/sync` | JWT | EXPERT | Bulk sync seams |
| 11.13 | POST | `/portfolio-submissions` | JWT | EXPERT | Submit portfolio for LLM eval |
| 11.14 | GET | `/portfolio-submissions` | JWT | EXPERT | My submissions |
| 11.15 | GET | `/portfolio-submissions/:id` | JWT | EXPERT | Submission detail |
| 11.16 | GET | `/portfolio-submissions/me/portfolio/:id` | JWT | EXPERT | Specific portfolio entry |
| 11.17 | DELETE | `/portfolio-submissions/me/portfolio/:id` | JWT | EXPERT | Delete portfolio entry |

### 11.7 / 11.9 Domain Depth — DTO Dehardcoded

`POST /expert-profile/domains`:
```json
{ "domainCode": "A", "depthLevel": "DEEP" }
```
`domainCode` is **any non-empty string** — validated against `domain_definitions` table at service layer. `depthLevel` must be `SURFACE`, `OPERATIONAL`, or `DEEP`.

### 11.11 Seam Claim — Arrow Format

`POST /expert-profile/seams`:
```json
{ "seamCode": "A↔C" }
```
**MUST use ↔ arrow.** Old `A<->C` format → 400 Bad Request.

### 11.13 Portfolio Submission → LLM Eval Flow

`POST /portfolio-submissions`:
```json
{
  "seamCode": "A↔C",
  "projectDescription": "Built an enterprise document QA system...",
  "decisionPoints": "At the A↔C seam: evaluated BERTScore vs ROUGE-L — chose BERTScore because..."
}
```

Server-side flow:
1. Increments `expert_seam_claims.submission_count`.
2. Fetches seam definition + all active seam definitions from DB.
3. Calls FastAPI `/llm/portfolio-eval` with live seam context.
4. If `passed_boolean = true` → upgrades `verification_tier` to `EVIDENCE_BACKED`.
5. If false → increments failure count, may lockout.
6. Writes a `platform_decisions` row with confidence + gap advisory.

**Response 201:**
```json
{
  "id": "uuid",
  "status": "APPROVED",          // or "REJECTED"
  "llmConfidence": 0.92,
  "seamClaim": { "verificationTier": "EVIDENCE_BACKED" }
}
```

**FE:** show the `gap_advisory` text prominently on rejection — it names WHICH of the 4 signal types is missing.

---

## 12. Listings / Services Marketplace

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 12.1 | GET | `/services` | JWT | any | Browse published listings |
| 12.2 | POST | `/services` | JWT | EXPERT | Create listing (with optional AI assist) |
| 12.3 | GET | `/services/:id` | JWT | any | Listing detail |
| 12.4 | PUT | `/services/:id` | JWT | EXPERT | Update listing |
| 12.5 | DELETE | `/services/:id` | JWT | EXPERT | Delete (only DRAFT state) |
| 12.6 | POST | `/services/:id/purchase` | JWT | CLIENT | Buy a service → creates engagement |
| 12.7 | GET | `/services/me` | JWT | EXPERT | My listings (all states) |
| 12.8 | GET | `/services/me/purchases` | JWT | CLIENT | Services I bought |
| 12.9 | PUT | `/services/:id/publish` | JWT | EXPERT | DRAFT → PUBLISHED |
| 12.10 | PUT | `/services/:id/unpublish` | JWT | EXPERT | PUBLISHED → DRAFT |

### 12.2 Create Listing (with AI assist)

`POST /services`:
```json
{
  "serviceType": "AI_SERVICE",      // or "TECH_DISCOVERY"
  "useAiGenerator": true,
  "capabilities": ["5 years building RAG pipelines", "Pinecone, Weaviate production deployments"],
  "targetUseCases": ["Enterprise knowledge base search", "Legal document retrieval"],
  "title": "...",                    // optional when useAiGenerator=true
  "priceVnd": 0                      // optional when useAiGenerator=true
}
```

When `useAiGenerator=true`, NestJS calls FastAPI `/llm/service-generate` with the expert's claimed domains + seams + price guidance from DB. Returns:
```json
{
  "id": "uuid",
  "title": "Production RAG Pipeline Design & Implementation",
  "description": "...",
  "scope": "Included: ... Not included: ...",
  "timeline": "4 weeks: Week 1 discovery...",
  "priceVnd": "45000000",
  "domainsJson": ["A", "D"],
  "seamsJson": ["A↔D"]
}
```

**FE:** pre-fill the form with AI output. Expert reviews, edits, then calls `PUT /services/:id/publish`. The AI draft is **never auto-published**.

### 12.6 Purchase Service

`POST /services/:id/purchase` — no body. Creates an `Engagement` of type `SERVICE_PURCHASE`. If expert's wallet is set up, escrow is locked immediately.

---

## 13. Engagements, Bids, Milestones, DoD, Criteria, Submissions

### 13.A Engagements

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 13.A.1 | GET | `/engagements?state=&type=&connectedAt=` | JWT | List (filtered) |
| 13.A.2 | GET | `/engagements/:id` | JWT | Detail |
| 13.A.3 | PUT | `/engagements/:id/accept-nda` | JWT | Accept NDA |
| 13.A.4 | POST | `/engagements/:id/connect` | JWT | Expert accepts connect (post-CEO-selection) |
| 13.A.5 | PUT | `/engagements/:id/decline` | JWT | Decline |
| 13.A.6 | GET | `/engagements/:id/milestones` | JWT | List milestones |
| 13.A.7 | GET | `/engagements/:id/submissions` | JWT | All submissions across milestones |
| 13.A.8 | GET | `/engagements/:id/bid` | JWT | The capability bid for this engagement |
| 13.A.9 | GET | `/engagements/:id/disputes` | JWT | Disputes on this engagement |
| 13.A.10 | PUT | `/engagements/:id/cancel` | JWT | Cancel (no active funded milestones) |

### 13.B Bids

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 13.B.1 | POST | `/bids` | JWT | EXPERT | Submit bid (notifies CEO + TechTeam via WS) |
| 13.B.2 | GET | `/bids?projectId=` | JWT | EXPERT (own), CLIENT (their projects), ADMIN (all) | List bids |
| 13.B.3 | GET | `/bids/:id` | JWT | party | Bid detail |
| 13.B.4 | PUT | `/bids/:id` | JWT | EXPERT | Update bid |
| 13.B.5 | DELETE | `/bids/:id` | JWT | EXPERT | Withdraw (only SUBMITTED state) |
| 13.B.6 | PUT | `/bids/:id/tech-review` | JWT | TECH_TEAM | Approve / request revision |
| 13.B.7 | PUT | `/bids/:id/ceo-decision` | JWT | CLIENT | Select / decline |
| 13.B.8 | PUT | `/bids/:id/counter-offer` | JWT | CLIENT | Counter-offer on price |

### 13.B.1 Create Bid (DTO Dehardcoded)

`POST /bids`:
```json
{
  "projectId": "uuid",
  "footprint_alignment_json": {
    "domains": [
      { "code": "A", "depth": "DEEP" },
      { "code": "D", "depth": "OPERATIONAL" }
    ],
    "seams": [
      { "code": "A↔C", "tier": "CLAIMED" },
      { "code": "A↔D", "tier": "EVIDENCE_BACKED" }
    ]
  },
  "approach_summary": "I'll build a 3-stage pipeline...",
  "conditional_pricing_json": [
    { "milestone_number": 1, "price_vnd": 40000000, "condition": "Standard scope" }
  ]
}
```

**Critical:**
- `code` values are any non-empty string (validated against DB at service layer).
- Seam codes **MUST use ↔ arrow**.
- `depth` ∈ {SURFACE, OPERATIONAL, DEEP}.
- `tier` ∈ {CLAIMED, EVIDENCE_BACKED}.

On submission, NestJS emits `notification:generic` WebSocket event to **both** CEO and all linked Tech Team members (see §24.1).

### 13.B.5 Withdraw Bid (NEW)

`DELETE /bids/:id`. Only works when `state === SUBMITTED`. Returns `{ withdrawn: true, bidId }`.

### 13.C Milestones

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 13.C.1 | POST | `/milestones` | JWT | Create milestone (CEO only) |
| 13.C.2 | GET | `/milestones?engagementId=` | JWT | List by engagement |
| 13.C.3 | GET | `/milestones/:id` | JWT | Detail (includes criteria) |
| 13.C.4 | PATCH | `/milestones/:id` | JWT | Edit (only state=DEFINED) |
| 13.C.5 | DELETE | `/milestones/:id` | JWT | Delete (only state=DEFINED) |
| 13.C.6 | PUT | `/milestones/:id/fund` | JWT | Initiate funding (locks escrow) |
| 13.C.7 | GET | `/milestones/:id/disputes` | JWT | Disputes on this milestone |

### 13.D DoD Items

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 13.D.1 | POST | `/milestones/:id/dod/items` | JWT | Add DoD item |
| 13.D.2 | PUT | `/milestones/:id/dod/:itemId` | JWT | Update status (PENDING/COMPLETED/NOT_APPLICABLE) |
| 13.D.3 | DELETE | `/milestones/:id/dod/:itemId` | JWT | Delete (only PENDING) |
| 13.D.4 | GET | `/milestones/:id/dod` | JWT | List DoD items |

**DoD gate:** expert cannot `POST /milestones/:id/submit` until all `is_required = true` DoD items are `COMPLETED`. A required item **cannot** be set to `NOT_APPLICABLE` (DB constraint).

### 13.E Acceptance Criteria

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 13.E.1 | GET | `/criteria/:milestoneId` | JWT | List criteria for milestone |
| 13.E.2 | POST | `/criteria/:milestoneId` | JWT | Add criterion |
| 13.E.3 | DELETE | `/criteria/:id` | JWT | Delete criterion |
| 13.E.4 | PUT | `/criteria/:id/verify` | JWT | Verify / sign off |
| 13.E.5 | PUT | `/criteria/:id/revision` | JWT | Reject with revision note |

When a criterion is created (`POST /criteria/:milestoneId`), NestJS calls FastAPI `/llm/criterion-check` to detect subjective language. Result is stored as a `platform_decisions` row with `advisory_note`. The criterion is **always saved** (advisory only, non-blocking). FE should display the advisory inline.

### 13.F Submissions

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 13.F.1 | POST | `/milestones/:id/submit` | JWT | EXPERT | Submit deliverable (DoD gate enforced) |
| 13.F.2 | POST | `/milestones/:id/paygated-docs` | JWT | EXPERT | Stage a paygated technical doc |
| 13.F.3 | GET | `/milestones/:id/paygated-docs` | JWT | TECH_TEAM, EXPERT | Download unlocked docs (CEO excluded) |
| 13.F.4 | GET | `/milestones/:id/submissions` | JWT | party | Submission/revision history |
| 13.F.5 | GET | `/milestones/:id/submissions/latest` | JWT | party | Most recent submission |

### 13.F.1 Submit Milestone

`POST /milestones/:id/submit`:
```json
{
  "description": "Implemented the rule parser with the 3-category ruleset. See attached test report.",
  "filesJson": ["https://storage.example.com/rule-parser-v1.pdf"]
}
```

Server enforces DoD gate before accepting. On success, milestone state → `SUBMITTED`. CEO is notified.

### 13.F.2 / 13.F.3 Paygated Documents

Expert stages detailed technical docs that are released only when milestone is `APPROVED`. Tech Team and Expert can download; **CEO is excluded** by role check.

---

## 14. Disputes

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 14.1 | POST | `/disputes` | JWT | File dispute (milestone must be SUBMITTED or IN_REVISION) |
| 14.2 | GET | `/disputes?state=` | JWT | List (own or all for ADMIN) |
| 14.3 | GET | `/disputes/:id` | JWT | Detail |
| 14.4 | POST | `/disputes/:id/evidence` | JWT | Add evidence to open dispute |
| 14.5 | PUT | `/disputes/:id/withdraw` | JWT | Withdraw (filer only, before resolution) |

### 14.1 File Dispute → LLM Arbitration Flow

`POST /disputes`:
```json
{
  "engagementId": "uuid",
  "milestoneId": "uuid",
  "criterionId": "uuid",
  "evidenceDescription": "Deliverable missing the API spec section required by criterion 3",
  "fileUrls": ["https://storage.example.com/evidence.pdf"]
}
```

Server flow:
1. Create dispute row, state = `LAYER_1_EVAL`.
2. Call FastAPI `/llm/dispute-eval` with criterion text + deliverable description + project archetype + milestone context + prior revision count.
3. Receive `{ confidence_score, finding, reasoning }`.
4. If `confidence >= 0.80` → state = `AUTO_RESOLVED`, escrow released/refunded per `finding`.
5. If `< 0.80` → state = `MANUAL_REVIEW`, surfaces in admin queue with `reasoning` text.

**FE:** display `llm_confidence` and `reasoning` (for manual review queue) prominently.

### 14.4 Submit Additional Evidence (NEW)

`POST /disputes/:id/evidence` `{ evidence_description, file_urls }`. Only works while dispute is in `LAYER_1_EVAL` or `MANUAL_REVIEW`. Stored as a `platform_decisions` row for audit trail.

### 14.5 Withdraw Dispute (NEW)

`PUT /disputes/:id/withdraw`. Filer only, before resolution. Moves state to `WITHDRAWN`.

---

## 15. Messaging (REST + WebSocket)

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 15.1 | GET | `/engagements/:id/messages?limit=&cursorId=` | JWT | Engagement chat history (cursor pagination) |
| 15.2 | GET | `/projects/:id/messages?limit=&cursorId=` | JWT | Pre-bid project Q&A thread |
| 15.3 | POST | `/messages/:id/read` | JWT | Mark single message as read |
| 15.4 | GET | `/engagements/:id/messages/unread-count` | JWT | Unread count for engagement |
| 15.5 | GET | `/projects/:id/messages/unread-count` | JWT | Unread count for project thread |
| 15.6 | GET | `/conversations` | JWT | List all active conversation threads |

### 15.1 Cursor Pagination

Use `cursorId` (last message ID from previous page) for infinite scroll. `limit` defaults to 50. Response is `{ messages: [...], hasMore: boolean, nextCursorId: string | null }`.

### 15.6 Conversations List (NEW)

`GET /conversations` →
```json
[{
  "type": "engagement",
  "id": "engagement-uuid",
  "projectName": "AdTech Pipeline",
  "otherParty": { "id": "uuid", "fullName": "Jane Doe" },
  "lastMessage": { "content": "Thanks!", "createdAt": "...", "senderId": "..." },
  "unreadCount": 3
}]
```

FE: render as inbox sidebar. Sort by `lastMessage.createdAt` desc (server pre-sorts).

### 15.7 Sending Messages — WebSocket Only

Messages are sent via Socket.IO `message:send` event (see §24.2), NOT via REST. REST is read-only.

---

## 16. Notifications (REST + WebSocket)

The `Notification` table is NEW. Notifications are **both** WebSocket-emitted (real-time) and DB-persisted (survive refresh).

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 16.1 | GET | `/notifications/me?limit=&unreadOnly=` | JWT | List my notifications |
| 16.2 | GET | `/notifications/me/unread-count` | JWT | Unread count (nav badge) |
| 16.3 | PUT | `/notifications/:id/read` | JWT | Mark one as read |
| 16.4 | PUT | `/notifications/read-all` | JWT | Mark all as read |
| 16.5 | DELETE | `/notifications/:id` | JWT | Delete notification |

### 16.1 List Response

```json
[{
  "id": "uuid",
  "type": "bid_update",       // or "system", "milestone_update"
  "title": "New Expert Bid!",
  "body": "Jane Doe bid on your project",
  "link": "/ceo/projects/uuid",
  "isRead": false,
  "createdAt": "2026-..."
}]
```

### 16.2 Nav Badge

`GET /notifications/me/unread-count` → `{ unread_count: 5 }`. Poll every 30s OR rely on WebSocket `notification:generic` event to trigger a refetch.

---

## 17. Invitations

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 17.1 | GET | `/invitations` | JWT | EXPERT | All my invitations (PENDING/ACCEPTED/DECLINED) |
| 17.2 | POST | `/invitations/:id/decline` | JWT | EXPERT | Decline |
| 17.3 | GET | `/invitations/sent` | JWT | CLIENT | Invitations CEO sent (all projects) |
| 17.4 | DELETE | `/invitations/:id` | JWT | CLIENT | Retract pending invitation |

### 17.1 Expert Invitations — Company Name Patch

`GET /invitations` response:
```json
[{
  "id": "uuid",
  "status": "PENDING",
  "invitedAt": "2026-...",
  "isExpired": false,                // computed at query time
  "project": { "id": "uuid", "projectName": "AdTech Pipeline" },
  "ceo": {
    "id": "ceo-uuid",
    "fullName": "Albert Tran",
    "clientProfile": { "companyName": "AITasker Corp" }
  }
}]
```

**FE access pattern:**
```typescript
const companyName = invitation.ceo.clientProfile?.companyName ?? invitation.ceo.fullName;
```
The optional chain is needed because a CEO who never set up `clientProfile` will have `clientProfile: null`. Fallback to `fullName`.

`isExpired` is computed at query time from `expiresAt` — no background job needed.

### 17.4 Retract Invitation

`DELETE /invitations/:id` — only works while `status === PENDING`. Accepted invitations cannot be retracted (expert already bid).

---

## 18. Reviews

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 18.1 | POST | `/reviews` | JWT | party | Create review (post-engagement) |
| 18.2 | GET | `/reviews/:engagementId` | JWT | any | All reviews for engagement |
| 18.3 | GET | `/reviews/users/:userId` | JWT | any | Public profile reviews |
| 18.4 | GET | `/reviews/me` | JWT | any | Reviews I wrote |
| 18.5 | GET | `/reviews/me/received` | JWT | any | Reviews I received |

### 18.1 Create Review

`POST /reviews`:
```json
{
  "engagementId": "uuid",
  "rating": 5,                     // 1-5
  "comment": "Excellent work, delivered ahead of schedule.",
  "structuredSignalsJson": { "communication": 5, "quality": 5, "timeliness": 4 }
}
```

Only allowed after engagement `state === CLOSED`. One review per party per engagement (unique constraint).

---

## 19. Admin Module (Oversight)

All `JWT` + role `ADMIN`.

| # | Method | Path | Purpose |
|---|---|---|---|
| 19.1 | PUT | `/admin/projects/:id/suspend-spec` | Emergency pull-back of published spec |
| 19.2 | PUT | `/admin/users/:id/suspend` | Suspend fraudulent account |
| 19.3 | GET | `/admin/disputes?state=` | Disputes queue |
| 19.4 | PUT | `/admin/disputes/:id/resolve` | Manually resolve escalated dispute |
| 19.5 | GET | `/admin/decisions?decisionType=&entityType=` | LLM/AI decisions log |
| 19.6 | GET | `/admin/transactions?type=&userId=` | Wallet tx ledger |
| 19.7 | GET | `/admin/analytics` | Platform aggregates |
| 19.8 | GET | `/admin/withdrawals?status=` | Withdrawal queue |
| 19.9 | PUT | `/admin/withdrawals/:id/complete` | Manually confirm withdrawal sent |
| 19.10 | PUT | `/admin/withdrawals/:id/fail` | Mark failed (refunds wallet) |
| 19.11 | GET | `/admin/users?role=&isActive=&search=` | List users |
| 19.12 | GET | `/admin/users/:id` | Full user detail (wallet + subs) |
| 19.13 | PUT | `/admin/users/:id/reactivate` | Reactivate suspended account |
| 19.14 | GET | `/admin/projects?state=&archetype=` | List all projects |
| 19.15 | GET | `/admin/projects/:id` | Full project detail |
| 19.16 | PUT | `/admin/projects/:id/reopen` | Reopen suspended project |
| 19.17 | GET | `/admin/engagements?state=&projectId=` | List all engagements |
| 19.18 | GET | `/admin/experts?limit=` | List experts with verification status |

### 19.4 Resolve Dispute

`PUT /admin/disputes/:id/resolve`:
```json
{ "resolution": "expert_wins", "note": "Reviewed evidence — deliverable meets criterion 3." }
```
Triggers escrow release or refund based on `resolution`.

### 19.5 Platform Decisions Log

Returns LLM confidence scores, advisory notes, entity references — useful for the admin "AI Decisions Monitor" dashboard. Filterable by `decisionType` (e.g. `ELICITATION_SYNTHESIS`, `PORTFOLIO_EVAL`, `DISPUTE_L1_EVAL`, `CRITERION_QUALITY_GATE`).

---

## 20. Admin Config CMS (Domains / Seams / Archetypes / Probes / Void Codes)

All `JWT` + role `ADMIN`. Soft-delete pattern: `DELETE` sets `isActive: false`; public `/config/*` endpoints filter to `isActive: true`.

| Resource | Endpoints |
|---|---|
| Domains | `GET/POST /admin/config/domains` · `PUT/DELETE /admin/config/domains/:id` |
| Seams | `GET/POST /admin/config/seams` · `PUT/DELETE /admin/config/seams/:id` |
| Archetypes | `GET/POST /admin/config/archetypes` · `PUT/DELETE /admin/config/archetypes/:id` |
| Probe Questions | `GET /admin/config/probe-questions?archetypeCode=` · `POST` · `PUT/DELETE /admin/config/probe-questions/:id` |
| Void Codes | `GET/POST /admin/config/void-codes` · `PUT/DELETE /admin/config/void-codes/:id` |

### Create/Update Shapes

```json
// Domain / Seam / Archetype
{ "code": "G", "name": "Agentic Systems", "description": "...", "sortOrder": 7, "isActive": true }

// Probe Question
{ "archetypeCode": "3", "questionText": "How many items per day?", "displayOrder": 1 }

// Void Code
{ "code": "GDPR_COMPLIANCE_RISK", "name": "GDPR Compliance Risk",
  "description": "EU personal data involved. DPA registration and breach notification apply.",
  "severity": "HIGH", "sortOrder": 9 }
```

**FE Admin UI:** after any create/update/delete, the change is **immediately visible** to all FE clients via `/config/*` (no AI service restart needed for void codes — they are read by the AI service from NestJS `/internal/prompts` endpoint, but void code definitions are read directly from DB by NestJS at elicitation time).

---

## 21. Admin Subscriptions Packages

| # | Method | Path | Purpose |
|---|---|---|---|
| 21.1 | GET | `/admin/subscriptions/packages` | List ALL (active + inactive) |
| 21.2 | POST | `/admin/subscriptions/packages` | Create |
| 21.3 | PUT | `/admin/subscriptions/packages/:id` | Update price/duration (existing subs unaffected) |
| 21.4 | DELETE | `/admin/subscriptions/packages/:id` | Hard delete (blocked if purchase history) |

### 21.2 Create

`POST /admin/subscriptions/packages`:
```json
{ "role": "CLIENT", "name": "Client Pro Monthly", "priceVnd": 100000, "durationMonths": 1 }
```

### 21.4 Delete — 422 Guard

If the package has been purchased before, DELETE returns 422:
```json
{ "statusCode": 422, "message": "Cannot delete 'Client Pro' — it has 3 purchase record(s). Deactivate instead." }
```
Admin must use `PUT /admin/subscriptions/packages/:id` with `{ "isActive": false }` to deactivate.

**FE:** admin list shows inactive packages greyed out. Public `/config/subscription-packages` shows only active.

---

## 22. Admin Prompt Templates (NEW — Dynamic AI Issue 1)

| # | Method | Path | Purpose |
|---|---|---|---|
| 22.1 | GET | `/admin/prompts` | List metadata (no full text) |
| 22.2 | GET | `/admin/prompts/:stage` | Full template text |
| 22.3 | PUT | `/admin/prompts/:stage` | Create or update |
| 22.4 | DELETE | `/admin/prompts/:stage` | Reset to default `.txt` file (removes DB override) |

**Valid stages:** `stage1_extract`, `stage3_vagueness_check`, `stage4_recommend`, `stage5_synthesize`, `milestone_chat`, `criterion_check`, `dispute_eval`, `portfolio_eval`, `service_generate`.

### 22.3 Upsert

`PUT /admin/prompts/:stage`:
```json
{ "templateText": "...Jinja2 template with {{ variables }}...", "description": "Updated to add GDPR detection" }
```

Response: `{ "id", "stage", "version": 4, "updatedAt": "..." }`

**Jinja2 variables available per stage:**
| Stage | Variables |
|---|---|
| `stage1_extract` | `{{ archetypes }}`, `{{ void_codes }}` |
| `stage5_synthesize` | `{{ domains }}`, `{{ seams }}`, `{{ archetypes }}` |
| `portfolio_eval` | `{{ seam_definitions }}`, `{{ evaluated_seam_code }}`, `{{ evaluated_seam_name }}`, `{{ evaluated_seam_desc }}` |
| `service_generate` | `{{ price_guidance }}`, `{{ claimed_domains }}`, `{{ claimed_seams }}`, `{{ is_pro_expert }}` |
| `criterion_check` | `{{ archetype_name }}` |

**Changes take effect within 60 seconds** (FastAPI cache TTL) — no restart needed. `DELETE` resets to `.txt` file fallback and resets the version counter.

**FE Admin warnings:**
- Malformed Jinja2 → FastAPI catches the error and uses raw template text. Warn admin: "Test prompt changes in staging first."
- Show a diff viewer between current DB template and the `.txt` default.

---

## 23. Internal Endpoints (NestJS ↔ FastAPI)

These are NOT FE-facing. Documented to prevent accidental FE calls.

| Method | Path | Caller | Purpose |
|---|---|---|---|
| GET | `/internal/prompts/:stage` | FastAPI → NestJS | Fetch DB-stored prompt template (60s TTL cache on FastAPI side) |

Headers: `x-internal-token: <shared-secret>`.

FastAPI endpoints (port 8000) — all called by NestJS, never by FE:
- `POST /llm/elicitation/stage1-extract`
- `POST /llm/elicitation/stage3-vagueness-check`
- `POST /llm/elicitation/stage4-recommend`
- `POST /llm/elicitation/stage5-synthesize`
- `POST /llm/elicitation/milestone-chat`
- `POST /llm/portfolio-eval`
- `POST /llm/dispute-eval`
- `POST /llm/criterion-check`
- `POST /llm/service-generate`
- `POST /llm/matching`
- `GET /projects/:id/artifact-b` (4-condition gate check)

---

## 24. WebSocket Event Catalog

**Namespace:** default (`/`) · **Transport:** Socket.IO with Redis adapter (for multi-instance scaling).

**Auth:** `socket.handshake.auth.token` must be a valid JWT. On connect, server joins socket to room `user:<userId>`.

### 24.1 Server → Client Events

| Event | Payload | Trigger |
|---|---|---|
| `notification:generic` | `{ type, title, body, link }` | Bid submitted, milestone state change, system notice |
| `message:received` | `{ id, engagementId, senderId, content, timestamp }` | New chat message in engagement |
| `project:message` | `{ id, projectId, senderId, content, timestamp }` | New pre-bid Q&A message |
| `bid:update` | `{ bidId, newState, engagementId }` | Bid state transition (TECH_APPROVED, SELECTED, etc.) |
| `milestone:update` | `{ milestoneId, newState, engagementId }` | Milestone state transition |
| `dispute:update` | `{ disputeId, newState, engagementId }` | Dispute state transition |

### 24.1.1 `notification:generic` — Persisted

When this event fires, NestJS **also writes a `Notification` row to DB**. So even if the user's WS is disconnected, `GET /notifications/me` will return it. FE should:
1. Listen to `notification:generic` for real-time toast.
2. On toast dismiss or page nav, refetch `GET /notifications/me/unread-count` for the badge.
3. On page load, always fetch `GET /notifications/me` (don't rely solely on WS).

### 24.2 Client → Server Events

| Event | Payload | Purpose |
|---|---|---|
| `message:send` | `{ engagementId, content, attachmentUrl? }` | Send engagement chat message |
| `project:message:send` | `{ projectId, content }` | Send pre-bid Q&A message |
| `typing:start` | `{ engagementId }` | Typing indicator |
| `typing:stop` | `{ engagementId }` | Typing indicator |

### 24.2.1 `message:send` Flow

1. FE emits `message:send` with `{ engagementId, content }`.
2. Server validates parties, persists `Message` row.
3. Server emits `message:received` to the other party's socket room.
4. Server does NOT echo back to sender (sender optimistically adds to local state).

**FE pattern:** optimistic update local message list on send; on `message:received` from the other party, append to list.

---

## 25. Full 40-Table Data Model

This is the authoritative schema reference. For full Prisma definitions, see `backend/prisma/schema.prisma`.

| # | Table | Purpose | Key Constraints |
|---|---|---|---|
| 1 | `users` | All accounts | Multi-role, `isActive`, `refreshTokenHash` for logout |
| 2 | `client_profiles` | CEO company info | 1:1 with users |
| 3 | `expert_profiles` | Expert bio + stack tags | 1:1 with users |
| 4 | `tech_team_profiles` | Tech team linked to CEO + project | 1:1 with users |
| 5 | `wallets` | User balances | 1:1 with users, BigInt balances |
| 6 | `wallet_transactions` | Immutable ledger | `UNIQUE(wallet_id, reference_id)` for idempotency |
| 7 | `virtual_accounts` | SePay VA for topup/milestone/service | `entity_type` ∈ {WALLET_TOPUP, MILESTONE, SERVICE} |
| 8 | `withdrawal_requests` | Cash-out requests | `status` ∈ {PENDING, COMPLETED, FAILED, CANCELLED} |
| 9 | `platform_settings` | Singleton — platform fee % | Read at every APPROVED tx, never hardcoded |
| 10 | `elicitation_sessions` | 5-stage elicitation state machine | `state` ∈ {IN_PROGRESS, COMPLETED, ABANDONED, RETURNED} |
| 11 | `projects` | Published project specs | `state` ∈ {DRAFT, PUBLISHED, RETURNED_TO_CLIENT, SUSPENDED} |
| 12 | `project_shortlist_cache` | Matching results cache | `source` ∈ {AUTO, FORCE_REFRESH} |
| 13 | `expert_domain_depths` | Expert → domain depth claims | `UNIQUE(expert_id, domain_code)` |
| 14 | `expert_seam_claims` | Expert → seam verification | `UNIQUE(expert_id, seam_code)`, tier ∈ {CLAIMED, EVIDENCE_BACKED} |
| 15 | `portfolio_submissions` | LLM-evaluated evidence | `status` ∈ {PENDING, APPROVED, REJECTED} |
| 16 | `services` | Marketplace listings | `state` ∈ {DRAFT, PUBLISHED, SUSPENDED} |
| 17 | `engagements` | Expert-client working relationship | `state` ∈ {PENDING, CONNECTED, ACTIVE, CLOSED, DISPUTED, CANCELLED} |
| 18 | `capability_bids` | Bid state machine | `state` ∈ {DRAFT, SUBMITTED, TECH_REVIEW, REVISION_REQUESTED, TECH_APPROVED, CEO_REVIEW, SELECTED, DECLINED, WITHDRAWN} |
| 19 | `milestones` | Project execution units | `state` ∈ {DEFINED, AWAITING_PAYMENT, FUNDED, IN_PROGRESS, SUBMITTED, IN_REVISION, APPROVED, RELEASED, DISPUTED} |
| 20 | `acceptance_criteria` | Per-milestone sign-off items | `verified_by_role` ∈ {CEO, TECH_TEAM, JOINT} |
| 21 | `milestone_dod_items` | Definition of Done checklist | `NOT (is_required = TRUE AND status = 'NOT_APPLICABLE')` |
| 22 | `milestone_submissions` | Deliverable submissions | Revision history |
| 23 | `paygated_documents` | Staged tech docs released on approval | `release_state` ∈ {STAGED, RELEASED} |
| 24 | `escrow_accounts` | Locked funds | `status` ∈ {HELD, RELEASED, FROZEN, REFUNDED, SPLIT} |
| 25 | `disputes` | Milestone disputes | `state` ∈ {PENDING, LAYER_1_EVAL, AUTO_RESOLVED, MANUAL_REVIEW, RESOLVED, WITHDRAWN} |
| 26 | `messages` | Chat messages | `engagementId` OR `projectId` (one null, one set) |
| 27 | `message_reads` | Read receipts | `UNIQUE(message_id, user_id)` |
| 28 | `reviews` | Post-engagement reviews | `UNIQUE(engagement_id, reviewer_id)`, rating 1-5 |
| 29 | `platform_decisions` | LLM decision audit log | `decision_type` enum |
| 30 | `domain_definitions` | CMS: domain taxonomy | Soft-delete via `isActive` |
| 31 | `seam_definitions` | CMS: seam taxonomy | Soft-delete via `isActive` |
| 32 | `archetype_definitions` | CMS: project archetypes | Soft-delete via `isActive` |
| 33 | `probe_questions` | CMS: Stage 3 questions | Per-archetype |
| 34 | `void_code_definitions` | CMS: void taxonomy | `severity` ∈ {HIGH, MEDIUM, LOW} |
| 35 | `prompt_templates` | CMS: LLM prompt overrides | DB priority over `.txt` files, 60s TTL |
| 36 | `subscription_packages` | CMS: subscription products | Hard-delete blocked if purchase history |
| 37 | `subscription_purchase_logs` | Purchase history | Immutable |
| 38 | `milestone_chat_sessions` | E-3 chat assistant history | `messagesJson` array of `{role, content}` |
| 39 | `invitations` | CEO → expert invites | `UNIQUE(project_id, expert_id)`, 7-day expiry |
| 40 | `notifications` | Persisted notifications | `type` ∈ {bid_update, system, milestone_update} |

---

## 26. Breaking Changes Cheatsheet

| # | What changed | Old FE behavior | New FE behavior |
|---|---|---|---|
| 1 | `POST /subscriptions/activate` | Body `{ activeRole }` | **REQUIRES `packageId`** from `GET /config/subscription-packages` |
| 2 | `GET /subscriptions/status` | FE computed `isExpired` from date | Trust `subscriptionTier` directly — server auto-corrects |
| 3 | `POST /auth/register` password errors | Single string message | `message` is **array** — iterate for checklist UI |
| 4 | `POST /auth/register` email | Stored as-is | Normalized to lowercase; display `response.user.email` |
| 5 | Stage 2 archetype list | Hardcoded `['1'..'6']` | Fetch `GET /config/archetypes` |
| 6 | Stage 3 probe questions | Hardcoded strings | Fetch `GET /config/archetypes/:code/probe-questions` |
| 7 | Stage 3 response | Only `vague_answers` | Now has `irrelevant_answers` — render as separate warning type |
| 8 | Stage 4 request | `{ current_stack, data_available, latency_requirement }` | Add `technical_artifacts: {}` and `additional_requirement_1` |
| 9 | Stage 4 response | Updated session object directly | Shape is now `{ session, missingArtifacts }` |
| 10 | `GET /projects/:id` | No domains/seams/milestones | All three now present — use for BidForm |
| 11 | Subscription price display | Hardcoded 500k/300k VND | Fetch `GET /config/subscription-packages?role=CLIENT\|EXPERT` |
| 12 | Tech Team empty state | Always "Waiting for CEO" | Show only when `GET /projects` returns `[]` |
| 13 | Password reset page | Only forgot+reset endpoints | Add `GET /auth/verify-reset-token/:token` check on page load |
| 14 | Void code display (Stage 2) | Hardcoded descriptions in FE | Fetch `GET /config/void-codes`, look up by `void_code` |
| 15 | Stage 1 response | No artifact requirements | Handle `criticalArtifactsJson` → show Stage 4 persistent reminder |
| 16 | Seam code format | `A<->C` ASCII | **`A↔C` Unicode arrow** — old format rejected by DB |
| 17 | Domain codes in DTOs | Strict enum `A`-`F` | Any non-empty string (validated against DB at service layer) |
| 18 | `POST /auth/logout` | FE-only token clear | Call server endpoint to invalidate `refreshTokenHash` |
| 19 | Wallet tx list | No pagination | Use `?type=&limit=&offset=` query params |
| 20 | Withdrawal cancellation | Not possible | `DELETE /withdrawals/:id` (PENDING only) |
| 21 | Notifications | WebSocket-only (lost on refresh) | Now persisted — `GET /notifications/me` survives refresh |
| 22 | `GET /config/all` | 5 separate round trips | Single call on app mount |
| 23 | Invitation `ceo` object | `{ id, fullName }` | Now includes `clientProfile.companyName` — use optional chain |
| 24 | Bid submission notification | CEO only | CEO **+ all linked Tech Team members** |
| 25 | `POST /bids` body `code` fields | Enum-validated | Any non-empty string — DB validates at service layer |

---

## 27. Mandatory FE Consumption Checklist (Anti-Rot Gate)

**Every endpoint below MUST have a FE caller.** If any row has no FE consumer, that's rot code — file a ticket immediately.

### Auth (12 endpoints)
- [ ] `POST /auth/register` — Registration page
- [ ] `POST /auth/login` — Login page
- [ ] `PUT /auth/switch-role` — Role switcher dropdown
- [ ] `POST /auth/refresh` — Axios interceptor on 401
- [ ] `POST /auth/register/handoff` — Tech team invite landing page
- [ ] `POST /auth/verify-tax-code` — CEO profile setup wizard
- [ ] `POST /auth/claim-handoff` — Existing-user tech team claim page
- [ ] `POST /auth/forgot-password` — Forgot password page
- [ ] `POST /auth/reset-password` — Reset password page
- [ ] `GET /auth/verify-reset-token/:token` — Reset password page mount guard
- [ ] `POST /auth/logout` — Logout button
- [ ] `PUT /auth/me/password` — Settings → Change password

### Users (6 endpoints)
- [ ] `POST /users/me/add-role` — Settings → Add role
- [ ] `GET /users/me` — App shell (user context)
- [ ] `PUT /users/me` — Settings → Profile
- [ ] `GET /users/:userId/public-profile` — Public profile page
- [ ] `PUT /users/me/tax-code` — CEO profile setup
- [ ] `GET /users/experts` — CEO "Find Talent" page

### Wallet & Withdrawals (6 endpoints)
- [ ] `GET /wallets/me` — Wallet dashboard
- [ ] `GET /wallets/me/transactions` — Wallet tx history (paginated)
- [ ] `POST /wallets/virtual-accounts/topup` — Topup modal
- [ ] `POST /withdrawals` — Withdraw modal
- [ ] `GET /withdrawals` — Withdrawal history
- [ ] `DELETE /withdrawals/:id` — Cancel pending withdrawal button

### Bank Hub & Webhooks (4 endpoints — FE consumes 1)
- [ ] `POST /bank-hub/initiate-link` — Settings → Link bank account
- [ ] `POST /webhooks/sepay/ipn` — **No FE caller** (server-to-server) ✓
- [ ] `POST /webhooks/sepay/chi-ho-credit` — **No FE caller** ✓
- [ ] `POST /webhooks/sepay/bank-linked` — **No FE caller** ✓

### Subscriptions (3 endpoints)
- [ ] `POST /subscriptions/activate` — Subscription activation modal
- [ ] `GET /subscriptions/status` — App shell (subscription context)
- [ ] `GET /subscriptions/history` — Settings → Subscription history

### Public Config (7 endpoints)
- [ ] `GET /config/domains` — Used by `/config/all`
- [ ] `GET /config/seams` — Used by `/config/all`
- [ ] `GET /config/archetypes` — Used by `/config/all`
- [ ] `GET /config/archetypes/:code/probe-questions` — Stage 3 form
- [ ] `GET /config/void-codes` — Used by `/config/all`
- [ ] `GET /config/subscription-packages` — Subscription modal
- [ ] `GET /config/all` — **App mount bootstrap (call once, cache)**

### Elicitation (19 endpoints)
- [ ] `POST /elicitation/sessions` — Elicitation entry
- [ ] `GET /elicitation/sessions` — Elicitation dashboard
- [ ] `GET /elicitation/sessions/active` — App shell (resume active session)
- [ ] `GET /elicitation/sessions/history` — History list
- [ ] `GET /elicitation/sessions/:id` — Session detail
- [ ] `DELETE /elicitation/sessions/:id` — Delete session button
- [ ] `PUT /elicitation/sessions/:id/abandon` — Abandon button
- [ ] `GET /elicitation/sessions/history` — History page
- [ ] `PUT /elicitation/sessions/:id/stage1` — Stage 1 form submit
- [ ] `PUT /elicitation/sessions/:id/stage2` — Stage 2 archetype select
- [ ] `PUT /elicitation/sessions/:id/stage3` — Stage 3 probe form
- [ ] `PUT /elicitation/sessions/:id/stage4` — Stage 4 tech context form
- [ ] `PUT /elicitation/sessions/:id/stage4-handoff` — Tech team Stage 4 form
- [ ] `POST /elicitation/sessions/:id/stage5` — Stage 5 publish button
- [ ] `POST /elicitation/sessions/:id/generate-handoff-link` — Handoff link generator
- [ ] `PUT /elicitation/sessions/:id/self-technical` — Self-technical toggle
- [ ] `POST /elicitation/sessions/:id/retry-synthesis` — Retry button (on 503)
- [ ] `PUT /elicitation/sessions/:id/revert` — Back button
- [ ] `PUT /elicitation/sessions/:id/continue` — Resume button
- [ ] `POST /elicitation/sessions/:id/stage4-recommend` — "AI suggest" button in Stage 4
- [ ] `PATCH /elicitation/sessions/:id/draft` — Stage 1 draft autosave
- [ ] `PATCH /elicitation/sessions/:id/stage4-draft` — Stage 4 draft autosave (every 30s)

### Projects (11 endpoints)
- [ ] `GET /projects` — Projects list page
- [ ] `GET /projects/:id` — Project detail page
- [ ] `GET /projects/:id/artifact-a` — Artifact A viewer (or use from project detail)
- [ ] `GET /projects/:id/artifact-b` — Artifact B viewer (gated)
- [ ] `PUT /projects/:id/name` — Rename project
- [ ] `POST /projects/:id/milestone-chat` — Milestone chat input
- [ ] `GET /projects/:id/milestone-chat/sessions` — Chat sidebar
- [ ] `GET /projects/:id/milestone-chat/sessions/:sessionId` — Chat history click
- [ ] `GET /projects/:id/milestones` — Milestone list tab
- [ ] `PUT /projects/:id/milestones` — Milestone framework editor (CEO)
- [ ] `PUT /projects/:id/cancel` — Cancel project button
- [ ] `GET /projects/:id/engagements` — Project engagements tab (CEO/Admin)
- [ ] `GET /projects/:id/invitations` — Project invitations tab (CEO)
- [ ] `GET /projects/:id/team` — Project team tab

### Matching (1 endpoint)
- [ ] `GET /matching/:projectId/shortlist?refresh=` — CEO shortlist page

### Expert Profiles (17 endpoints)
- [ ] `GET /expert-profile/me` — Expert profile page
- [ ] `PUT /expert-profile/me` — Edit profile form
- [ ] `GET /expert-profile/search` — Expert search page (CEO)
- [ ] `GET /expert-profile/:userId` — Expert public profile
- [ ] `GET /expert-profile/me/domains` — My domains list
- [ ] `GET /expert-profile/me/seams` — My seams list
- [ ] `POST /expert-profile/domains` — Add domain form
- [ ] `PUT /expert-profile/domains/sync` — Bulk sync domains
- [ ] `PUT /expert-profile/domains/:id` — Edit domain
- [ ] `DELETE /expert-profile/domains/:id` — Delete domain
- [ ] `POST /expert-profile/seams` — Add seam claim
- [ ] `PUT /expert-profile/seams/sync` — Bulk sync seams
- [ ] `POST /portfolio-submissions` — Portfolio submit form
- [ ] `GET /portfolio-submissions` — My portfolio list
- [ ] `GET /portfolio-submissions/:id` — Submission detail
- [ ] `GET /portfolio-submissions/me/portfolio/:id` — Portfolio entry detail
- [ ] `DELETE /portfolio-submissions/me/portfolio/:id` — Delete portfolio entry

### Listings (10 endpoints)
- [ ] `GET /services` — Marketplace browse
- [ ] `POST /services` — Create listing form (with AI assist)
- [ ] `GET /services/:id` — Listing detail
- [ ] `PUT /services/:id` — Edit listing
- [ ] `DELETE /services/:id` — Delete listing (DRAFT only)
- [ ] `POST /services/:id/purchase` — Purchase button
- [ ] `GET /services/me` — My listings dashboard
- [ ] `GET /services/me/purchases` — My purchases
- [ ] `PUT /services/:id/publish` — Publish button
- [ ] `PUT /services/:id/unpublish` — Unpublish button

### Engagements (10 endpoints)
- [ ] `GET /engagements` — Engagements list
- [ ] `GET /engagements/:id` — Engagement detail
- [ ] `PUT /engagements/:id/accept-nda` — NDA accept modal
- [ ] `POST /engagements/:id/connect` — Connect button (expert)
- [ ] `PUT /engagements/:id/decline` — Decline button
- [ ] `GET /engagements/:id/milestones` — Engagement milestones tab
- [ ] `GET /engagements/:id/submissions` — All submissions tab
- [ ] `GET /engagements/:id/bid` — Bid detail tab
- [ ] `GET /engagements/:id/disputes` — Disputes tab
- [ ] `PUT /engagements/:id/cancel` — Cancel engagement button

### Bids (8 endpoints)
- [ ] `POST /bids` — Bid submission form
- [ ] `GET /bids` — Bids list (role-scoped)
- [ ] `GET /bids/:id` — Bid detail
- [ ] `PUT /bids/:id` — Edit bid
- [ ] `DELETE /bids/:id` — Withdraw bid button
- [ ] `PUT /bids/:id/tech-review` — Tech review action (approve/revision)
- [ ] `PUT /bids/:id/ceo-decision` — CEO decision (select/decline)
- [ ] `PUT /bids/:id/counter-offer` — Counter-offer modal

### Milestones (7 endpoints)
- [ ] `POST /milestones` — Create milestone form
- [ ] `GET /milestones` — List by engagement
- [ ] `GET /milestones/:id` — Milestone detail
- [ ] `PATCH /milestones/:id` — Edit milestone (DEFINED only)
- [ ] `DELETE /milestones/:id` — Delete milestone (DEFINED only)
- [ ] `PUT /milestones/:id/fund` — Fund milestone button
- [ ] `GET /milestones/:id/disputes` — Milestone disputes tab

### DoD (4 endpoints)
- [ ] `POST /milestones/:id/dod/items` — Add DoD item
- [ ] `PUT /milestones/:id/dod/:itemId` — Update DoD status
- [ ] `DELETE /milestones/:id/dod/:itemId` — Delete DoD item
- [ ] `GET /milestones/:id/dod` — DoD checklist display

### Criteria (5 endpoints)
- [ ] `GET /criteria/:milestoneId` — Criteria list
- [ ] `POST /criteria/:milestoneId` — Add criterion
- [ ] `DELETE /criteria/:id` — Delete criterion
- [ ] `PUT /criteria/:id/verify` — Verify button
- [ ] `PUT /criteria/:id/revision` — Reject with note

### Submissions (5 endpoints)
- [ ] `POST /milestones/:id/submit` — Submit deliverable form
- [ ] `POST /milestones/:id/paygated-docs` — Stage paygated doc
- [ ] `GET /milestones/:id/paygated-docs` — Download paygated doc
- [ ] `GET /milestones/:id/submissions` — Submission history
- [ ] `GET /milestones/:id/submissions/latest` — Latest submission

### Messages (6 endpoints)
- [ ] `GET /engagements/:id/messages` — Engagement chat
- [ ] `GET /projects/:id/messages` — Pre-bid Q&A
- [ ] `POST /messages/:id/read` — Mark as read (on scroll into view)
- [ ] `GET /engagements/:id/messages/unread-count` — Unread badge
- [ ] `GET /projects/:id/messages/unread-count` — Unread badge
- [ ] `GET /conversations` — Inbox sidebar

### Disputes (5 endpoints)
- [ ] `POST /disputes` — File dispute form
- [ ] `GET /disputes` — Disputes list
- [ ] `GET /disputes/:id` — Dispute detail
- [ ] `POST /disputes/:id/evidence` — Add evidence form
- [ ] `PUT /disputes/:id/withdraw` — Withdraw button

### Invitations (4 endpoints)
- [ ] `GET /invitations` — Expert invitations inbox
- [ ] `POST /invitations/:id/decline` — Decline button
- [ ] `GET /invitations/sent` — CEO sent invitations
- [ ] `DELETE /invitations/:id` — Retract button

### Reviews (5 endpoints)
- [ ] `POST /reviews` — Post-engagement review form
- [ ] `GET /reviews/:engagementId` — Engagement reviews
- [ ] `GET /reviews/users/:userId` — Public profile reviews
- [ ] `GET /reviews/me` — Reviews I wrote
- [ ] `GET /reviews/me/received` — Reviews I received

### Notifications (5 endpoints)
- [ ] `GET /notifications/me` — Notifications dropdown/page
- [ ] `GET /notifications/me/unread-count` — Nav badge
- [ ] `PUT /notifications/:id/read` — Mark one read
- [ ] `PUT /notifications/read-all` — Mark all read button
- [ ] `DELETE /notifications/:id` — Delete notification

### Admin — Oversight (18 endpoints)
- [ ] `PUT /admin/projects/:id/suspend-spec` — Admin suspend project
- [ ] `PUT /admin/users/:id/suspend` — Admin suspend user
- [ ] `GET /admin/disputes` — Admin disputes queue
- [ ] `PUT /admin/disputes/:id/resolve` — Admin resolve dispute
- [ ] `GET /admin/decisions` — Admin AI decisions log
- [ ] `GET /admin/transactions` — Admin wallet ledger
- [ ] `GET /admin/analytics` — Admin analytics dashboard
- [ ] `GET /admin/withdrawals` — Admin withdrawal queue
- [ ] `PUT /admin/withdrawals/:id/complete` — Admin confirm withdrawal
- [ ] `PUT /admin/withdrawals/:id/fail` — Admin fail withdrawal
- [ ] `GET /admin/users` — Admin user list
- [ ] `GET /admin/users/:id` — Admin user detail
- [ ] `PUT /admin/users/:id/reactivate` — Admin reactivate user
- [ ] `GET /admin/projects` — Admin project list
- [ ] `GET /admin/projects/:id` — Admin project detail
- [ ] `PUT /admin/projects/:id/reopen` — Admin reopen project
- [ ] `GET /admin/engagements` — Admin engagement list
- [ ] `GET /admin/experts` — Admin expert list

### Admin — Config CMS (5 resources × 4-5 endpoints = 22 endpoints)
- [ ] Domains: `GET/POST /admin/config/domains` · `PUT/DELETE /admin/config/domains/:id`
- [ ] Seams: `GET/POST /admin/config/seams` · `PUT/DELETE /admin/config/seams/:id`
- [ ] Archetypes: `GET/POST /admin/config/archetypes` · `PUT/DELETE /admin/config/archetypes/:id`
- [ ] Probe Questions: `GET/POST /admin/config/probe-questions` · `PUT/DELETE /admin/config/probe-questions/:id`
- [ ] Void Codes: `GET/POST /admin/config/void-codes` · `PUT/DELETE /admin/config/void-codes/:id`

### Admin — Subscription Packages (4 endpoints)
- [ ] `GET /admin/subscriptions/packages` — Admin package list
- [ ] `POST /admin/subscriptions/packages` — Create package form
- [ ] `PUT /admin/subscriptions/packages/:id` — Edit package
- [ ] `DELETE /admin/subscriptions/packages/:id` — Delete package

### Admin — Prompt Templates (4 endpoints)
- [ ] `GET /admin/prompts` — Prompt list
- [ ] `GET /admin/prompts/:stage` — Prompt editor (load)
- [ ] `PUT /admin/prompts/:stage` — Prompt editor (save)
- [ ] `DELETE /admin/prompts/:stage` — Reset to default button

### Internal (1 endpoint — no FE caller)
- [ ] `GET /internal/prompts/:stage` — **No FE caller** (FastAPI → NestJS only) ✓

---

## 28. Final Integration Notes

### 28.1 FE Tech Stack Assumptions
- React + TypeScript + Vite (per `docker-compose.yml` build args).
- State management: Zustand or Redux Toolkit (recommend Zustand for simplicity).
- Data fetching: TanStack Query (React Query) for cache + invalidation.
- WebSocket: `socket.io-client` v4.
- Forms: React Hook Form + Zod (mirror BE DTOs).
- BigInt handling: always `String()` → `Number()` explicitly.

### 28.2 Recommended FE Global State Shape

```typescript
interface AppState {
  // Auth
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  activeRole: string;

  // Subscription
  subscriptionTier: 'free' | 'pro';
  subscriptionExpires: string | null;

  // Config (from /config/all on mount)
  domains: DomainDefinition[];
  seams: SeamDefinition[];
  archetypes: ArchetypeDefinition[];
  voidCodes: VoidCodeDefinition[];
  subscriptionPackages: SubscriptionPackage[];

  // Realtime
  notifications: Notification[];
  unreadNotificationCount: number;
  socket: Socket | null;
}
```

### 28.3 Axios Interceptor Pattern

```typescript
// Request interceptor: attach JWT
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const { refreshToken } = useAuthStore.getState();
      const { data } = await axios.post('/auth/refresh', {}, {
        headers: { Authorization: `Bearer ${refreshToken}` }
      });
      useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
      error.config.headers.Authorization = `Bearer ${data.access_token}`;
      return apiClient(error.config);
    }
    return Promise.reject(error);
  }
);
```

### 28.4 WebSocket Connection Pattern

```typescript
const socket = io('http://localhost:3001', {
  auth: { token: accessToken },
  transports: ['websocket'],
});

socket.on('connect', () => console.log('WS connected'));
socket.on('notification:generic', (notif) => {
  toast.info(notif.title, { description: notif.body });
  queryClient.invalidateQueries(['notifications', 'unread-count']);
});
socket.on('message:received', (msg) => {
  queryClient.setQueryData(['messages', msg.engagementId], (old) => [...old, msg]);
});
socket.on('bid:update', ({ bidId, newState }) => {
  queryClient.invalidateQueries(['bids']);
});
socket.on('milestone:update', ({ milestoneId }) => {
  queryClient.invalidateQueries(['milestones']);
});
```

### 28.5 Anti-Rot Verification Command

Before any PR merge, the FE lead must verify:

```bash
# 1. Every BE endpoint in swagger.json has a FE API client function
grep -r "apiClient\.\(get\|post\|put\|patch\|delete\)" src/ | wc -l
# Should be >= 200 (213 endpoints - 4 webhooks - 1 internal - ~8 optional overlaps)

# 2. No FE call references an endpoint NOT in swagger.json
# (manual review of apiClient wrapper)

# 3. No hardcoded domain/seam codes
grep -rE "'[A-F]'" src/ --include="*.ts" --include="*.tsx"
# Should only appear in test files, never in production code

# 4. No hardcoded subscription prices
grep -rE "500000|300000" src/ --include="*.ts" --include="*.tsx"
# Should only appear in seed/test files

# 5. All BigInt fields handled with Number() conversion
grep -rE "priceVnd|amountVnd|balance" src/ --include="*.ts" --include="*.tsx" | grep -v "Number("
# Manual review: each should either be displayed as string or wrapped in Number()
```

---

**END OF DOCUMENT.**

This is the single source of truth. If any discrepancy arises between this doc and the BE codebase, **the codebase wins** — file an issue to update this doc. If any discrepancy arises between this doc and the swagger.json, **swagger.json wins** — file an issue to update this doc.

For the FE dev: read Sections 1, 26, 27 first. Then read the section for whatever feature you're building. Keep Section 27 as your PR checklist.