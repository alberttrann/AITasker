# AITasker — Backend ↔ Frontend Integration Reference
> **Scope:** All patches applied in this development cycle — Group A (bug fixes), B (auth), C (CMS), D (elicitation stages), E (milestones), F (admin dashboard), plus individual hotfixes.
> **Base URL:** `http://localhost:3001`
> **All authenticated endpoints require:** `Authorization: Bearer <access_token>`
> **BigInt note:** `priceVnd`, `amountPaidVnd`, `estimatedCostVnd`, and all VND fields are serialized as **strings** (e.g., `"500000"`). Parse with `Number()` or `BigInt()` — never arithmetic with raw string.
> **Error envelope:**
> ```json
> { "statusCode": 400, "message": "single string" | ["array","of","strings"], "error": "Bad Request" }
> ```
> DTO validation errors always return `message` as an **array**. Service-level errors return a **single string**.

---

## Table of Contents
1. [Auth & Onboarding](#1-auth--onboarding)
2. [Password Recovery](#2-password-recovery)
3. [Subscription Management](#3-subscription-management)
4. [Public Config / Reference Data](#4-public-config--reference-data)
5. [Elicitation Flow (CEO)](#5-elicitation-flow-ceo)
6. [Elicitation Flow (Tech Team Handoff)](#6-elicitation-flow-tech-team-handoff)
7. [Project & Milestone Management](#7-project--milestone-management)
8. [Milestone Chat Assistant](#8-milestone-chat-assistant)
9. [Expert Bid Flow](#9-expert-bid-flow)
10. [Tech Team Dashboard](#10-tech-team-dashboard)
11. [Admin Dashboard](#11-admin-dashboard)
12. [Real-time Notifications (WebSocket)](#12-real-time-notifications-websocket)
13. [Breaking Changes Cheatsheet](#13-breaking-changes-cheatsheet)

---

## 1. Auth & Onboarding

### 1.1 Register (CEO)

**`POST /auth/register`** · No auth required

**What changed:** Email is now normalized (trimmed + lowercased) before storage. Password errors return ALL failing rules at once, not one at a time.

#### Request
```json
{
  "email":         "Albert@Gmail.COM",
  "password":      "MyPass123!",
  "fullName":      "Albert Tran",
  "phone":         "0901234567",
  "roles":         "CLIENT_CEO",
  "selfTechnical": false
}
```
> `email` is normalized server-side. Sending `"  ALBERT@GMAIL.COM  "` stores and returns `"albert@gmail.com"`.

#### Response `201`
```json
{
  "access_token":  "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id":                      "uuid",
    "email":                   "albert@gmail.com",
    "fullName":                "Albert Tran",
    "activeRole":              "CLIENT",
    "clientSubtype":           "CEO",
    "subscriptionClientTier":  "free",
    "subscriptionExpertTier":  "free",
    "selfTechnical":           false
  }
}
```

#### Errors
| Status | `message` | When |
|--------|-----------|------|
| 400 | `["Password must be at least 8 characters.", "Password must contain at least one uppercase letter.", ...]` | Password rules violated — ALL failing rules returned simultaneously |
| 400 | `"Temporary or throwaway email addresses are not permitted."` | Disposable email (mailinator, tempmail, etc.) |
| 400 | `"Email domain does not exist or cannot receive mail."` | Fake domain with no MX records |
| 409 | `"Email already exist!"` | Duplicate email |

#### FE Notes
- Show password as a **checklist** (not a single error) — iterate the `message` array when `statusCode === 400`.
- After registering, store `access_token` and `refresh_token` in memory / secure storage.
- Display `user.email` (not the raw input) to confirm normalization.

---

### 1.2 Login

**`POST /auth/login`** · No auth required · *(Unchanged)*

#### Request
```json
{ "email": "albert@gmail.com", "password": "MyPass123!" }
```

#### Response `201`
```json
{
  "access_token":  "eyJ...",
  "refresh_token": "eyJ...",
  "user": { "id": "uuid", "email": "...", "activeRole": "CLIENT", "clientSubtype": "CEO", "subscriptionClientTier": "free", ... }
}
```

#### FE Notes
- Login email is **not** normalized server-side (login DTO has no `@Transform`). Always send lowercase email from the FE or the DB lookup will fail.

---

### 1.3 Register via Handoff Link (Tech Team)

**`POST /auth/register/handoff`** · No auth required

**What changed (bug fix):** `TechTeamProfile.linkedProjectId` is now set immediately if the CEO already has a published project. Previously it was always hardcoded `null`, leaving the tech team stuck on "Waiting for CEO" even for existing projects.

#### Request
```json
{
  "invite_token": "<token-from-invite-link>",
  "email":        "techteam@example.com",
  "password":     "SecurePass123!",
  "fullName":     "Dev Team Lead"
}
```

#### Response `201`
```json
{
  "access_token":  "eyJ...",
  "refresh_token": "eyJ...",
  "user": { "id": "uuid", "email": "...", "activeRole": "EXPERT" }
}
```

#### FE Notes
- After registration, `GET /projects` will now return the project immediately if one exists — no manual refresh needed.

---

### 1.4 Claim Handoff (Existing User)

**`POST /auth/claim-handoff`** · JWT required

**What changed (bug fix):** Same `linkedProjectId` fix as 1.3 — existing users who claim an invite are now linked to the CEO's project immediately.

#### Request
```json
{ "invite_token": "<token>" }
```

#### Response `201`
```json
{ "message": "Handoff claimed successfully.", "access_token": "eyJ..." }
```

---

## 2. Password Recovery

### 2.1 Request Password Reset

**`POST /auth/forgot-password`** · No auth required

#### Request
```json
{ "email": "albert@gmail.com" }
```

#### Response `201` — always the same regardless of whether the email exists (anti-enumeration)
```json
{ "message": "If an account with that email exists, a reset link has been sent." }
```

#### FE Notes
- Always show the generic message. **Never** display different UI for "email found" vs "email not found".
- The reset link sent in the email is: `${FRONTEND_URL}/reset-password/<token>`

---

### 2.2 Verify Reset Token (NEW)

**`GET /auth/verify-reset-token/:token`** · No auth required

Call this **on page load** of the reset-password page to check if the link is still valid before showing the form.

#### Request
```
GET /auth/verify-reset-token/a3f8c2d1e9b047...
```

#### Response `200`
```json
{ "valid": true }
```

#### Errors
| Status | `message` | When |
|--------|-----------|------|
| 400 | `"This password reset link is invalid or has expired. Please request a new one."` | Token not found or expired (1-hour TTL) |

#### FE Notes
- If `400` → show an error screen: "This link has expired." with a CTA to `/forgot-password`.
- If `200` → show the new password form.
- Never show the form before this call resolves.

---

### 2.3 Reset Password

**`POST /auth/reset-password`** · No auth required

#### Request
```json
{
  "token":       "a3f8c2d1e9b047...",
  "newPassword": "NewSecurePass456@"
}
```

#### Response `201`
```json
{ "message": "Password has been reset successfully. You can now log in." }
```

#### Errors
| Status | `message` | When |
|--------|-----------|------|
| 400 | `"This password reset link is invalid or has expired..."` | Token expired or already used |
| 400 | `["Password must be at least 8 characters.", ...]` | New password fails rules |

#### FE Notes
- Token is **one-time use** — consumed immediately on success.
- After `201`, redirect to `/login` with a success toast.
- Show the same password checklist UI as the registration page for `newPassword`.

---

## 3. Subscription Management

### 3.1 Get Subscription Status

**`GET /subscriptions/status`** · JWT required

**What changed (A-2 bug fix):** When the subscription is expired, the backend now returns `subscriptionTier: "free"` instead of the stale `"pro"` stored in the DB. The FE no longer needs to do its own date comparison.

#### Response `200`
```json
{
  "subscriptionTier":   "free",
  "subscriptionExpires": "2026-01-01T00:00:00.000Z",
  "isExpired":           true
}
```
> `subscriptionTier` is `"free"` or `"pro"`. If `isExpired: true`, treat user as free tier.

#### FE Notes
- **Remove all frontend date-math for subscription checks.** Trust `subscriptionTier` from this endpoint.
- Call on app load and after any subscription activation.

---

### 3.2 Get Available Subscription Packages (NEW)

**`GET /config/subscription-packages`** · No auth required · Optional query param: `?role=CLIENT` or `?role=EXPERT`

Call this **on mount** of the subscription activation page to fetch dynamic prices. Replace all hardcoded `500,000 VND` / `300,000 VND` constants.

#### Request
```
GET /config/subscription-packages?role=CLIENT
```

#### Response `200`
```json
[
  {
    "id":             "uuid-of-client-pro-package",
    "role":           "CLIENT",
    "name":           "Client Pro",
    "priceVnd":       "500000",
    "durationMonths": 6
  }
]
```

#### FE Notes
- Store the returned `id` as `packageId` — you'll need it for activation.
- Display `Number(pkg.priceVnd).toLocaleString('vi-VN')` for formatted price.
- Balance check: `Number(wallet.availableBalance) >= Number(pkg.priceVnd)`.

---

### 3.3 Activate Subscription

**`POST /subscriptions/activate`** · JWT required · Roles: `CLIENT`, `EXPERT`

**What changed (critical bug fix):** `packageId` is now **required** in the request body. Previously the backend silently picked the newest package regardless of what the user selected.

#### Request — CHANGED
```json
{
  "activeRole": "CLIENT",
  "packageId":  "uuid-of-client-pro-package"
}
```
> `packageId` comes from `GET /config/subscription-packages` (3.2 above).

#### Response `201`
```json
{
  "access_token": "eyJ...",
  "activatedPackage": {
    "name":           "Client Pro",
    "priceVnd":       "500000",
    "durationMonths": 6
  }
}
```

#### Errors
| Status | `message` | When |
|--------|-----------|------|
| 404 | `"Subscription package <id> not found."` | Invalid `packageId` |
| 422 | `"Package 'X' is no longer available."` | Package was deactivated by admin |
| 422 | `"Package 'X' is for CLIENT accounts but you are activating as EXPERT."` | Wrong role/package mismatch |
| 422 | `"INSUFFICIENT_BALANCE"` | Wallet balance < package price |
| 409 | `"Your subscription is still active."` | Already on Pro tier |
| 409 | `"You must switch to the target role before activating..."` | Active role mismatch |

#### FE Notes
- Refresh `GET /subscriptions/status` and JWT claims after activation.
- On `"INSUFFICIENT_BALANCE"`, show deposit CTA with the exact shortfall: `Number(pkg.priceVnd) - Number(wallet.availableBalance)`.

---

### 3.4 Subscription Purchase History (NEW)

**`GET /subscriptions/history`** · JWT required

#### Response `200`
```json
[
  {
    "id":            "uuid",
    "packageName":   "Client Pro",
    "role":          "CLIENT",
    "amountPaidVnd": "500000",
    "purchasedAt":   "2026-01-15T10:00:00.000Z",
    "expiresAt":     "2026-07-15T10:00:00.000Z",
    "paymentMethod": "WALLET",
    "isExpired":     false
  }
]
```

#### FE Notes
- Format dates in UTC+7: `new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', ... }).format(new Date(row.purchasedAt))`
- `isExpired` is pre-computed by the backend — use it directly for status badges.

---

## 4. Public Config / Reference Data

All endpoints in this section require **no authentication**. They are the authoritative source for all dropdown options that were previously hardcoded. Call these on component mount.

### 4.1 Domain Definitions

**`GET /config/domains`**

```json
[
  { "id": "uuid", "code": "A", "name": "LLM App Engineering",        "sortOrder": 1 },
  { "id": "uuid", "code": "B", "name": "MLOps/LLMOps",               "sortOrder": 2 },
  { "id": "uuid", "code": "C", "name": "AI Eval & Quality",           "sortOrder": 3 },
  { "id": "uuid", "code": "D", "name": "Vector DB & Embeddings",      "sortOrder": 4 },
  { "id": "uuid", "code": "E", "name": "Data & Pipeline Engineering", "sortOrder": 5 },
  { "id": "uuid", "code": "F", "name": "ML Modeling & Fine-Tuning",   "sortOrder": 6 }
]
```

**Used on:** Expert profile domain-depth form, Expert bid form

---

### 4.2 Seam Definitions

**`GET /config/seams`**

```json
[
  { "id": "uuid", "code": "A↔C", "name": "LLM output quality",         "sortOrder": 1 },
  { "id": "uuid", "code": "A↔D", "name": "Retrieval-generation",       "sortOrder": 3 }
]
```

**Used on:** Expert bid form (displaying project's required seams)

---

### 4.3 Archetype Definitions

**`GET /config/archetypes`**

```json
[
  { "id": "uuid", "code": "1", "name": "RAG/Search",             "description": "Chatbots, knowledge base Q&A...", "sortOrder": 1 },
  { "id": "uuid", "code": "2", "name": "Recommendation",         "description": "Product/content recommendation...", "sortOrder": 2 },
  { "id": "uuid", "code": "3", "name": "Classification",         "description": "Fraud detection, sentiment...",     "sortOrder": 3 },
  { "id": "uuid", "code": "4", "name": "Generation",             "description": "Content/code generation...",        "sortOrder": 4 },
  { "id": "uuid", "code": "5", "name": "Prediction/Forecasting", "description": "Churn, demand forecasting...",      "sortOrder": 5 },
  { "id": "uuid", "code": "6", "name": "Multimodal",             "description": "Vision+language, audio+text...",   "sortOrder": 6 }
]
```

**Used on:** Stage 2 archetype selection — replace hardcoded array with this API call.

---

### 4.4 Probe Questions for an Archetype

**`GET /config/archetypes/:code/probe-questions`**

```
GET /config/archetypes/1/probe-questions
```

```json
[
  { "id": "uuid", "archetypeCode": "1", "questionText": "Roughly how many people will search or ask questions per day?", "displayOrder": 1 },
  { "id": "uuid", "archetypeCode": "1", "questionText": "When someone gets a wrong or unhelpful answer, what do you expect to happen next?", "displayOrder": 2 },
  { "id": "uuid", "archetypeCode": "1", "questionText": "Does this need to pull from documents/systems you already have, and which ones?", "displayOrder": 3 },
  { "id": "uuid", "archetypeCode": "1", "questionText": "How quickly does an answer need to appear after someone asks?", "displayOrder": 4 }
]
```

**Used on:** Stage 3 — render the probe question form. Use `questionText` as both the form field label AND the key when submitting answers.

---

## 5. Elicitation Flow (CEO)

All elicitation endpoints require: **JWT · Role: `CLIENT` (CEO subtype)**

### 5.1 Create or Resume Session

**`POST /elicitation/sessions/start`** · *(Unchanged)*

#### Response `201`
```json
{
  "id":           "session-uuid",
  "userId":       "user-uuid",
  "currentStage": 1,
  "state":        "IN_PROGRESS",
  "stage1SymptomsJson":         null,
  "stage1OriginalInput":        null,
  "voidListJson":               null,
  "recommendedArchetypesJson":  null,
  "archetype":                  null,
  "stage3ProbesJson":           null,
  "stage4TechInputsJson":       null,
  "stage4DraftJson":            null,
  "estimatedBudgetVnd":         null
}
```

---

### 5.2 Get Session

**`GET /elicitation/sessions/:id`** · *(Shape updated with new fields)*

#### Response `200` — full session object
```json
{
  "id":           "session-uuid",
  "userId":       "user-uuid",
  "currentStage": 3,
  "state":        "IN_PROGRESS",
  "symptomTextDraft":           "User's last saved draft",
  "stage1OriginalInput":        "The raw text the user typed in Stage 1",
  "stage1SymptomsJson": [
    { "symptom": "No search functionality", "category": "UX", "severity": "HIGH" }
  ],
  "voidListJson": [
    { "code": "UNCLEAR_SUCCESS_METRIC", "description": "..." }
  ],
  "recommendedArchetypesJson": ["1", "3"],
  "archetype":           "1",
  "stage3ProbesJson":    null,
  "stage4TechInputsJson": null,
  "stage4DraftJson":     null,
  "estimatedBudgetVnd":  null,
  "project_id":          null,
  "projectId":           null,
  "gateResult":          null
}
```

**New fields to use:**
- `stage1OriginalInput` — show alongside AI output so CEO can see what the AI added vs what they wrote.
- `stage4DraftJson` — pre-fill Stage 4 form on revisit.
- `estimatedBudgetVnd` — display extracted budget if found by AI.
- `gateResult` — present when `state === "RETURNED"`. Contains `{ gate_passed: false, completeness_score, advisory_note, return_to_stage }`.

---

### 5.3 Stage 1 — Submit Symptoms

**`POST /elicitation/sessions/:id/stage1`**

#### Request
```json
{ "symptomText": "We need a RAG system for our customer support team. Budget around 50 million VND." }
```

#### Response `200` — updated session (now at `currentStage: 2`)
```json
{
  "currentStage": 2,
  "stage1OriginalInput": "We need a RAG system for our customer support team. Budget around 50 million VND.",
  "stage1SymptomsJson": [
    { "symptom": "No automated customer support",  "category": "OPERATIONAL", "severity": "HIGH" },
    { "symptom": "Manual knowledge base lookup",   "category": "EFFICIENCY",  "severity": "MEDIUM" }
  ],
  "recommendedArchetypesJson": ["1"],
  "estimatedBudgetVnd": "50000000"
}
```

#### FE Notes
- Display `stage1OriginalInput` and `stage1SymptomsJson` side-by-side: "What you wrote" vs "What the AI understood."
- If `estimatedBudgetVnd` is set, show it as a budget confirmation: "We detected a budget of X VND — is this correct?"

---

### 5.4 Stage 2 — Select Archetype

**`POST /elicitation/sessions/:id/stage2`**

**What changed:** Archetype options must be fetched from `GET /config/archetypes` — do not hardcode.

#### Request
```json
{
  "archetype":             "1",
  "acknowledgedVoidCodes": ["UNCLEAR_SUCCESS_METRIC"]
}
```

#### Response `200` — updated session at `currentStage: 3`

#### FE Notes
- Use `GET /config/archetypes` to build the selection UI.
- `recommendedArchetypesJson` from the session highlights AI-recommended options — show them with a badge.
- Only archetypes returned by `GET /config/archetypes` (active ones) should be selectable.

---

### 5.5 Stage 3 — Probe Questions

**`POST /elicitation/sessions/:id/stage3`**

**What changed:** Probe questions are now DB-driven. Fetch them from `GET /config/archetypes/:code/probe-questions` after Stage 2 completes.

#### Request — `probe_responses` keys must be the exact `questionText` strings
```json
{
  "probe_responses": {
    "Roughly how many people will search or ask questions per day?": "Around 500 support agents",
    "When someone gets a wrong or unhelpful answer, what do you expect to happen next?": "It escalates to a human agent",
    "Does this need to pull from documents/systems you already have, and which ones?": "Yes, Confluence and Zendesk",
    "How quickly does an answer need to appear after someone asks?": "Under 3 seconds"
  }
}
```

#### Response `200` — updated session at `currentStage: 4`
```json
{
  "currentStage": 4,
  "stage3ProbesJson": { "...question...": "...answer..." },
  "vaguenessResult": {
    "vague_answers": [
      {
        "question": "When someone gets a wrong answer...",
        "reason":   "Specify what 'escalate' means — to which team, via which tool?"
      }
    ]
  }
}
```

#### Errors
| Status | `message` | When |
|--------|-----------|------|
| 400 | `"All 4 probe questions must be answered. Missing: ..."` | Some questions unanswered |
| 400 | `"No probe questions configured for archetype X."` | Admin hasn't seeded questions (call admin) |

#### FE Notes
- Build the form dynamically using the `questionText` values from `GET /config/archetypes/1/probe-questions`.
- Use `questionText` as the form field key exactly — it becomes the request body key.
- If `vaguenessResult.vague_answers` is non-empty, show inline warnings but allow resubmission (Stage 3 doesn't block on vagueness).

---

### 5.6 Stage 4 — Auto-Save Draft (NEW)

**`PATCH /elicitation/sessions/:id/stage4-draft`** · No LLM call

Call this every 30 seconds or on field blur while the user fills out Stage 4. Preserves form state across page refreshes.

#### Request
```json
{
  "draftJson": {
    "current_stack":            "Python FastAPI + PostgreSQL",
    "data_available":           "6 months of Zendesk tickets",
    "latency_requirement":      "Under 3 seconds",
    "additional_requirement_1": "Must integrate with our SSO"
  }
}
```

#### Response `200`
```json
{ "saved": true }
```

#### FE Notes
- On page load, pre-fill Stage 4 form from `session.stage4DraftJson`.
- If `{ "saved": false, "reason": "stage_not_applicable" }`, the session isn't at Stage 4 yet — ignore silently.

---

### 5.7 Stage 4 — Submit Tech Context

**`POST /elicitation/sessions/:id/stage4`** · *(Shape updated)*

#### Request — NEW field `additional_requirement_1`
```json
{
  "current_stack":            "Python FastAPI + PostgreSQL + Pinecone",
  "data_available":           "6 months of Zendesk tickets, 200 Confluence pages",
  "latency_requirement":      "Under 3 seconds at P95",
  "additional_requirement_1": "Must work with our SSO and comply with SOC 2"
}
```

#### Response `200` — updated session at `currentStage: 5`

---

### 5.8 Stage 5 — Publish Project

**`POST /elicitation/sessions/:id/stage5`** · *(Bug fixed — now links TechTeam)*

No request body needed.

#### Response `201` — the new project
```json
{
  "id":           "project-uuid",
  "projectName":  "Customer Support RAG System",
  "state":        "PUBLISHED",
  "archetype":    "1",
  "tier":         "TIER_2",
  "artifact_a_json": { "project_name": "...", "sdlc_notices": [...], ... },
  "required_domains_json": [
    { "domain_code": "A", "required_depth": "INTERMEDIATE" }
  ],
  "required_seams_json": [
    { "seam_code": "A↔D", "criticality": "HIGH" }
  ],
  "milestone_framework_json": [
    {
      "milestone_number":       1,
      "deliverable_statement":  "RAG pipeline with Pinecone integration",
      "sign_off_authority":     "CEO",
      "payment_amount_vnd":     0,
      "estimated_cost_vnd":     25000000,
      "estimated_duration_days": 21
    }
  ],
  "estimatedTotalCostVnd":       "50000000",
  "estimatedTotalDurationDays":  42
}
```

#### FE Notes
- After publishing, redirect CEO to project dashboard.
- `milestone_framework_json` is advisory AI output. CEO edits the actual Milestone rows separately (see Section 7).
- TechTeam linked to this CEO will now see the project in their dashboard automatically.

---

## 6. Elicitation Flow (Tech Team Handoff)

### 6.1 Tech Team Stage 4 Handoff Submit

**`POST /elicitation/sessions/:id/stage4-handoff`** · JWT · Role: `EXPERT`

#### Request — NEW field `additional_requirement_1`
```json
{
  "current_stack":            "FastAPI + Weaviate + Redis",
  "data_available":           "Raw CSV exports from CRM, no structured pipeline yet",
  "latency_requirement":      "Batch processing acceptable, 30min refresh cycle",
  "additional_requirement_1": "Must stay within AWS us-east-1 region for compliance"
}
```

#### Response `200` — updated session

---

## 7. Project & Milestone Management

### 7.1 Get Project List

**`GET /projects`** · JWT · Roles: `CLIENT`, `EXPERT`

*(Unchanged shape — but TechTeam fix means Tech Team members now see projects here after linking)*

---

### 7.2 Get Project Detail

**`GET /projects/:id`** · JWT · Roles: `CLIENT`, `EXPERT`, `ADMIN`

**What changed:** Response now includes `required_domains_json`, `required_seams_json`, and `milestone_framework_json`. Previously these were missing, blocking the Expert's BidForm.

#### Response `200` — UPDATED SHAPE
```json
{
  "id":           "project-uuid",
  "state":        "PUBLISHED",
  "archetype":    "1",
  "tier":         "TIER_2",
  "projectName":  "Customer Support RAG System",
  "artifact_a_json": { ... },
  "required_domains_json": [
    { "domain_code": "A", "required_depth": "INTERMEDIATE" },
    { "domain_code": "D", "required_depth": "EXPERT" }
  ],
  "required_seams_json": [
    { "seam_code": "A↔D", "criticality": "HIGH" }
  ],
  "milestone_framework_json": [
    {
      "milestone_number":        1,
      "deliverable_statement":   "RAG pipeline setup",
      "sign_off_authority":      "CEO",
      "payment_amount_vnd":      0,
      "estimated_cost_vnd":      25000000,
      "estimated_duration_days": 21
    }
  ]
}
```

#### FE Notes
- Expert BidForm: use `required_domains_json` and `required_seams_json` to display project requirements.
- Milestone page: use `milestone_framework_json` as the AI blueprint. CEO then creates/edits actual Milestone rows from this.

---

### 7.3 Edit Milestone (NEW)

**`PATCH /milestones/:id`** · JWT · Role: `CLIENT` (CEO only) · Only while `state === "DEFINED"`

#### Request — all fields optional
```json
{
  "title":                  "Phase 1 — RAG Pipeline",
  "deliverable_statement":  "Working RAG pipeline with Pinecone, latency < 3s",
  "sign_off_authority":     "CEO",
  "payment_amount_vnd":     25000000,
  "estimated_duration_days": 21,
  "tech_stack":             ["Python", "FastAPI", "Pinecone", "OpenAI"]
}
```

#### Response `200` — updated Milestone
```json
{
  "id":                    "milestone-uuid",
  "milestoneNumber":       1,
  "title":                 "Phase 1 — RAG Pipeline",
  "deliverableStatement":  "Working RAG pipeline...",
  "signOffAuthority":      "CEO",
  "paymentAmountVnd":      "25000000",
  "estimatedDurationDays": 21,
  "techStackJson":         ["Python", "FastAPI", "Pinecone", "OpenAI"],
  "estimatedCostVnd":      "25000000",
  "state":                 "DEFINED",
  "updatedAt":             "2026-07-09T..."
}
```

#### Errors
| Status | `message` | When |
|--------|-----------|------|
| 403 | `"Only the project CEO can edit milestones."` | Non-CEO trying to edit |
| 422 | `"Cannot edit a milestone in state 'FUNDED'..."` | Milestone already funded |
| 404 | `"Milestone not found."` | Invalid ID |

---

### 7.4 Delete Milestone (NEW)

**`DELETE /milestones/:id`** · JWT · Role: `CLIENT` (CEO only) · Only while `state === "DEFINED"`

#### Response `200`
```json
{ "id": "milestone-uuid", "milestoneNumber": 1, "deliverableStatement": "..." }
```

#### Errors
| Status | `message` | When |
|--------|-----------|------|
| 422 | `"Cannot delete a milestone in state 'FUNDED'..."` | Milestone already funded |

---

## 8. Milestone Chat Assistant

### 8.1 Send a Message

**`POST /projects/:id/milestone-chat`** · JWT · Roles: `CLIENT`, `EXPERT`

Omit `chatSessionId` to start a new conversation. Include it to continue an existing one. History is server-side — the FE only needs to store `chatSessionId`.

#### Request — First message (new session)
```json
{ "message": "Why did the AI suggest 3 milestones instead of 2?" }
```

#### Request — Follow-up message (continue session)
```json
{
  "message":       "Can we reduce the cost for milestone 2?",
  "chatSessionId": "session-uuid"
}
```

#### Response `200`
```json
{
  "reply":        "The AI split it into 3 milestones because the RAG pipeline and the evaluation layer have different sign-off requirements...",
  "suggestedEdit": {
    "milestone_number": 2,
    "field":            "paymentAmountVnd",
    "suggested_value":  20000000,
    "reason":           "Evaluation layer is lighter scope than initial estimate"
  },
  "chatSessionId":  "session-uuid",
  "sessionTitle":   "Chat · 09/07/2026",
  "messageCount":   2
}
```

> `suggestedEdit` is `null` when the AI makes no edit suggestion. When present, offer a one-click "Apply" button that calls `PATCH /milestones/:id` with the suggested values.

---

### 8.2 List Chat Sessions

**`GET /projects/:id/milestone-chat/sessions`** · JWT · Roles: `CLIENT`, `EXPERT`

For the session sidebar / history panel.

#### Response `200`
```json
[
  {
    "id":           "session-uuid",
    "title":        "Chat · 09/07/2026",
    "messageCount": 6,
    "createdAt":    "2026-07-09T08:00:00.000Z",
    "updatedAt":    "2026-07-09T09:15:00.000Z"
  }
]
```

---

### 8.3 Get Session History

**`GET /projects/:id/milestone-chat/sessions/:sessionId`** · JWT

Restores a full conversation thread on page load or browser refresh.

#### Response `200`
```json
{
  "id":           "session-uuid",
  "title":        "Chat · 09/07/2026",
  "messagesJson": [
    { "role": "user",      "content": "Why 3 milestones?" },
    { "role": "assistant", "content": "The RAG pipeline and eval layer need..." },
    { "role": "user",      "content": "Can we reduce milestone 2?" },
    { "role": "assistant", "content": "Yes, here's a suggestion..." }
  ],
  "createdAt": "2026-07-09T08:00:00.000Z",
  "updatedAt": "2026-07-09T09:15:00.000Z"
}
```

#### FE Notes
- On chat page mount: call `GET /projects/:id/milestone-chat/sessions` to populate sidebar.
- On session click: call `GET /projects/:id/milestone-chat/sessions/:sessionId` to restore thread.
- Render `messagesJson` as a standard chat bubble list.
- Store only `chatSessionId` in component state — not the full history.

---

## 9. Expert Bid Flow

### 9.1 Get Project Requirements for Bid Form

The expert BidForm now has access to project domains and seams via `GET /projects/:id` (see 7.2). No separate call needed.

```
GET /projects/:id
→ use required_domains_json  (which domain expertise is required)
→ use required_seams_json    (which integration seams matter)
→ use artifact_a_json        (full project specification)
```

Previously these fields were missing, forcing the FE to hardcode or omit them. They are now always present in the project detail response.

---

### 9.2 Bid Notification (WebSocket — see Section 12)

When an expert submits a bid, both CEO and all linked Tech Team members now receive real-time notifications.

---

## 10. Tech Team Dashboard

### 10.1 Get Projects

**`GET /projects`** · JWT · Role: `EXPERT`

**What changed (A-1 + auth service bug fix):** Tech Team members now see their project immediately after:
- Registering via handoff link when a project already exists (`registerHandoff` fix)
- Claiming an existing handoff invite (`claimHandoff` fix)
- CEO publishes the project after tech team registered (`processStage5` fix)

Previously, `GET /projects` returned `[]` in all these cases because `linkedProjectId` was always `null`.

#### FE Notes
- Remove any "Waiting for CEO" placeholder workarounds. The backend now correctly returns the project.
- If the array is still empty after all fixes are confirmed deployed, it means no project exists yet — "Waiting for CEO" is the correct state in that case only.

---

## 11. Admin Dashboard

All admin endpoints require: **JWT · Role: `ADMIN`**

### 11.1 Domain Definitions CRUD

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/admin/config/domains` | List all (active + inactive) |
| `POST` | `/admin/config/domains` | Create new domain |
| `PUT` | `/admin/config/domains/:id` | Update name, description, isActive, sortOrder |
| `DELETE` | `/admin/config/domains/:id` | Soft-delete (sets isActive=false) |

**POST/PUT request shape:**
```json
{
  "code":        "G",
  "name":        "Agentic Systems",
  "description": "Multi-agent orchestration and tool-use",
  "sortOrder":   7,
  "isActive":    true
}
```

---

### 11.2 Seam Definitions CRUD

| Method | Route |
|--------|-------|
| `GET` | `/admin/config/seams` |
| `POST` | `/admin/config/seams` |
| `PUT` | `/admin/config/seams/:id` |
| `DELETE` | `/admin/config/seams/:id` |

Same request shape as domains.

---

### 11.3 Archetype Definitions CRUD

| Method | Route |
|--------|-------|
| `GET` | `/admin/config/archetypes` |
| `POST` | `/admin/config/archetypes` |
| `PUT` | `/admin/config/archetypes/:id` |
| `DELETE` | `/admin/config/archetypes/:id` |

---

### 11.4 Probe Questions CRUD

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/admin/config/probe-questions?archetypeCode=1` | Filter by archetype |
| `POST` | `/admin/config/probe-questions` | |
| `PUT` | `/admin/config/probe-questions/:id` | |
| `DELETE` | `/admin/config/probe-questions/:id` | Soft-delete |

**POST request:**
```json
{
  "archetypeCode": "1",
  "questionText":  "How many concurrent users do you expect at peak?",
  "displayOrder":  5
}
```

**PUT request (partial):**
```json
{
  "questionText": "Updated question text",
  "displayOrder": 3,
  "isActive":     false
}
```

---

### 11.5 Subscription Package Management

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/admin/subscriptions/packages` | List ALL packages (active + inactive) |
| `POST` | `/admin/subscriptions/packages` | Create new package |
| `PUT` | `/admin/subscriptions/packages/:id` | Update price, duration, name, isActive |
| `DELETE` | `/admin/subscriptions/packages/:id` | Hard-delete (blocked if has purchase history) |

**Admin list response** (includes inactive — different from public endpoint):
```json
[
  {
    "id":             "uuid",
    "role":           "CLIENT",
    "name":           "Client Pro",
    "priceVnd":       "500000",
    "durationMonths": 6,
    "isActive":       true,
    "createdAt":      "2026-01-01T..."
  },
  {
    "id":             "uuid",
    "role":           "CLIENT",
    "name":           "Client Pro Yearly",
    "priceVnd":       "600000",
    "durationMonths": 12,
    "isActive":       false,
    "createdAt":      "2026-06-01T..."
  }
]
```

**POST request:**
```json
{
  "role":           "CLIENT",
  "name":           "Client Pro — Monthly",
  "priceVnd":       30000,
  "durationMonths": 1
}
```

**PUT request (partial — all fields optional):**
```json
{
  "priceVnd":       35000,
  "durationMonths": 1,
  "name":           "Client Pro — Monthly (Revised)",
  "isActive":       true
}
```

**DELETE error (blocked):**
```json
{
  "statusCode": 422,
  "message": "Cannot delete 'Client Pro' — it has 47 purchase record(s). Deactivate it instead (PUT ... with { isActive: false })."
}
```

#### FE Admin Notes
- **Activate/Deactivate:** Use `PUT` with `{ "isActive": false }` to hide a package without deleting purchase history.
- **Price change takes effect immediately** for new activations. Existing subscribers keep their purchased duration.
- **Public endpoint** (`GET /config/subscription-packages`) auto-filters to `isActive: true` — admin doesn't need to know about the FE; price changes are instant end-to-end.

---

## 12. Real-time Notifications (WebSocket)

### 12.1 Bid Submitted — Tech Team Notified (A-3 fix)

**What changed:** When an expert submits a bid, all Tech Team members linked to that project now receive a real-time notification. Previously, only the CEO was notified.

**Event name:** `notification:generic`

**Payload received by CEO:**
```json
{
  "type":  "bid_update",
  "title": "New Expert Bid!",
  "body":  "An expert has submitted a capability bid for your project.",
  "link":  "/ceo/projects/<project-id>"
}
```

**Payload received by each Tech Team member (NEW):**
```json
{
  "type":  "bid_update",
  "title": "New Bid Awaiting Review",
  "body":  "An expert has submitted a capability bid. Your technical review is required.",
  "link":  "/tech-team/projects/<project-id>"
}
```

#### FE Notes
- The `link` field tells you where to navigate on notification click.
- Subscribe to `notification:generic` in the WebSocket listener for both CEO and Tech Team dashboards.
- Show a badge/count on the nav icon when unread notifications arrive.

---

## 13. Breaking Changes Cheatsheet

If you have existing frontend code, these are the exact things to update. Nothing else should regress.

| # | What changed | Old FE behavior | Required FE change |
|---|---|---|---|
| 1 | `POST /subscriptions/activate` | Body: `{ activeRole }` | Body: `{ activeRole, packageId }` — get `packageId` from `GET /config/subscription-packages` first |
| 2 | `GET /subscriptions/status` | FE computed `isExpired = expiresAt < now()` | Remove FE date math — trust `subscriptionTier` from API directly |
| 3 | `POST /auth/register` password errors | Single error message string | `message` is now an **array** — iterate it to show checklist |
| 4 | Stage 2 archetype list | Hardcoded `['1','2','3','4','5','6']` array | Fetch from `GET /config/archetypes` on mount |
| 5 | Stage 3 probe questions | Hardcoded question strings in component | Fetch from `GET /config/archetypes/:code/probe-questions` after Stage 2 |
| 6 | `GET /projects/:id` | No `required_domains_json` / `required_seams_json` | Fields now present — use them for Expert BidForm |
| 7 | Subscription prices on activate page | Hardcoded `500,000 VND` / `300,000 VND` | Fetch from `GET /config/subscription-packages?role=CLIENT` on mount |
| 8 | Tech Team dashboard empty state | Always showed "Waiting for CEO" | Only show "Waiting for CEO" when `GET /projects` returns `[]` — projects now appear correctly |
| 9 | Password reset flow | Only `forgot` + `reset` endpoints | Add `GET /auth/verify-reset-token/:token` check on reset page load |
| 10 | Milestone chat | Not implemented | Three new endpoints (8.1, 8.2, 8.3) — server owns history, FE only stores `chatSessionId` |

---

## Quick Reference — All New Endpoints

```
# Auth
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/verify-reset-token/:token

# Public Config (no auth)
GET    /config/domains
GET    /config/seams
GET    /config/archetypes
GET    /config/archetypes/:code/probe-questions
GET    /config/subscription-packages

# Subscriptions
GET    /subscriptions/history

# Elicitation
PATCH  /elicitation/sessions/:id/stage4-draft

# Milestones
PATCH  /milestones/:id
DELETE /milestones/:id

# Milestone Chat
POST   /projects/:id/milestone-chat
GET    /projects/:id/milestone-chat/sessions
GET    /projects/:id/milestone-chat/sessions/:sessionId

# Admin Config CMS
GET    /admin/config/domains
POST   /admin/config/domains
PUT    /admin/config/domains/:id
DELETE /admin/config/domains/:id
GET    /admin/config/seams
POST   /admin/config/seams
PUT    /admin/config/seams/:id
DELETE /admin/config/seams/:id
GET    /admin/config/archetypes
POST   /admin/config/archetypes
PUT    /admin/config/archetypes/:id
DELETE /admin/config/archetypes/:id
GET    /admin/config/probe-questions
POST   /admin/config/probe-questions
PUT    /admin/config/probe-questions/:id
DELETE /admin/config/probe-questions/:id

# Admin Subscriptions
GET    /admin/subscriptions/packages
POST   /admin/subscriptions/packages
PUT    /admin/subscriptions/packages/:id
DELETE /admin/subscriptions/packages/:id
```
