# MASTER INTEGRATION DOC — File 2: Main Flow 2 (Expert Journey)

> **Source of Truth**: Every API contract, UI mockup, and interaction flow for MF-2 lives here.  
> **Audience**: Khang, Minh, Minh Thức — backend devs tasked with FE integration tonight.  
> **If you have any question about what a button does, what an endpoint returns, or how to mock data — answer is in this file first.**  
> **Base URL**: `http://localhost:3001`  
> **Auth**: `Authorization: Bearer <access_token>`

---

## FILE STATUS: What's Already Built vs Empty

| File | Status | What It Does |
|------|--------|--------------|
| `features/expert/ExpertDashboard.tsx` | ✅ Built (3.7KB) | Dashboard shell + subscription banner |
| `features/expert/onboarding/SubscriptionActivate.tsx` | ✅ Built (11.4KB) | Expert Pro activation |
| `features/expert/wallet/ExpertWallet.tsx` | ✅ Built (9.8KB) | Wallet overview + bank status |
| `features/expert/wallet/BankHubLink.tsx` | ✅ Built (2KB) | Bank account linking form |
| `features/expert/profile/DomainDepthGrid.tsx` | 🔴 EMPTY | **NEEDS BUILDING** |
| `features/expert/profile/SeamClaimsGrid.tsx` | 🔴 EMPTY | **NEEDS BUILDING** |
| `features/expert/profile/ProfileBuilder.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — parent shell |
| `features/expert/profile/StackTagsPicker.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — sub-component |
| `features/expert/verification/PortfolioSubmitForm.tsx` | 🔴 EMPTY | **NEEDS BUILDING** |
| `features/expert/verification/Tier2Success.tsx` | 🔴 EMPTY | **NEEDS BUILDING** |
| `features/expert/verification/Tier2Rejected.tsx` | 🔴 EMPTY | **NEEDS BUILDING** |
| `features/expert/verification/VerificationLockout.tsx` | 🔴 EMPTY | **NEEDS BUILDING** |
| `features/ceo/auth/CeoRegister.tsx` | 🔴 EMPTY | Register form (CEO path) |
| `features/expert/auth/ExpertRegister.tsx` | 🔴 EMPTY | Register form (Expert path) |
| `features/tech-team/stage4/Stage4Form.tsx` | 🔴 EMPTY | **NEEDS BUILDING** |
| `features/tech-team/stage4/Stage4Submitted.tsx` | 🔴 EMPTY | **NEEDS BUILDING** |

---

---

# PHASE A & B: Expert Profile Building (Tier 1 — CLAIMED)

---

## SCREEN 1: Expert Dashboard (Free Tier)

### Status: ✅ Already Built — NO WORK NEEDED

**File**: `features/expert/ExpertDashboard.tsx`  
**Route**: `/expert`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOPNAV: [Logo]           Wallet: 0 VND    [👤 Expert Name] [⚙️]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ✨  Upgrade to Expert Pro                                      ││
│  │  Unlock portfolio verification, bid on projects, and earn.      ││
│  │                                            [Upgrade now]  ───┐  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │              Expert Dashboard — In Development                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## SCREEN 2: Profile Builder — Shell (Settings Page)

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh Thức)

**File**: `features/expert/profile/ProfileBuilder.tsx`

This is the PARENT SHELL that contains DomainDepths, SeamClaims, and StackTags. Think of it like a tabbed form or a vertical wizard.

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                                │
│                                                                     │
│  ┌─ Profile Builder ─────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  ┌─ Completion Tabs ────────────────────────────────────────┐ │ │
│  │  │  [1. Domains ✓]  [2. Seams ○]  [3. Tags ○]  [4. Review ○]│ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  ┌─ Current Tab Content ────────────────────────────────────┐ │ │
│  │  │                                                           │ │ │
│  │  │  {activeTab === 'domains' && <DomainDepthGrid />}        │ │ │
│  │  │  {activeTab === 'seams'   && <SeamClaimsGrid />}         │ │ │
│  │  │  {activeTab === 'tags'    && <StackTagsPicker />}         │ │ │
│  │  │  {activeTab === 'review'  && <ProfileReview />}          │ │ │
│  │  │                                                           │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  [  ← Previous Tab  ]    [  Next Tab →  ]                     │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What This Component Does
1. Manages `activeTab` state: 'domains' | 'seams' | 'tags' | 'review'
2. Renders the appropriate child component for each tab
3. Has Next/Previous navigation between tabs
4. On "Review" tab: shows summary of all selected domains, seams, tags

### No API Calls in This File — Just State Management
```ts
const [activeTab, setActiveTab] = useState<'domains'|'seams'|'tags'|'review'>('domains');
const [selectedDomains, setSelectedDomains] = useState<any[]>([]);
const [selectedSeams, setSelectedSeams] = useState<any[]>([]);
const [stackTags, setStackTags] = useState<string[]>([]);
const [engagementModel, setEngagementModel] = useState<string>('MILESTONE');
```

### Props passed to children:
```ts
// DomainDepthGrid
{ onSave: (domains: any[]) => void, initialDomains?: any[] }

// SeamClaimsGrid
{ onSave: (seams: any[]) => void, initialSeams?: any[] }

// StackTagsPicker
{ onSave: (tags: string[], model: string) => void, initialTags?: string[], initialModel?: string }
```

---

## SCREEN 3: Domain Depths Grid

### Status: 🔴 EMPTY — NEEDS BUILDING (Khang)

**File**: `features/expert/profile/DomainDepthGrid.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Step 1 of 4: Set Your Domain Expertise                            │
│                                                                     │
│  For each AI capability domain, select how deep your expertise is: │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  Domain          │  SURFACE    OPERATIONAL   DEEP              │ │
│  │  ────────────────┼─────────────────────────────────────────── │ │
│  │  ◎ A  LLM App    │    ○           ●            ○              │ │
│  │    Engineering   │  "Used in      "Regular     "Can architect │ │
│  │                  │   projects"    primary use"  & teach"       │ │
│  │  ────────────────┼─────────────────────────────────────────── │ │
│  │  ○ B  MLOps/     │    ○           ●            ○              │ │
│  │    LLMOps        │                                            │ │
│  │  ────────────────┼─────────────────────────────────────────── │ │
│  │  ○ C  AI Eval &  │    ●           ○            ○              │ │
│  │    Quality       │                                            │ │
│  │  ────────────────┼─────────────────────────────────────────── │ │
│  │  ◎ D  Vector DB  │    ○           ○            ●              │ │
│  │    & Embeddings  │                                            │ │
│  │  ────────────────┼─────────────────────────────────────────── │ │
│  │  ○ E  Data &     │    ●           ○            ○              │ │
│  │    Pipeline      │                                            │ │
│  │  ────────────────┼─────────────────────────────────────────── │ │
│  │  ○ F  ML Model-  │    ●           ○            ○              │ │
│  │    ing & FT      │                                            │ │
│  │  ────────────────┴─────────────────────────────────────────── │ │
│  │                                                                │ │
│  │  ◎ = Requires at least one domain at DEEP or OPERATIONAL      │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [  ← Back  ]                            [  Save & Continue  →  ]  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Domain Data (HARDCODE)
```ts
const DOMAINS = [
  { code: "A", label: "LLM App Engineering",   hint: "System prompt design, RAG orchestration, chain-of-thought" },
  { code: "B", label: "MLOps / LLMOps",         hint: "Model serving, cost optimization, deployment pipelines" },
  { code: "C", label: "AI Evaluation & Quality", hint: "Metric design, ground truth creation, benchmarking" },
  { code: "D", label: "Vector DB & Embeddings", hint: "HNSW indexing, chunking strategy, similarity tuning" },
  { code: "E", label: "Data & Pipeline Eng",    hint: "Kafka, async processing, legacy ETL, high-volume ingestion" },
  { code: "F", label: "ML Modeling & FT",       hint: "Cross-encoders, SFT, imbalanced data, feature engineering" },
];

const DEPTHS = [
  { value: "SURFACE",     label: "Surface",     desc: "Used in projects but not primary" },
  { value: "OPERATIONAL", label: "Operational",  desc: "Regular primary usage" },
  { value: "DEEP",        label: "Deep",         desc: "Can architect and teach" },
];
```

### API to Call (MULTIPLE CALLS — one per domain with a depth selected)
```
POST /expert-profile/domains
Headers: Authorization: Bearer <token>
Body: { "domainCode": "A", "depthLevel": "DEEP" }
```

**Returns**:
```json
{
  "id": "uuid",
  "expertId": "uuid",
  "domainCode": "A",
  "depthLevel": "DEEP",
  "verificationTier": "CLAIMED"
}
```

### What to Do
1. Render 6 rows × 3 radio buttons (SURFACE / OPERATIONAL / DEEP)
2. User selects depth for some/all domains
3. Click "Save & Continue" → for each domain with a non-null depth: POST /expert-profile/domains
4. Call `onSave(selectedDomains)` with the saved data
5. Parent (ProfileBuilder) advances to next tab

### Important: Only POST for domains the user explicitly set a depth for. Domains left unselected = no API call.

### Mock Strategy
```ts
// Mock each POST response:
const mockResponse = (domainCode: string, depthLevel: string) => ({
  id: `mock-domain-${domainCode}-${Date.now()}`,
  expertId: "mock-expert-id",
  domainCode,
  depthLevel,
  verificationTier: "CLAIMED",
});
```
For testing, use `Promise.all()` to send all domain POSTs and collect results.

---

## SCREEN 4: Seam Claims Grid

### Status: 🔴 EMPTY — NEEDS BUILDING (Khang)

**File**: `features/expert/profile/SeamClaimsGrid.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Step 2 of 4: Claim Your Cross-Domain Expertise (Seams)            │
│                                                                     │
│  Seams are the boundaries between domains where failures happen.   │
│  Check all boundaries you have real experience troubleshooting:    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  ☐  A↔C   Ground truth-driven iteration                      │ │
│  │         Expert fine-tunes prompts with baseline — can tell   │ │
│  │         if changes help or hurt                               │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  A↔F   Hybrid routing                                     │ │
│  │         Know when to use LLM vs classifier — cost/accuracy   │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  A↔D   Retrieval-generation contract                      │ │
│  │         Retrieved chunks semantically right, structurally OK │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  D↔E   Distributed vector upsert safety                   │ │
│  │         Two workers writing same embedding — no corruption   │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  D↔F   Embedding/index co-design                          │ │
│  │         Fine-tuned model changes embedding — index adapts    │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  C↔F   Fine-tuning gating                                 │ │
│  │         FT only after baseline established — no blind FT     │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  E↔F   Training data as pipeline problem                  │ │
│  │         Model trained on clean, deployed against dirty — OK  │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  A↔B   Prompt iteration under production constraints      │ │
│  │         Prompts tested under real latency/cost constraints   │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  B↔E   Cost management in streaming pipelines             │ │
│  │         Every Kafka msg ≠ LLM call — cost stays flat         │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │  ☐  C↔E   Evaluation data as pipeline concern                │ │
│  │         Ground truth refreshed when pipeline schema changes  │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Selected: 3 seams                                                  │
│                                                                     │
│  [  ← Back  ]                            [  Save & Continue  →  ]  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Seam Data (HARDCODE)
```ts
const SEAMS = [
  { code: "A↔C", label: "Ground truth-driven iteration",     desc: "Fine-tune prompts with baseline — can tell if changes help or hurt" },
  { code: "A↔F", label: "Hybrid routing",                     desc: "Know when to use LLM vs classifier — cost/accuracy balance" },
  { code: "A↔D", label: "Retrieval-generation contract",      desc: "Retrieved chunks semantically right, structurally correct" },
  { code: "D↔E", label: "Distributed vector upsert safety",   desc: "Two workers writing same embedding — prevent index corruption" },
  { code: "D↔F", label: "Embedding/index co-design",          desc: "Fine-tuned model changes embedding space — index adapts" },
  { code: "C↔F", label: "Fine-tuning gating",                 desc: "FT only after baseline established — no blind fine-tuning" },
  { code: "E↔F", label: "Training data as pipeline problem",  desc: "Model trained on clean, deployed against dirty pipeline" },
  { code: "A↔B", label: "Prompt iteration under constraints",  desc: "Prompts tested under real latency/cost constraints" },
  { code: "B↔E", label: "Cost management in pipelines",       desc: "Every Kafka msg ≠ LLM call — cost stays flat" },
  { code: "C↔E", label: "Evaluation data as pipeline",        desc: "Ground truth refreshed when pipeline schema changes" },
];
```

### API to Call (ONE CALL PER SELECTED SEAM)
```
POST /expert-profile/seams
Headers: Authorization: Bearer <token>
Body: { "seamCode": "A↔C" }
```

**Returns**:
```json
{
  "id": "uuid",
  "expertId": "uuid",
  "seamCode": "A↔C",
  "verificationTier": "CLAIMED",
  "submissionCount": 0,
  "lockedUntil": null
}
```

### ⚠️ CRITICAL — Arrow Encoding
The seam code uses Unicode `↔` (U+2194). **Copy-paste the seam codes from this file into your code.** If the arrow arrives as garbage on the backend, your request WILL FAIL.

### What to Do
1. Render 10 checkboxes with seam names + descriptions
2. User checks 2-5 seams they want to claim
3. Click "Save & Continue" → for each checked seam: POST /expert-profile/seams
4. Call `onSave(selectedSeams)` with saved data

### Mock Strategy
```ts
const mockResponse = (seamCode: string) => ({
  id: `mock-seam-${seamCode.replace('↔','-')}-${Date.now()}`,
  expertId: "mock-expert-id",
  seamCode,
  verificationTier: "CLAIMED",
  submissionCount: 0,
  lockedUntil: null,
});
```

---

## SCREEN 5: Stack Tags & Engagement Model

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh Thức)

**File**: `features/expert/profile/StackTagsPicker.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Step 3 of 4: Tech Stack & Work Style                              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  Tech Stack Tags                                              │ │
│  │  ┌──────────────────────────────────────┐  [+ Add Tag]        │ │
│  │  │ Type a technology and press Enter... │                      │ │
│  │  └──────────────────────────────────────┘                      │ │
│  │                                                                │ │
│  │  [Python ×] [Kafka ×] [Go ×] [Langchain ×] [PostgreSQL ×]    │ │
│  │                                                                │ │
│  │  Suggested: React  Next.js  Docker  Redis  TensorFlow  PyTorch │ │
│  │  ───────────────────────────────────────────────────────────── │ │
│  │                                                                │ │
│  │  Engagement Model (How do you prefer to work?)                │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────┐     │ │
│  │  │  ●  Milestone-based                                 │     │ │
│  │  │     Fixed-price per milestone, clear deliverables    │     │ │
│  │  │     ─────────────────────────────────────────────────│     │ │
│  │  │  ○  Hourly                                         │     │ │
│  │  │     Bill by the hour, flexible scope                │     │ │
│  │  │     ─────────────────────────────────────────────────│     │ │
│  │  │  ○  Hybrid                                          │     │ │
│  │  │     Mix of milestone + hourly for discovery phases  │     │ │
│  │  └──────────────────────────────────────────────────────┘     │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  [  ← Back  ]                            [  Save & Continue  →  ]  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call
```
PUT /expert-profile/me
Headers: Authorization: Bearer <token>
Body: {
  "engagementModel": "MILESTONE",
  "stackTagsJson": ["Python", "Kafka", "Go", "Langchain"],
  "archetypeHistoryJson": []
}
```
**Returns**: `{ userId, engagementModel, stackTagsJson, archetypeHistoryJson }`

### What to Do
1. Tag input: type + Enter to add, × button to remove
2. Show suggestion chips below (click to add)
3. Engagement model: radio button group (3 options)
4. Click "Save & Continue" → PUT /expert-profile/me
5. Call `onSave(tags, engagementModel)`

### Mock Strategy
```ts
const mockResponse = {
  userId: "mock-user-id",
  engagementModel: "MILESTONE",
  stackTagsJson: ["Python", "Kafka", "Go"],
  archetypeHistoryJson: [],
};
```

---

## SCREEN 6: Profile Review Tab

### Status: 🔴 Needs Building (inside ProfileBuilder — part of Minh Thức's work)

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Step 4 of 4: Review Your Profile                                  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  📊  Domain Expertise                                         │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  A: LLM App Engineering    • DEEP          Tier 1 ✓      │ │ │
│  │  │  C: AI Evaluation          • OPERATIONAL   Tier 1 ✓      │ │ │
│  │  │  D: Vector DB              • SURFACE       Tier 1 ✓      │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  🔗  Seam Claims                                              │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  A↔C  Ground truth-driven iteration         Tier 1 ✓     │ │ │
│  │  │  A↔D  Retrieval-generation contract         Tier 1 ✓     │ │ │
│  │  │  D↔E  Distributed vector upsert safety      Tier 1 ✓     │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  🏷️  Tech Stack                                              │ │
│  │  [Python] [Kafka] [Go] [Langchain] [PostgreSQL]              │ │
│  │                                                                │ │
│  │  💼  Work Style: Milestone-based                              │ │
│  │                                                                │ │
│  │  ──────────────────────────────────────────────────────────── │ │
│  │                                                                │ │
│  │  🟡  Your profile is at Tier 1 (Claimed).                     │ │
│  │      Upgrade to Expert Pro and submit portfolio evidence      │ │
│  │      to reach Tier 2 (Evidence-Backed).                        │ │
│  │                                                                │ │
│  │  [  ← Edit Profile  ]    [  ✅  Publish Profile  ]            │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call (to fetch current state)
```
GET /expert-profile/me
Headers: Authorization: Bearer <token>
```
**Returns**: `{ user, profile, domainDepths: [...], seamClaims: [...] }`

### What to Do
1. Fetch GET /expert-profile/me
2. Display domain depths, seam claims, stack tags, engagement model
3. Show Tier 1 badge
4. "Publish Profile" → calls PUT /expert-profile/me with all data (already saved from previous steps)
5. Shows success toast + navigates to dashboard

---

---

# PHASE C: Expert Pro + Tier 2 Verification

---

## SCREEN 7: Expert Pro Activation

### Status: ✅ Already Built — NO WORK NEEDED

**File**: `features/expert/onboarding/SubscriptionActivate.tsx`  
**Route**: `/expert/subscription`

### Same flow as CEO but:
- Price: 300,000 VND (not 500,000)
- `activeRole`: "EXPERT" (not "CLIENT")
- After activation: JWT gets `subscriptionExpertTier: "pro"`

---

## SCREEN 8: Portfolio Submission Form

### Status: 🔴 EMPTY — NEEDS BUILDING (Khang)

**File**: `features/expert/verification/PortfolioSubmitForm.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Profile                                                  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  Upgrade Seam to Tier 2: Evidence-Backed                     │ │
│  │                                                                │ │
│  │  ┌─ Select Seam ──────────────────────────────────────────┐  │ │
│  │  │  Select which seam to submit evidence for:              │  │ │
│  │  │                                                          │  │ │
│  │  │  ┌─────────────────────────────────────────────────┐    │  │ │
│  │  │  │  ▼  A↔C Ground truth-driven iteration (Tier 1)  │    │  │ │
│  │  │  └─────────────────────────────────────────────────┘    │  │ │
│  │  │                                                          │  │ │
│  │  │  Available seams (Tier 1 only):                          │  │ │
│  │  │  • A↔D Retrieval-generation contract                     │  │ │
│  │  │  • D↔E Distributed vector upsert safety                  │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  ┌─ Project Description ───────────────────────────────────┐  │ │
│  │  │  Describe a real project where you demonstrated this    │  │ │
│  │  │  seam expertise:                                        │  │ │
│  │  │  ┌──────────────────────────────────────────────────┐   │  │ │
│  │  │  │ "Built a production RAG pipeline for a 500-lawyer│   │  │ │
│  │  │  │  law firm. Implemented chunking strategy with    │   │  │ │
│  │  │  │  overlap windows, evaluated retrieval quality    │   │ │ │
│  │  │  │  using BERTScore and ROUGE, tuned embedding      │   │ │ │
│  │  │  │  dimensions for legal domain terminology..."     │   │ │ │
│  │  │  │                                                  │   │ │ │
│  │  │  │  Minimum 50 characters                            │   │ │ │
│  │  │  └──────────────────────────────────────────────────┘   │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  ┌─ Decision Points ──────────────────────────────────────┐  │ │
│  │  │  Describe the technical decisions you made:             │  │ │
│  │  │  ┌──────────────────────────────────────────────────┐   │  │ │
│  │  │  │ "Evaluated BERTScore vs ROUGE for output quality │   │  │ │
│  │  │  │  measurement; chose BERTScore because it captures│   │  │ │
│  │  │  │  semantic similarity better for legal text. Also │   │  │ │
│  │  │  │  decided on HNSW index with cosine similarity    │   │  │ │
│  │  │  │  over IVF for latency requirements..."          │   │  │ │
│  │  │  │                                                  │   │  │ │
│  │  │  │  Minimum 20 characters                            │   │ │ │
│  │  │  └──────────────────────────────────────────────────┘   │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  ⚠️  You have 4 attempts remaining before 30-day lockout     │ │
│  │                                                                │ │
│  │  [  Cancel  ]              [  Submit for AI Evaluation  →  ]  │ │
│  │                                                                │ │
│  │  ─────── After submitting (loading) ───────                   │ │
│  │                                                                │ │
│  │  ⏳  Evaluating your portfolio evidence with AI...             │ │
│  │  This takes 10–30 seconds. Please wait.                       │ │
│  │  [████████████████████████░░░░░░░░] 70%                        │ │
│  │                                                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 1: Fetch Available Seams
```
GET /expert-profile/me
Headers: Authorization: Bearer <token>
```
From response, filter `seamClaims` where `verificationTier === "CLAIMED"` && `lockedUntil === null || lockedUntil < now`. These are the eligible seams for Tier 2 upgrade.

### Step 2: Submit Portfolio
```
POST /portfolio-submissions
Headers: Authorization: Bearer <pro-expert-token>
Body: {
  "seamClaimId": "uuid-from-step-1",
  "projectDescription": "Built a production RAG pipeline...",
  "decisionPoints": "Evaluated BERTScore vs ROUGE..."
}
```

**Returns** (after 10-30s):
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "llmConfidence": 0.91,
  "evaluationTierUpgraded": true,
  "advisoryNote": null,
  "evaluatedAt": "2026-06-26T10:30:00Z"
}
```

OR rejected:
```json
{
  "id": "uuid",
  "status": "REJECTED",
  "llmConfidence": 0.62,
  "evaluationTierUpgraded": false,
  "advisoryNote": "Missing specific decision rationale. Include details about why you chose one approach over another.",
  "evaluatedAt": "2026-06-26T10:30:30Z"
}
```

### What to Do
1. Fetch seams from GET /expert-profile/me
2. Populate dropdown with eligible Tier 1 seams
3. User fills projectDescription (min 50 chars) and decisionPoints (min 20 chars)
4. Click Submit → POST → show loading (10-30s)
5. On APPROVED: show `<Tier2Success />` 
6. On REJECTED: show `<Tier2Rejected />`
7. On 429 (TOO_MANY_ATTEMPTS): show `<VerificationLockout />`

### Error Cases
| HTTP | Code | Action |
|------|------|--------|
| 403 | SubscriptionGuard | "Expert Pro required. Please activate first." → link to /expert/subscription |
| 404 | "Seam claim not found" | Show error |
| 422 | "ALREADY_VERIFIED_OR_HIGHER" | "Already verified at a higher tier." |
| 429 | "TOO_MANY_ATTEMPTS" + lockedUntil | Show VerificationLockout |
| 503 | LLM unavailable | "Service temporarily unavailable. Try again." |

### Mock Strategy
```ts
// Simulate approved:
const mockApproved = {
  id: "mock-submission-" + Date.now(),
  status: "APPROVED",
  llmConfidence: 0.91,
  evaluationTierUpgraded: true,
  advisoryNote: null,
  evaluatedAt: new Date().toISOString(),
};

// Simulate rejected:
const mockRejected = {
  id: "mock-submission-" + Date.now(),
  status: "REJECTED",
  llmConfidence: 0.62,
  evaluationTierUpgraded: false,
  advisoryNote: "Missing specific decision rationale. Include details about why you chose one approach over another.",
  evaluatedAt: new Date().toISOString(),
};

// Simulate lockout:
const mockLockedOut = {
  statusCode: 429,
  message: { code: "TOO_MANY_ATTEMPTS", lockedUntil: new Date(Date.now() + 30*24*60*60*1000).toISOString() },
};
```

---

## SCREEN 9: Tier 2 Success

### Status: 🔴 EMPTY — NEEDS BUILDING (Khang)

**File**: `features/expert/verification/Tier2Success.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │                       🎉                                       │ │
│  │                                                                │ │
│  │          Seam Upgraded to Tier 2!                              │ │
│  │                                                                │ │
│  │  A↔C is now Evidence-Backed                                    │ │
│  │                                                                │ │
│  │          ┌────────────────────────┐                            │ │
│  │          │   AI Confidence: 91%   │                            │ │
│  │          └────────────────────────┘                            │ │
│  │                                                                │ │
│  │  ✅  Your seam is now at Tier 2 — this carries a 0.55          │ │
│  │      confidence weight in the expert matching engine.          │ │
│  │                                                                │ │
│  │  📊  Your profile now:                                         │ │
│  │  ┌──────────────────────────────────────────────────────┐     │ │
│  │  │  Tier 2 Seams: 1  (A↔C)                              │     │ │
│  │  │  Tier 1 Seams: 2  (A↔D, D↔E)                        │     │ │
│  │  │  Matching Weight: Enhanced                           │     │ │
│  │  └──────────────────────────────────────────────────────┘     │ │
│  │                                                                │ │
│  │  [  Submit Another Seam  ]    [  Back to Profile  ]           │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Props
```ts
interface Tier2SuccessProps {
  seamCode: string;
  llmConfidence: number;
  onClose: () => void;
  onSubmitAnother: () => void;
}
```

---

## SCREEN 10: Tier 2 Rejected

### Status: 🔴 EMPTY — NEEDS BUILDING (Khang)

**File**: `features/expert/verification/Tier2Rejected.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │                       ❌                                       │ │
│  │                                                                │ │
│  │          Submission Not Approved                               │ │
│  │                                                                │ │
│  │          AI Confidence: 62% (threshold: 85%)                   │ │
│  │                                                                │ │
│  │  ┌─────────────────────────────────────────────────────────┐  │ │
│  │  │  💡  Advisory Note                                       │  │ │
│  │  │                                                           │  │ │
│  │  │  "Missing specific decision rationale. Include details   │  │ │
│  │  │   about why you chose one approach over another."        │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  │                                                                │ │
│  │  Attempts remaining: 4 of 5                                   │ │
│  │                                                                │ │
│  │  ⚠️  After 5 failed attempts, this seam will be locked       │ │
│  │      for 30 days.                                             │ │
│  │                                                                │ │
│  │  [  Try Again  ]    [  Back to Profile  ]                     │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Props
```ts
interface Tier2RejectedProps {
  seamCode: string;
  llmConfidence: number;
  advisoryNote: string;
  attemptsRemaining: number;
  onRetry: () => void;
  onClose: () => void;
}
```

---

## SCREEN 11: Verification Lockout

### Status: 🔴 EMPTY — NEEDS BUILDING (Khang)

**File**: `features/expert/verification/VerificationLockout.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │                       🔒                                       │ │
│  │                                                                │ │
│  │          Verification Locked                                  │ │
│  │                                                                │ │
│  │  You've reached the maximum 5 attempts for seam A↔C.          │ │
│  │                                                                │ │
│  │  Unlocks on: July 26, 2026 (30-day lockout)                   │ │
│  │                                                                │ │
│  │  You can still submit evidence for other seams.               │ │
│  │                                                                │ │
│  │  [  Back to Profile  ]                                        │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Props
```ts
interface VerificationLockoutProps {
  seamCode: string;
  lockedUntil: string;    // ISO date string
  onClose: () => void;
}
```

---

---

# PHASE D: Tech Team Stage 4 Handoff

---

## SCREEN 12: Tech Team — Stage 4 Form

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh Thức)

**File**: `features/tech-team/stage4/Stage4Form.tsx`

### Context
After a CEO generates a handoff link (MF-1, Stage 4 Scenario B), the Tech Team member clicks the link, registers via `POST /auth/register/handoff`, and then fills in this form. The `sessionId` is extracted from the invite JWT token payload.

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  TECH TEAM DASHBOARD                                                │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  Complete Technical Context for CEO's AI Project              │ │
│  │                                                                │ │
│  │  Your CEO has invited you to provide infrastructure details   │ │
│  │  for their AI project. Your input will help match the right   │ │
│  │  AI experts.                                                   │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Scale & Infrastructure                                  │ │ │
│  │  │  ┌────────────────────────────────────────────────────┐  │ │ │
│  │  │  │ "We are on GCP GKE, autoscaling 200-800 nodes..." │  │ │ │
│  │  │  └────────────────────────────────────────────────────┘  │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Integration Method                                       │ │ │
│  │  │  ┌────────────────────────────────────────────────────┐  │ │ │
│  │  │  │ "Pub/Sub with BigQuery sink for analytics..."      │  │ │ │
│  │  │  └────────────────────────────────────────────────────┘  │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Legacy Data Volume                                       │ │ │
│  │  │  ┌────────────────────────────────────────────────────┐  │ │ │
│  │  │  │ "4 years of transaction data, ~3TB in BigQuery..." │  │ │ │
│  │  │  └────────────────────────────────────────────────────┘  │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Schemas / Data Models (optional)                         │ │ │
│  │  │  ┌─────────── Add URL ──────────┐  [+ Add]               │ │ │
│  │  │  │ [https://...]                  │                       │ │ │
│  │  │  └───────────────────────────────┘                        │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  API Contracts / Specs (optional)                         │ │ │
│  │  │  ┌─────────── Add URL ──────────┐  [+ Add]               │ │ │
│  │  │  │ [https://...]                  │                       │ │ │
│  │  │  └───────────────────────────────┘                        │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                │ │
│  │  [  Submit Technical Context  →  ]                             │ │
│  │                                                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 1: Extract sessionId from invite token
```ts
const token = new URLSearchParams(window.location.search).get('token') || 
              window.location.pathname.split('/').pop();
// Or: sessionId is returned in the register/handoff response or stored in auth context
```

The sessionId should be extracted from the JWT invite token: `JSON.parse(atob(token.split('.')[1])).sessionId`

### API to Call
```
PUT /elicitation/sessions/:sessionId/stage4-handoff
Headers: Authorization: Bearer <tech-team-token>
Body: {
  "scaleAndInfrastructure": "We are on GCP GKE...",
  "integrationMethod": "Pub/Sub with BigQuery...",
  "legacyVolume": "4 years, ~3TB in BigQuery...",
  "schemas": ["https://company.com/schema.json"],
  "contracts": ["https://company.com/api-spec.yaml"]
}
```

**Returns**:
```json
{
  "id": "uuid",
  "currentStage": 5,
  "state": "IN_PROGRESS",
  "updatedAt": "2026-06-26T10:30:00Z"
}
```

### What to Do
1. Extract sessionId from token/context
2. Render 3 textareas + 2 URL list inputs (same pattern as Stage4ScenarioA)
3. Click "Submit" → PUT stage4-handoff
4. On success → render `<Stage4Submitted />`

### Mock Strategy
```ts
const mockResponse = {
  id: sessionId,
  currentStage: 5,
  state: "IN_PROGRESS",
  updatedAt: new Date().toISOString(),
};
```

---

## SCREEN 13: Stage 4 Submitted (Tech Team)

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh Thức)

**File**: `features/tech-team/stage4/Stage4Submitted.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │                       ✅                                        │ │
│  │                                                                │ │
│  │          Technical Context Submitted!                          │ │
│  │                                                                │ │
│  │  Your technical details have been sent to the AI system.       │ │
│  │  The CEO will be notified when the project is published.       │ │
│  │                                                                │ │
│  │  You'll be able to review bids and verify deliverables         │ │
│  │  once the project is matched with an expert.                   │ │
│  │                                                                │ │
│  │  [  Go to Dashboard  ]                                        │ │
│  │                                                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### No API Calls — Pure Display

---

---

# APPENDIX: Shared Utilities

## File Structure (Where Everything Goes)

```
frontend/src/features/
├── ceo/
│   ├── CeoDashboard.tsx          ✅ Built
│   ├── elicitation/
│   │   ├── ElicitationWizard.tsx  🔴 EMPTY — Minh
│   │   ├── Stage1Symptoms.tsx    🔴 EMPTY — Minh
│   │   ├── Stage2Archetype.tsx   🔴 EMPTY — Minh
│   │   ├── Stage3Probes.tsx      🔴 EMPTY — Minh
│   │   ├── Stage4ScenarioA.tsx   🔴 EMPTY — Minh
│   │   ├── Stage4ScenarioB.tsx   ✅ Built (9.3KB)
│   │   ├── Stage4HandoffLink.tsx  🔴 EMPTY — Minh
│   │   ├── Stage5Loading.tsx     🔴 EMPTY — Minh
│   │   ├── QualityGatePassed.tsx  🔴 EMPTY — Minh
│   │   └── QualityGateFailed.tsx  🔴 EMPTY — Minh
│   └── onboarding/
│       ├── WalletTopUp.tsx        ✅ Built
│       └── SubscriptionActivate.tsx ✅ Built
├── expert/
│   ├── ExpertDashboard.tsx       ✅ Built
│   ├── onboarding/
│   │   └── SubscriptionActivate.tsx ✅ Built
│   ├── profile/
│   │   ├── ProfileBuilder.tsx     🔴 EMPTY — Minh Thức
│   │   ├── DomainDepthGrid.tsx    🔴 EMPTY — Khang
│   │   ├── SeamClaimsGrid.tsx     🔴 EMPTY — Khang
│   │   └── StackTagsPicker.tsx    🔴 EMPTY — Minh Thức
│   ├── verification/
│   │   ├── PortfolioSubmitForm.tsx 🔴 EMPTY — Khang
│   │   ├── Tier2Success.tsx       🔴 EMPTY — Khang
│   │   ├── Tier2Rejected.tsx      🔴 EMPTY — Khang
│   │   └── VerificationLockout.tsx 🔴 EMPTY — Khang
│   └── wallet/
│       ├── ExpertWallet.tsx       ✅ Built
│       └── BankHubLink.tsx        ✅ Built
└── tech-team/
    ├── auth/
    │   ├── HandoffRegister.tsx    ✅ Built (554B)
    │   └── LinkExpiredError.tsx   ✅ Built (555B)
    └── stage4/
        ├── Stage4Form.tsx         🔴 EMPTY — Minh Thức
        └── Stage4Submitted.tsx    🔴 EMPTY — Minh Thức
```

---

## How to Add Routes to App.tsx

After building components, add routes in `App.tsx`:

```tsx
// For CEO elicitation:
<Route path="/ceo/elicitation" element={<ElicitationWizard />} />

// For Expert profile:
<Route path="/expert/profile" element={<ProfileBuilder />} />

// For Expert portfolio:
<Route path="/expert/verification" element={<PortfolioSubmitForm />} />

// For Tech Team stage 4:
// Tech team routes already exist — just need Stage4Form to render inside TechTeamDashboard
```

---

## How to Import and Use Components

```tsx
// All use this import pattern:
import { ComponentName } from '@/features/ceo/elicitation/ComponentName';

// Use the existing apiClient from lib:
import { apiClient } from '@/lib/api-client';

// Use existing auth hooks if needed:
import { useAuth } from '@/hooks/use-auth';

// Use existing wallet hooks if needed:
import { useWallet } from '@/hooks/use-wallet';

// Use existing format utility:
import { formatVND } from '@/lib/utils';
```

---

## Mock Server Setup (Optional — If Real BE Is Unavailable)

If the NestJS backend isn't running, create a `src/mocks/handlers.ts`:

```ts
// For MSW or just inline mocks in each component
export const mockApi = {
  // Stage 1
  putStage1: async () => {
    await new Promise(r => setTimeout(r, 2000));
    return { id: "mock", currentStage: 2, voidListJson: [...] };
  },
  // etc.
};
```

**SIMPLER approach**: Each component has inline mock logic behind a flag:
```ts
const USE_MOCK = true; // Set to false when real BE is ready
```

---

*End of File 2*
