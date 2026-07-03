# MASTER INTEGRATION DOC — File 1: Main Flow 1 (CEO Journey)

> **Source of Truth**: Every API contract, UI mockup, and interaction flow for MF-1 lives here.  
> **Audience**: Minh, Minh Thức, Khang — backend devs tasked with FE integration tonight.  
> **If you have any question about what a button does, what an endpoint returns, or how to mock data — answer is in this file first.**  
> **Base URL**: `http://localhost:3001`  
> **Auth**: `Authorization: Bearer <access_token>`  
> **Stack**: React + Vite + TanStack Query + Zustand (`auth.store.ts`) + Axios (`api-client.ts`)

---

## Global Notes (Read This First)

### Token System — Already Built
- Login/Register returns `{ access_token, refresh_token, user }` — the auth hook (`use-auth.ts`) stores all three and redirects.
- `api-client.ts` auto-attaches `Authorization: Bearer <token>` to every request.
- On 401 → interceptor calls `POST /auth/refresh` with refresh_token in body → gets new pair → retries.
- **You don't need to touch auth.** Just call `apiClient.get(...)` / `apiClient.post(...)` — it works.

### Polling Pattern (Use This Everywhere)
```ts
// Poll every 5 seconds, stop after condition met or 30 min timeout
const intervalRef = useRef<ReturnType<typeof setInterval>>();
const startPolling = (checkFn: () => Promise<boolean>) => {
  checkFn(); // immediate first call
  const start = Date.now();
  intervalRef.current = setInterval(async () => {
    const done = await checkFn();
    if (done || Date.now() - start > 30 * 60_000) {
      clearInterval(intervalRef.current);
    }
  }, 5000);
};
useEffect(() => () => clearInterval(intervalRef.current), []);
```

### VND Formatting
```ts
import { formatVND } from '@/lib/utils';
// Already exists — use it. Example: formatVND(500000) → "500,000 VND"
```

### Error Handling Template
```ts
try {
  const { data } = await apiClient.post('/some/endpoint', payload);
  // handle success
} catch (error: any) {
  const status = error.response?.status;
  const message = error.response?.data?.message;
  if (status === 422) setError(Array.isArray(message) ? message[0] : message);
  else if (status === 403 && message?.includes('subscription')) navigate('/ceo/subscription');
  else setError(message || 'Something went wrong');
}
```

---

## FILE STATUS: What's Already Built vs Empty

| File | Status | What It Does |
|------|--------|--------------|
| `features/ceo/CeoDashboard.tsx` | ✅ Built (3.7KB) | Dashboard shell + subscription banner |
| `features/ceo/onboarding/WalletTopUp.tsx` | ✅ Built (4.1KB) | Amount input + QR display + polling |
| `features/ceo/onboarding/SubscriptionActivate.tsx` | ✅ Built (11.5KB) | Pricing card + activate + success screen |
| `components/wallet/VietQRPanel.tsx` | ✅ Built (6.2KB) | Reusable QR display component |
| `components/wallet/WalletPage.tsx` | ✅ Built (5.8KB) | Wallet balance + transaction history |
| `components/wallet/TransactionHistory.tsx` | ✅ Built (4.3KB) | Transaction list |
| `features/ceo/elicitation/Stage4ScenarioB.tsx` | ✅ Built (9.3KB) | Handoff link generate + polling |
| `features/ceo/elicitation/ElicitationWizard.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — wizard shell + navigation |
| `features/ceo/elicitation/Stage1Symptoms.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — symptom text input |
| `features/ceo/elicitation/Stage2Archetype.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — archetype selector |
| `features/ceo/elicitation/Stage3Probes.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — probe questions |
| `features/ceo/elicitation/Stage4ScenarioA.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — CEO fills tech context |
| `features/ceo/elicitation/Stage4HandoffLink.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — share link UI |
| `features/ceo/elicitation/Stage5Loading.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — synthesis polling |
| `features/ceo/elicitation/QualityGatePassed.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — success display |
| `features/ceo/elicitation/QualityGateFailed.tsx` | 🔴 EMPTY | **NEEDS BUILDING** — failure + retry |

---

---

## SCREEN 1: CEO Dashboard (Free Tier)

### Status: ✅ Already Built — NO WORK NEEDED

**File**: `features/ceo/CeoDashboard.tsx`  
**Route**: `/ceo`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOPNAV: [Logo]           Wallet: 0 VND    [👤 CEO Name] [⚙️]      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ✨  Upgrade to Client Pro                                      ││
│  │                                                                  ││
│  │  Supercharge your workflow with AI-powered PRD generation,      ││
│  │  priority matchmaking, and 0% platform fees on milestones.      ││
│  │                                            [Upgrade now]  ───┐  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                                                                  ││
│  │              CEO Dashboard                                      ││
│  │        This section is currently in development.                ││
│  │                                                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What Happens
- "Upgrade now" button → navigates to `/ceo/subscription`
- The subscription banner shows when `user?.subscriptionTier !== 'pro'`
- Wallet balance shown in TopNav via `GET /wallets/me`

### APIs Already Wired
| API | Hook | Used In |
|-----|------|---------|
| `GET /wallets/me` | `useWallet()` | TopNav, Dashboard |
| `GET /users/me` | via auth store | Dashboard (user.subscriptionTier) |

---

## SCREEN 2: Wallet Top-Up

### Status: ✅ Already Built — VERIFY ONLY

**File**: `features/ceo/onboarding/WalletTopUp.tsx`  
**Route**: `/ceo/wallet` (via WalletPage wrapper)

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  💰  Top Up Your Wallet                                         ││
│  │                                                                  ││
│  │  ┌─────────────────────────────────────┐                        ││
│  │  │ Enter amount (VND)                  │ [500000]               ││
│  │  │─────────────────────────────────────│                        ││
│  │  │ Minimum: 10,000 VND                 │                        ││
│  │  └─────────────────────────────────────┘                        ││
│  │                                                                  ││
│  │  [  Generate QR Code  ]                                          ││
│  │                                                                  ││
│  │  ─────── After generating QR ───────                            ││
│  │                                                                  ││
│  │  ┌───────────────────────┐                                       ││
│  │  │                       │                                       ││
│  │  │    [VietQR Image]     │     ← img from qrCodeUrl             ││
│  │  │                       │                                       ││
│  │  └───────────────────────┘                                       ││
│  │                                                                  ││
│  │  ┌─────────────────────────────────────────────────────────────┐││
│  │  │  📋 Transfer Instructions                                   │││
│  │  │  Bank:     MB Bank (MBBank)                   [📋 Copy]     │││
│  │  │  Account:  0394654576                          [📋 Copy]     │││
│  │  │  Amount:   500,000 VND                          [📋 Copy]    │││
│  │  │  Reference: AITASKERXXXXX                       [📋 Copy]    │││
│  │  └─────────────────────────────────────────────────────────────┘││
│  │                                                                  ││
│  │  ⏳ Waiting for payment confirmation... (spinner)               ││
│  │                                                                  ││
│  │  ─────── After payment confirmed ───────                       ││
│  │                                                                  ││
│  │  ✅ Payment received! New balance: 500,000 VND                  ││
│  │                                                                  ││
│  │  [  Continue to Subscription  ]  → navigates to /ceo/subscription││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call
```
POST /wallets/virtual-accounts/topup
Body: { "amount": 500000 }    // integer VND, min 2000
```
**Returns**: `{ qrCodeUrl: "https://qr.sepay.vn/...", paymentReference: "AITASKERXXXXX" }`

### After Generating QR — Poll for Payment
```
GET /wallets/me
// Poll every 5s. When availableBalance >= amount → stop, show success.
```

### Mock Strategy (for testing without SePay)
```json
// Mock POST response:
{ "qrCodeUrl": "https://via.placeholder.com/300x300.png?text=VietQR", "paymentReference": "AITASKER12345" }

// Mock polling: after 10 seconds, return balance = amount
// Use setTimeout or mock the GET /wallets/me with a counter
```

---

## SCREEN 3: Subscription Activation

### Status: ✅ Already Built — VERIFY ONLY

**File**: `features/ceo/onboarding/SubscriptionActivate.tsx`  
**Route**: `/ceo/subscription`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ⚡ POWER UP YOUR WORKFLOW                                          │
│                                                                     │
│  ┌──────────────────────────┐   ┌──────────────────────────────────┐│
│  │                          │   │  ┌──────────────────────────────┐││
│  │  Unlock the Client Pro   │   │  │ ██ (gradient accent bar)     │││
│  │  Experience              │   │  │                              │││
│  │                          │   │  │  6-Month Access              │││
│  │  Elevate your project    │   │  │  500,000 VND                 │││
│  │  management with AI-     │   │  │  One-time payment            │││
│  │  driven elicitation...   │   │  │                              │││
│  │                          │   │  │  ✅ Unlimited AI Elicitations│││
│  │  ✨ AI-Powered Elicit.   │   │  │  ✅ Priority Expert Matching │││
│  │  🛡️ Secure Escrow       │   │  │  ✅ Milestone-based Payments │││
│  │                          │   │  │  ✅ Dedicated Account Mgr    │││
│  │                          │   │  │                              │││
│  │                          │   │  │  Your Wallet: 500,000 VND    │││
│  │                          │   │  │                              │││
│  │                          │   │  │  [ Activate Client Pro → ]   │││
│  │                          │   │  └──────────────────────────────┘││
│  └──────────────────────────┘   └──────────────────────────────────┘│
│                                                                     │
│  ─────── After activation success ───────                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                         ✅                                       ││
│  │                   Pro Activated!                                ││
│  │        Welcome to the premium experience.                       ││
│  │                                                                  ││
│  │  ┌──────────────────────────────────────────────────────┐       ││
│  │  │  New Balance          500,000 VND                     │       ││
│  │  │  ─────────────────────────────────────────────────── │       ││
│  │  │  Expires              December 26, 2026               │       ││
│  │  └──────────────────────────────────────────────────────┘       ││
│  │                                                                  ││
│  │  [  Start Your First AI Project  ]                              ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call
```
POST /subscriptions/activate
Body: { "activeRole": "CLIENT" }
```
**Returns**: `{ access_token: "<new-jwt-with-pro>" }`

### What Happens on Success (Already Implemented)
1. `store.setTokens(data.access_token, '')` — replace token
2. `apiClient.get('/users/me')` → `store.setUser(userRes)` — refresh user
3. `queryClient.refetchQueries({ queryKey: ['wallet'] })` — refresh balance
4. Show success screen with expiry date
5. "Start Your First AI Project" → navigates to `/ceo/elicitation`

### Error States (Already Handled)
- 422 "INSUFFICIENT_BALANCE" → "Insufficient balance. Top up first." + link to wallet
- 409 "Your subscription is still available" → "You already have an active subscription."

---

## SCREEN 4: Elicitation Wizard — Shell + Navigation

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/ElicitationWizard.tsx`  
**Route**: `/ceo/elicitation`

### UI Mockup (State Machine View)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌─ Stage Indicator (top bar) ─────────────────────────────────┐  │
│   │                                                               │  │
│   │   [1●] ─── [2○] ─── [3○] ─── [4○] ─── [5○]                  │  │
│   │   Symptoms  Archetype  Probes  Tech Context  Synthesis        │  │
│   │                                                               │  │
│   └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   ┌─ Current Stage Content (renders child component) ────────────┐  │
│   │                                                               │  │
│   │   {currentStage === 1 → <Stage1Symptoms />}                   │  │
│   │   {currentStage === 2 → <Stage2Archetype />}                  │  │
│   │   {currentStage === 3 → <Stage3Probes />}                     │  │
│   │   {currentStage === 4 → <Stage4ScenarioA /> or <ScenarioB />} │  │
│   │   {currentStage === 5 → <Stage5Loading />}                    │  │
│   │   {gatePassed      → <QualityGatePassed />}                   │  │
│   │   {gateFailed      → <QualityGateFailed />}                   │  │
│   │                                                               │  │
│   └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What This Component Must Do

**Step 1: Create or Resume Session**

When the user navigates to `/ceo/elicitation`, first check if a session exists:

```
POST /elicitation/sessions
Headers: Authorization: Bearer <pro-token>
Body: (empty — no body)
```

**Returns**: Session object or existing IN_PROGRESS session
```json
{
  "id": "uuid",
  "userId": "uuid",
  "currentStage": 1,
  "state": "IN_PROGRESS",
  "archetype": null,
  "voidListJson": [],
  "createdAt": "2026-06-26T10:00:00Z",
  "updatedAt": "2026-06-26T10:00:00Z"
}
```

**Step 2: Store session info in component state**
```ts
const [sessionId, setSessionId] = useState<string | null>(null);
const [currentStage, setCurrentStage] = useState(1);
const [sessionState, setSessionState] = useState<string>('IN_PROGRESS');
const [voidList, setVoidList] = useState<any[]>([]);
const [archetype, setArchetype] = useState<string | null>(null);
const [gateResult, setGateResult] = useState<any>(null);
```

**Step 3: After each stage submit, advance `currentStage`** and render the next child component.

**Step 4: Stage 4 branching**
```
if (user.selfTechnical || user clicks "I'll fill this in myself") {
  render <Stage4ScenarioA />
} else {
  render <Stage4ScenarioB />
}
```

**Step 5: After stage 4 completes**, advance to stage 5 (synthesis loading).

**Step 6: Synthesis result handling**
- `state === 'COMPLETED'` → render `<QualityGatePassed />`
- `state === 'RETURNED'` → render `<QualityGateFailed />`

### Child Component Props Interface
```ts
interface StageProps {
  sessionId: string;
  onComplete: (data: any) => void;   // called when stage is done → advances wizard
  onError: (error: string) => void;
  voidList?: any[];                   // from stage 1, passed to stage 2
  archetype?: string;                 // from stage 2, passed to stage 3
}
```

### Mock Strategy for ElicitationWizard Itself
- No API mocking needed for the wizard shell — it just orchestrates child components.
- Use `useState` for `currentStage` and render the appropriate child.
- Each child calls its own API and calls `onComplete(data)` when done.

---

## SCREEN 5: Stage 1 — Symptoms Input

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/Stage1Symptoms.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Stage 1 of 5: Tell us about your AI needs                        │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────────┐ │
│   │                                                                │ │
│   │  🤖  What problem are you trying to solve with AI?            │ │
│   │                                                                │ │
│   │  Write a detailed description of your project. Include:       │ │
│   │  • What the current process looks like                        │ │
│   │  • What you want AI to help with                              │ │
│   │  • Any constraints or requirements                            │ │
│   │                                                                │ │
│   │  ┌──────────────────────────────────────────────────────────┐ │ │
│   │  │                                                          │ │ │
│   │  │  (Large textarea — at least 8 rows, placeholder shown)   │ │ │
│   │  │  "We have a recommendation engine that currently uses    │ │ │
│   │  │   rule-based filtering. We process about 10,000 items    │ │ │
│   │  │   per day and want to switch to AI-powered ranking..."   │ │ │
│   │  │                                                          │ │ │
│   │  └──────────────────────────────────────────────────────────┘ │ │
│   │                                                                │ │
│   │  [  ← Back  ]              [  Analyze my project  →  ]        │ │
│   │                                                                │ │
│   │  ────── After submitting (loading state) ──────               │ │
│   │                                                                │ │
│   │  ⏳  Analyzing your project description...                    │ │
│   │  This usually takes 10-30 seconds. Please wait.               │ │
│   │  [████████████░░░░░░░░] 60%                                   │ │
│   │                                                                │ │
│   │  ────── After AI response ──────                              │ │
│   │                                                                │ │
│   │  ✅  We detected these potential gaps in your description:    │ │
│   │                                                                │ │
│   │  ┌──────────────────────────────────────────────────────┐     │ │
│   │  │  ⚠️  NO_GROUND_TRUTH (HIGH)                          │     │ │
│   │  │  No baseline established to measure AI performance.  │     │ │
│   │  │  [  I understand  ]                                   │     │ │
│   │  └──────────────────────────────────────────────────────┘     │ │
│   │                                                                │ │
│   │  ┌──────────────────────────────────────────────────────┐     │ │
│   │  │  ⚠️  UNCLEAR_SUCCESS_METRIC (MEDIUM)                 │     │ │
│   │  │  Success criteria are vague. How will you measure?   │     │ │
│   │  │  [  I understand  ]                                   │     │ │
│   │  └──────────────────────────────────────────────────────┘     │ │
│   │                                                                │ │
│   │  [  ← Back  ]              [  Continue to Stage 2  →  ]       │ │
│   │                                                                │ │
│   └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call
```
PUT /elicitation/sessions/:sessionId/stage1
Headers: Authorization: Bearer <pro-token>
Body: { "symptomText": "long text from textarea..." }
```

**Returns (after 10-30s — SLOW)**:
```json
{
  "id": "uuid",
  "currentStage": 2,
  "state": "IN_PROGRESS",
  "voidListJson": [
    { "void_code": "NO_GROUND_TRUTH", "severity": "HIGH", "injected": false },
    { "void_code": "UNCLEAR_SUCCESS_METRIC", "severity": "MEDIUM", "injected": false }
  ],
  "stage1SymptomsJson": ["We have a recommendation engine...", "We process about 10,000 items..."],
  "updatedAt": "2026-06-26T10:00:30Z"
}
```

### What to Do
1. User types in textarea
2. Click "Analyze my project" → POST → show loading spinner (10-30 seconds! Use a big spinner, not just a tiny one)
3. On response: display `voidListJson` items as warning cards with "I understand" buttons
4. User clicks "Continue to Stage 2" → call `onComplete({ voidListJson, stage1SymptomsJson })`
5. `onComplete` in wizard: set `voidList` state, advance `currentStage` to 2

### Error Handling
- 422: "currentStage != 1" → user navigated back? Handle gracefully
- 403: subscription not active → redirect to `/ceo/subscription`
- Timeout/503: "AI service is busy. Please try again."

### Mock Strategy
```ts
// Mock the slow API response:
const mockResponse = {
  id: sessionId,
  currentStage: 2,
  state: "IN_PROGRESS",
  voidListJson: [
    { void_code: "NO_GROUND_TRUTH", severity: "HIGH", injected: false },
    { void_code: "UNCLEAR_SUCCESS_METRIC", severity: "MEDIUM", injected: false },
  ],
  stage1SymptomsJson: [symptomText],
  updatedAt: new Date().toISOString(),
};
// Use setTimeout to simulate 2-second delay for testing
await new Promise(r => setTimeout(r, 2000));
return mockResponse;
```

---

## SCREEN 6: Stage 2 — Select Archetype

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/Stage2Archetype.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Stage 2 of 5: What kind of AI project is this?                   │
│                                                                     │
│   Select the project type that best fits your needs:               │
│                                                                     │
│   ┌──────────────────────┐  ┌──────────────────────┐               │
│   │  🔍                  │  │  🎯                  │               │
│   │  AI Search & Q&A     │  │  Personalisation &   │               │
│   │  (RAG / document     │  │  Recommendations     │               │
│   │   assistant)          │  │                      │               │
│   │                      │  │                      │               │
│   │  Can AI answer        │  │  Can AI personalize  │               │
│   │  questions from your  │  │  content for each    │               │
│   │  documents?           │  │  user?               │               │
│   └──────────────────────┘  └──────────────────────┘               │
│                                                                     │
│   ┌──────────────────────┐  ┌──────────────────────┐               │
│   │  📄                  │  │  💬                  │               │
│   │  Classification &    │  │  Conversational      │               │
│   │  Document Processing │  │  Agent / Chatbot     │               │
│   │                      │  │                      │               │
│   │  Can AI sort, tag,   │  │  Can AI handle       │               │
│   │  or extract info      │  │  customer/service    │               │
│   │  from documents?      │  │  conversations?      │               │
│   └──────────────────────┘  └──────────────────────┘               │
│                                                                     │
│   ┌──────────────────────┐  ┌──────────────────────┐               │
│   │  📈                  │  │  ⚙️                  │               │
│   │  Predictive          │  │  AI Process          │               │
│   │  Analytics /         │  │  Automation           │               │
│   │  Forecasting          │  │                      │               │
│   │                      │  │  Can AI automate a   │               │
│   │  Can AI predict       │  │  manual workflow?    │               │
│   │  outcomes from data?  │  │                      │               │
│   └──────────────────────┘  └──────────────────────┘               │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  ⚠️ Detected Gaps (from Stage 1)                             │  │
│   │  ☐ I understand: "No baseline established..." (NO_GROUND_TRUTH)│  │
│   │  ☐ I understand: "Success criteria are vague..."              │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   [  ← Back  ]              [  Continue to Stage 3  →  ]           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call
```
PUT /elicitation/sessions/:sessionId/stage2
Body: {
  "archetype": "1",                              // "1" to "6"
  "acknowledgedVoidCodes": ["NO_GROUND_TRUTH"]   // which voids user acknowledged (optional)
}
```
**Returns**: `{ id, currentStage: 3, archetype: "1", state: "IN_PROGRESS" }`

### Archetype Data (HARDCODE THIS ON FE)
```ts
const ARCHETYPES = [
  { code: "1", label: "AI Search & Q&A",         desc: "Can AI answer questions from your documents?", icon: "🔍" },
  { code: "2", label: "Personalisation & Recs",   desc: "Can AI personalize content for each user?", icon: "🎯" },
  { code: "3", label: "Classification & Docs",    desc: "Can AI sort, tag, or extract info from documents?", icon: "📄" },
  { code: "4", label: "Conversational Agent",     desc: "Can AI handle customer/service conversations?", icon: "💬" },
  { code: "5", label: "Predictive Analytics",     desc: "Can AI predict outcomes from historical data?", icon: "📈" },
  { code: "6", label: "AI Process Automation",    desc: "Can AI automate a manual workflow?", icon: "⚙️" },
];
```

### What to Do
1. Display 6 archetype cards as a grid (2 columns, 3 rows on desktop; 1 column on mobile)
2. User clicks one → it gets highlighted/selected (blue border, checkmark)
3. Below, show voidList from Stage 1 as checkboxes with "I understand" — user can acknowledge
4. Click "Continue" → POST stage2 → on success call `onComplete({ archetype, acknowledgedVoidCodes })`
5. `onComplete` in wizard: set `archetype`, advance to stage 3

### Mock Strategy
```ts
// Immediate mock response (stage 2 is fast — no LLM):
const mockResponse = {
  id: sessionId,
  currentStage: 3,
  archetype: selectedArchetype,
  state: "IN_PROGRESS",
  updatedAt: new Date().toISOString(),
};
```

---

## SCREEN 7: Stage 3 — Infrastructure Probe Questions

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/Stage3Probes.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Stage 3 of 5: Infrastructure Details                             │
│   Archetype: AI Search & Q&A (RAG)                                 │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                                                               │ │
│   │  Q1: Roughly how many people will search/ask per day?        │ │
│   │  ┌────────────────────────────────────────────────────────┐  │ │
│   │  │ "About 500 internal users, mostly the support team..." │  │ │
│   │  └────────────────────────────────────────────────────────┘  │ │
│   │                                                               │ │
│   │  Q2: What happens when someone gets a wrong answer?          │ │
│   │  ┌────────────────────────────────────────────────────────┐  │ │
│   │  │ "They usually rephrase and try again, or escalate..."   │  │ │
│   │  └────────────────────────────────────────────────────────┘  │ │
│   │                                                               │ │
│   │  Q3: Does it pull from existing docs/systems?                │ │
│   │  ┌────────────────────────────────────────────────────────┐  │ │
│   │  │ "Yes, we have a Confluence wiki and Notion workspace..." │  │ │
│   │  └────────────────────────────────────────────────────────┘  │ │
│   │                                                               │ │
│   │  Q4: How fast must an answer appear?                         │ │
│   │  ┌────────────────────────────────────────────────────────┐  │ │
│   │  │ "Under 3 seconds ideally, but 5 seconds is acceptable." │  │ │
│   │  └────────────────────────────────────────────────────────┘  │ │
│   │                                                               │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│   [  ← Back  ]              [  Continue to Stage 4  →  ]           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call
```
PUT /elicitation/sessions/:sessionId/stage3
Body: {
  "probeResponses": {
    "q1": "About 500 internal users...",
    "q2": "They usually rephrase and try again...",
    "q3": "Yes, Confluence wiki and Notion...",
    "q4": "Under 3 seconds ideally..."
  }
}
```
**Returns**: `{ id, currentStage: 4, state: "IN_PROGRESS" }`

### Probe Questions (HARDCODE — varies by archetype)

```ts
const PROBES: Record<string, { q1: string, q2: string, q3: string, q4: string }> = {
  "1": { // AI Search & Q&A
    q1: "Roughly how many people will search/ask per day?",
    q2: "What happens when someone gets a wrong answer?",
    q3: "Does it pull from existing docs/systems?",
    q4: "How fast must an answer appear?",
  },
  "2": { // Personalisation & Recommendations
    q1: "How many users see recommendations, how often?",
    q2: "What if someone ignores a recommendation?",
    q3: "Where do you track user preferences?",
    q4: "How fresh do recommendations need to be?",
  },
  "3": { // Classification & Document Processing
    q1: "How many items need classifying per day?",
    q2: "What happens when classification confidence is low?",
    q3: "Who reviews borderline cases?",
    q4: "What format are the items (PDF, image, text)?",
  },
  "4": { // Conversational Agent / Chatbot
    q1: "How many concurrent users will chat simultaneously?",
    q2: "What's the expected conversation length?",
    q3: "What systems must the agent access?",
    q4: "What escalation path exists when the agent can't help?",
  },
  "5": { // Predictive Analytics
    q1: "What time horizon do forecasts cover?",
    q2: "How much historical data is available?",
    q3: "What business decisions are made from forecasts?",
    q4: "What's the acceptable error margin?",
  },
  "6": { // AI Process Automation
    q1: "Which manual steps need automating first?",
    q2: "What triggers the automation?",
    q3: "What downstream systems receive output?",
    q4: "How is failure/error handled today?",
  },
};
```

### What to Do
1. Load `PROBES[archetype]` — display questions as labeled textareas
2. User fills all 4, clicks "Continue"
3. POST stage3 → on success call `onComplete({ probeResponses })`

### Mock Strategy
```ts
const mockResponse = {
  id: sessionId,
  currentStage: 4,
  state: "IN_PROGRESS",
  updatedAt: new Date().toISOString(),
};
```

---

## SCREEN 8: Stage 4 — Technical Context (Scenario A — CEO fills directly)

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/Stage4ScenarioA.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Stage 4 of 5: Technical Context                                  │
│                                                                     │
│   Since you marked yourself as technical, please fill in these     │
│   details about your infrastructure.                               │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                                                               │ │
│   │  Scale & Infrastructure                                      │ │
│   │  Describe your current infrastructure and scale:             │ │
│   │  ┌────────────────────────────────────────────────────────┐  │ │
│   │  │ "We run on AWS EKS, ~500k req/day, PostgreSQL + S3..."│  │ │
│   │  └────────────────────────────────────────────────────────┘  │ │
│   │                                                               │ │
│   │  Integration Method                                           │ │
│   │  How will AI integrate with your existing systems?           │ │
│   │  ┌────────────────────────────────────────────────────────┐  │ │
│   │  │ "REST APIs with our internal microservices..."         │  │ │
│   │  └────────────────────────────────────────────────────────┘  │ │
│   │                                                               │ │
│   │  Legacy Data Volume                                           │ │
│   │  How much historical data exists? Where is it stored?        │ │
│   │  ┌────────────────────────────────────────────────────────┐  │ │
│   │  │ "~2TB of historical data in S3, some in MongoDB..."     │  │ │
│   │  └────────────────────────────────────────────────────────┘  │ │
│   │                                                               │ │
│   │  Schemas (optional)                                           │ │
│   │  ┌─────── Add URL ───────┐                                    │ │
│   │  │ [https://...]           │  [+ Add another]                 │ │
│   │  └────────────────────────┘                                    │ │
│   │                                                               │ │
│   │  Contracts / API Specs (optional)                             │ │
│   │  ┌─────── Add URL ───────┐                                    │ │
│   │  │ [https://...]           │  [+ Add another]                 │ │
│   │  └────────────────────────┘                                    │ │
│   │                                                               │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│   [  ← Back  ]              [  Submit & Generate PRD  →  ]         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call
```
PUT /elicitation/sessions/:sessionId/stage4
Body: {
  "scaleAndInfrastructure": "We run on AWS EKS...",
  "integrationMethod": "REST APIs with internal microservices...",
  "legacyVolume": "~2TB in S3...",
  "schemas": ["https://company.com/schema.json"],       // array of URL strings
  "contracts": ["https://company.com/api-spec.yaml"]    // array of URL strings
}
```

**Returns** (this is the BIG one — includes gate result):
```json
{
  "id": "uuid",
  "currentStage": 5,
  "state": "IN_PROGRESS",
  "gate_passed": true,
  "completeness_score": 0.87,
  "project_id": "project-uuid",
  "advisory_note": null,
  "flagged_void": null,
  "return_to_stage": null,
  "updatedAt": "2026-06-26T10:05:00Z"
}
```

OR if gate fails:
```json
{
  "id": "uuid",
  "currentStage": 4,
  "state": "RETURNED",
  "gate_passed": false,
  "completeness_score": 0.58,
  "project_id": null,
  "advisory_note": "Your spec scored 58%. Please revisit Stage 3 for unclear success metrics.",
  "flagged_void": "UNCLEAR_SUCCESS_METRIC",
  "return_to_stage": 3,
  "updatedAt": "2026-06-26T10:05:30Z"
}
```

### What to Do
1. Render 3 textareas (scaleAndInfrastructure, integrationMethod, legacyVolume) + 2 URL list inputs (schemas, contracts)
2. URL list: text input + "Add" button → shows as tag/chip with "×" to remove
3. Click "Submit & Generate PRD" → POST stage4
4. On response: call `onComplete({ gateResult })` 
   - The stage4 response contains `gate_passed`, `completeness_score`, `project_id` — pass ALL to the wizard
5. Wizard checks `gate_passed`: true → advance to stage 5 (synthesis), false → show QualityGateFailed

### Mock Strategy
```ts
// Simulate gate passed:
const mockPassed = {
  id: sessionId, currentStage: 5, state: "IN_PROGRESS",
  gate_passed: true, completeness_score: 0.87,
  project_id: "mock-project-uuid-123",
  advisory_note: null, flagged_void: null, return_to_stage: null,
  updatedAt: new Date().toISOString(),
};

// Simulate gate failed:
const mockFailed = {
  id: sessionId, currentStage: 4, state: "RETURNED",
  gate_passed: false, completeness_score: 0.58, project_id: null,
  advisory_note: "Your project specification scored 58%. Please revisit Stage 3.",
  flagged_void: "UNCLEAR_SUCCESS_METRIC", return_to_stage: 3,
  updatedAt: new Date().toISOString(),
};
```

---

## SCREEN 9: Stage 4 — Handoff Link (Scenario B — CEO delegates)

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh) — NOTE: Stage4ScenarioB.tsx already built (9.3KB)

**Actually**: `Stage4ScenarioB.tsx` is ALREADY BUILT at 9.3KB. This file handles generating the handoff link + polling for Tech Team completion.

But `Stage4HandoffLink.tsx` is EMPTY — this is a sub-component for displaying the share link after generation.

### What Stage4HandoffLink Must Do

**Status**: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/Stage4HandoffLink.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Stage 4 of 5: Invite Your Tech Team                              │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                                                               │ │
│   │  📋  Share this link with your technical team member:        │ │
│   │                                                               │ │
│   │  ┌──────────────────────────────────────────────────────┐    │ │
│   │  │  http://localhost:5173/register/handoff/eyJhbG...     │    │ │
│   │  └──────────────────────────────────────────────────────┘    │ │
│   │                                          [  📋 Copy Link  ]   │ │
│   │                                                               │ │
│   │  ⚠️ This link expires in 72 hours.                           │ │
│   │  Share via Slack, Zalo, or email — no automatic sending.     │ │
│   │                                                               │ │
│   │  ────────────────────────────────────────────────────────    │ │
│   │                                                               │ │
│   │  ⏳  Waiting for your Tech Team to complete Stage 4...       │ │
│   │     (Auto-advancing when they submit — polling every 5s)     │ │
│   │                                                               │ │
│   │  ┌──────────────────────────────────────────────────────┐    │ │
│   │  │  [  Generate New Link  ]    [  Fill in Myself  ]     │    │ │
│   │  └──────────────────────────────────────────────────────┘    │ │
│   │                                                               │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API to Call (already generated by ScenarioB)
The link was generated by: `POST /elicitation/sessions/:id/generate-handoff-link`
Response: `{ invite_link, invite_token, expires_in }`

### What to Do
1. Receive `invite_link` as prop from Stage4ScenarioB
2. Display link in a readonly text field with copy button
3. Show "Waiting..." polling message (polling handled by Stage4ScenarioB parent)
4. "Generate New Link" → calls parent's regenerate function
5. "Fill in Myself" → switches to Scenario A

### Mock Strategy
```ts
const mockLink = "http://localhost:5173/register/handoff/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mocktoken";
```

---

## SCREEN 10: Stage 5 — Synthesis Loading

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/Stage5Loading.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Stage 5 of 5: Generating Your Project Specification              │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                                                               │ │
│   │                         🤖                                    │ │
│   │                                                               │ │
│   │         AI is synthesizing your project blueprint...          │ │
│   │                                                               │ │
│   │         [████████████████░░░░░░░░░░░░] 65%                    │ │
│   │                                                               │ │
│   │         This takes 30–90 seconds. Please don't close          │ │
│   │         this page.                                            │ │
│   │                                                               │ │
│   │  ┌─────────────────────────────────────────────────────────┐ │ │
│   │  │  🔄  Analyzing symptom descriptions                     │ │
│   │  │  ✅  Matching archetype patterns                        │ │
│   │  │  ⏳  Building technical footprint...                    │ │
│   │  │  ⬜  Generating milestone framework                      │ │
│   │  │  ⬜  Running quality gate...                             │ │
│   │  └─────────────────────────────────────────────────────────┘ │ │
│   │                                                               │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What to Do
1. Show animated loading screen with progress messages
2. Poll `GET /elicitation/sessions/:sessionId` every 5 seconds:

```
GET /elicitation/sessions/:sessionId
Headers: Authorization: Bearer <pro-token>
```

Response while still processing:
```json
{ "id": "uuid", "currentStage": 5, "state": "IN_PROGRESS", ... }
```

Response when done:
```json
{
  "id": "uuid",
  "currentStage": 5,
  "state": "COMPLETED",     // ← OR "RETURNED"
  ...
}
```

3. When `state === "COMPLETED"` → call `onComplete({ gateResult: { passed: true, project_id: "..." } })`
4. When `state === "RETURNED"` → call `onComplete({ gateResult: { passed: false, ... } })`

### Progress Animation
```tsx
const messages = [
  "Analyzing symptom descriptions...",
  "Matching archetype patterns...",
  "Building technical footprint...",
  "Generating milestone framework...",
  "Running quality gate...",
];
// Cycle through messages every 8 seconds
```

### Mock Strategy
```ts
// Poll GET /elicitation/sessions/:id — mock:
let pollCount = 0;
const mockPoll = () => {
  pollCount++;
  if (pollCount < 3) {
    return { id: sessionId, currentStage: 5, state: "IN_PROGRESS" };
  }
  return { id: sessionId, currentStage: 5, state: "COMPLETED" };
};
```

---

## SCREEN 11: Quality Gate Passed

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/QualityGatePassed.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                                                               │ │
│   │                       🎉                                      │ │
│   │                                                               │ │
│   │            Your Project Has Been Published!                   │ │
│   │                                                               │ │
│   │          Completeness Score: 87%                              │ │
│   │          ┌──────────────────────────────────────┐            │ │
│   │          │ ████████████████████████████████████ │            │ │
│   │          └──────────────────────────────────────┘            │ │
│   │                                                               │ │
│   │  AI experts are now being matched to your project.            │ │
│   │  You'll be notified when bids start arriving.                 │ │
│   │                                                               │ │
│   │  ┌───────────────────────────────────────────────────────┐   │ │
│   │  │  📋  Project ID:  a1b2c3d4-...                        │   │ │
│   │  │  📅  Published:  June 26, 2026                        │   │ │
│   │  │  🏷️  Archetype:   AI Search & Q&A                     │   │ │
│   │  └───────────────────────────────────────────────────────┘   │ │
│   │                                                               │ │
│   │  [  View My Projects  ]    [  Start New Project  ]            │ │
│   │                                                               │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What to Do
- Receive `completeness_score` and `project_id` as props
- Show celebration screen with score visualization (progress bar)
- "View My Projects" → navigate to projects list (future)
- "Start New Project" → navigate to `/ceo/elicitation` (creates new session)

### No API Calls — Pure Display Component
Props: `{ projectId: string, completenessScore: number, archetype: string }`

---

## SCREEN 12: Quality Gate Failed

### Status: 🔴 EMPTY — NEEDS BUILDING (Minh)

**File**: `features/ceo/elicitation/QualityGateFailed.tsx`

### UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                                                               │ │
│   │                       ⚠️                                      │ │
│   │                                                               │ │
│   │          Your Project Needs More Detail                       │ │
│   │                                                               │ │
│   │          Completeness Score: 58% (minimum 70%)                │ │
│   │          ┌──────────────────────────────────────┐            │ │
│   │          │ ████████████████████████░░░░░░░░░░░░ │            │ │
│   │          └──────────────────────────────────────┘            │ │
│   │                                                               │ │
│   │  ┌─────────────────────────────────────────────────────────┐ │ │
│   │  │  ⚠️ UNCLEAR_SUCCESS_METRIC                              │ │ │
│   │  │                                                          │ │ │
│   │  │  Your project specification scored 58% completeness      │ │ │
│   │  │  (minimum 70% required). Please revisit Stage 3 and     │ │ │
│   │  │  provide more detail about unclear success metrics.     │ │ │
│   │  └─────────────────────────────────────────────────────────┘ │ │
│   │                                                               │ │
│   │  [  Go Back to Stage 3  ]    [  Start Over  ]                │ │
│   │                                                               │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What to Do
- Receive `advisory_note`, `completeness_score`, `return_to_stage`, `flagged_void` as props
- Show score with red progress bar
- Show advisory note prominently
- "Go Back to Stage {return_to_stage}" → tells wizard to reset to that stage
- "Start Over" → creates new session

### Props
```ts
interface QualityGateFailedProps {
  completenessScore: number;
  advisoryNote: string;
  flaggedVoid: string;
  returnToStage: number;
  onReturnToStage: (stage: number) => void;
  onStartOver: () => void;
}
```

---

---

## ✅ Summary: What Minh Must Build Tonight

| # | File | Lines Est. | APIs |
|---|---|---|---|
| 1 | `ElicitationWizard.tsx` | ~150 | POST sessions, orchestrates children |
| 2 | `Stage1Symptoms.tsx` | ~250 | PUT stage1 (SLOW — 10-30s loading) |
| 3 | `Stage2Archetype.tsx` | ~200 | PUT stage2 (fast) |
| 4 | `Stage3Probes.tsx` | ~200 | PUT stage3 (fast) |
| 5 | `Stage4ScenarioA.tsx` | ~250 | PUT stage4 (BIG response — gate result) |
| 6 | `Stage4HandoffLink.tsx` | ~100 | Display only (data from ScenarioB) |
| 7 | `Stage5Loading.tsx` | ~150 | Polling GET session |
| 8 | `QualityGatePassed.tsx` | ~80 | Display only |
| 9 | `QualityGateFailed.tsx` | ~100 | Display only |

**Total**: ~1,480 lines, 9 components  
**Total APIs**: 5 unique endpoints (POST sessions, PUT stage1-4, GET session)

---

*End of File 1 — Continue to File 2 for MF-2 Expert Flow*
