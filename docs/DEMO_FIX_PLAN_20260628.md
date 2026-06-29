# AITasker — Demo Fix Plan

> **Date:** June 28, 2026  
> **Scope:** MF-1 (CEO Flow) + MF-2 (Expert Flow) demo readiness  
> **Source:** Combined test reports from Nhân & Minh  

---

## 📋 How to Read This Document

Each issue is structured as:

- **Current Problem** — what's happening right now
- **Root Cause** — why it's happening (file location, logic flaw)
- **Recommended Solution** — what to change, step by step

Issues are divided into two groups:

1. **🚨 Critical Fixes** — bugs or missing features that will cause the demo to fail or behave incorrectly
2. **✨ UI/UX Improvements** — changes that make the experience smoother, more professional, or more intuitive but don't break core flows

---

---

# 🚨 PART 1 — CRITICAL FIXES

> These **must** be fixed before the demo. Skipping any of them will result in a broken or incorrect flow.

---

## C1. Price Bug — Subscription Activates for ₫5,000 Instead of ₫500,000

#Note: Don't care about this, the AI scan got wrong, the reduction of price to 5000 help testing better

### Current Problem

When a CEO clicks "Activate Client Pro", the subscription activates for **5,000 VND** instead of the intended **500,000 VND**. This is a simple typo that makes Pro essentially free.

### Root Cause

- **File:** `frontend/src/features/ceo/onboarding/SubscriptionActivate.tsx`
- **Line:** 31
- **What it says:** `const price = 5000;`
- **What it should say:** `const price = 500000;`

The backend enforces 500,000 VND deduction — but the frontend displays the wrong price to the user, creating a mismatch between what users see and what they get charged.

### Recommended Solution

Fix line 31 in `SubscriptionActivate.tsx`:

```tsx
// Before (WRONG):
const price = 5000;

// After (CORRECT):
const price = 500000;
```

**Effort:** 1 character change. Instant fix.

---

## C2. Handoff Link — Opens Landing Page Instead of Tech Team Registration

### Current Problem

When a CEO (Non-Tech) enters their tech team member's email in Stage 4, a handoff link is generated. But opening that link:

- **In a different browser:** Lands on the generic AITasker landing page
- **In the same browser:** Shows the current CEO's own profile

In both cases, the tech team member cannot register — the entire Non-Tech CEO flow dead-ends here.

### Root Cause

- **File:** `frontend/src/features/tech-team/auth/HandoffRegister.tsx`
- **What it contains:** A "Coming Soon" placeholder — literally:

```tsx
export function HandoffRegister() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md text-center ...">
        <h2>Coming Soon</h2>
        <p>We are currently working hard on this feature. Check back soon!</p>
      </div>
    </div>
  );
}
```

- **Route:** `/register/handoff/:token` in `frontend/src/App.tsx` (line 44) points to this stub
- The backend already has `POST /auth/register/handoff` ready — it validates a signed JWT token, creates a `TECH_TEAM` account linked to the project, and returns auth tokens

### Recommended Solution

Rebuild `HandoffRegister.tsx` to be a functional registration page:

1. **Read the JWT token** from the URL parameter `:token`
2. **Decode and validate** it client-side (check expiry, purpose field)
3. **If expired/invalid:** Redirect to `/register/handoff/expired` (already routed to `<LinkExpiredError />`)
4. **If valid:** Show a focused registration form with:
   - Email: pre-filled from the token (read-only)
   - Full Name: input field
   - Password: input field
   - Phone: optional input
   - Clear label: "You are registering as a Tech Team member for project X"
5. **On submit:** Call `POST /auth/register/handoff` with the token + registration details
6. **On success:** Store tokens → redirect to `/tech-team` dashboard
7. **Also fix:** When CEO opens the link in the same browser, the `ProtectedRoute` / auth state interferes. The `/register/handoff/:token` route should be **fully public** — no auth wrapper, no redirection when already logged in. If the user is already logged in, they should be logged out automatically when visiting this route.

**File to create/modify:**
- `frontend/src/features/tech-team/auth/HandoffRegister.tsx` (full rewrite)

**Effort:** Medium — one component rewrite, ~100 lines

---

## C3. Wallet QR — Red "Cancel" Button Stays After Successful Payment

### Current Problem

When a CEO generates a QR code for wallet top-up and the payment is confirmed (balance updated, transaction visible), the red "Cancel" button below the QR code **does not disappear**. The user sees both "Payment received!" (green) AND a red "Cancel" button at the same time — confusing and unprofessional.

### Root Cause

- **File:** `frontend/src/features/ceo/onboarding/WalletTopUp.tsx`, lines 97–103
- The cancel button is rendered **unconditionally** — always visible when QR is shown, regardless of payment status:

```tsx
{/* Cancel button — always visible while QR is shown */}
<button
  onClick={handleCancel}
  className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors shadow-sm"
>
  <X size={15} strokeWidth={2.5} />
  Cancel
</button>
```

- The `VietQRPanel` component already detects payment confirmation internally (it watches `availableBalance` for changes and sets `isConfirmed = true`) but **does not communicate this back** to the parent `WalletTopUp`.

### Recommended Solution

**Option A (Quick — for demo):** Track payment confirmation in `WalletTopUp` and hide the cancel button when confirmed:

```tsx
const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);

// Pass callback to VietQRPanel:
<VietQRPanel
  ...
  onPaymentConfirmed={() => setIsPaymentConfirmed(true)}
/>

// Conditionally show cancel:
{!isPaymentConfirmed && (
  <button onClick={handleCancel} className="...">Cancel</button>
)}
```

The `VietQRPanel` already accepts an `onPaymentConfirmed` prop — so this is a one-line addition + a conditional wrapper.

**Option B (Better — post-demo):** Move payment confirmation fully into `WalletTopUp` state, show a "Continue to Subscription" CTA after confirmation, replacing the cancel button entirely.

**Effort:** Small — ~5 lines changed

---

## C4. Tax Code Verification — Calls a Non-Existent Endpoint (404)

### Current Problem

In the Account Settings page (`ProfileSettingPage.tsx`), when a CEO types their tax code (Mã số thuế), the frontend calls `POST /auth/verify-email` with `{ taxCode }`. This endpoint **does not exist** on the backend — it returns 404. The verification feature is completely broken.

Additionally, the `UserProfilePage.tsx` shows a "🏢 Verified Company" badge whenever `clientProfile.companyName` is truthy — even if the company name was manually typed in and never verified via tax code.

### Root Cause

**File:** `frontend/src/hooks/use-user.ts`, line 32:

```ts
const verifyEmail = useMutation({
  mutationFn: async (taxCode: string) => {
    const res = await apiClient.post('/auth/verify-email', { taxCode }); // ❌ 404
    return res.data;
  },
});
```

The integration guide explicitly states:
> `POST /auth/verify-email` — DOES NOT EXIST (Documentation Bug). The `verifyEmail` method in `auth.controller.ts` was NEVER implemented.

**Second bug — Profile badge:** `frontend/src/components/pages/UserProfilePage.tsx`, line 121:

```tsx
const isVerifiedBusiness = isClient && !!clientProfile?.companyName;
// ❌ Shows "Verified Company" just because companyName isn't null
```

### Recommended Solution

1. **Fix the verification call:** Call VietQR's **public API directly from the browser** (no backend needed):

```ts
// Replace the verifyEmail mutation in use-user.ts:
const verifyTaxCode = useMutation({
  mutationFn: async (taxCode: string) => {
    const res = await fetch(`https://api.vietqr.io/v2/business/${taxCode}`);
    const data = await res.json();
    if (data.code === '00') {
      return { verified: true, companyName: data.data.name };
    }
    return { verified: false, companyName: null };
  },
});
```

2. **Then save verified tax code to backend:** After successful verification, call `PUT /users/me` with `{ taxCode, companyName }` to persist it. This way, the backend also stores a verified flag.

3. **Fix the profile badge:** Only show "Verified Company" when the user has actually verified their tax code. Add an `isTaxVerified` flag to the user profile:

```tsx
const isVerifiedBusiness = isClient && !!user?.isTaxVerified;
// ✅ Only shows badge after actual VietQR verification
```

4. **Registration:** Remove the `taxCode` field from the registration form entirely. Tax verification should be done later, in Account Settings, as a separate step. The `RegisterUserDto` on the backend already has `taxCode` as optional — simply don't send it from the registration UI.

**Files to change:**
- `frontend/src/hooks/use-user.ts` — replace `verifyEmail` with a working `verifyTaxCode`
- `frontend/src/components/pages/ProfileSettingPage.tsx` — already has tax code UI, just fix the API call
- `frontend/src/components/pages/UserProfilePage.tsx` — fix `isVerifiedBusiness` logic
- `frontend/src/features/ceo/auth/CeoRegister.tsx` — remove tax code field from form (if currently present)

**Effort:** Medium — ~4 files, mostly logic changes

---

## C5. Profile Settings — Editing One Field Wipes Changes in Another

### Current Problem

In Account Settings (`/ceo/account-setting`), there's a "Save Changes" button at the bottom. But when the user edits Field A (e.g., Full Name) and then clicks the edit pencil on Field B (e.g., Phone), the unsaved changes in Field A are **silently discarded** — only Field B enters edit mode.

### Root Cause

- **File:** `frontend/src/components/pages/ProfileSettingPage.tsx`
- The editing system works with a **single `editingField` state variable** — only one field can be edited at a time:

```tsx
const [editingField, setEditingField] = useState<keyof typeof formValues | null>(null);

const handleEditClick = (field: keyof typeof formValues) => {
  setEditingField(field); // ← Opens editing for ONE field, closes any other
  setTempValue(formValues[field]);
};
```

When a new field is clicked, `formValues` retains the previous changes (they're saved there), but there's no visual indicator of unsaved changes except a tiny green dot — which Minh reported is easy to miss.

### Recommended Solution

Change from **single-field editing** to **inline editing with auto-save per field**:

- Remove the "Save Changes" button at the bottom entirely
- Each inline save (checkmark button) immediately persists via `PUT /users/me` with only that single field
- The "Discard" (X button) reverts that single field to the original value
- This eliminates the problem entirely — no "batch save" to worry about

Alternative (if you prefer keeping the batch save):
- Allow multiple fields to be in "edit mode" simultaneously by using a **Set** instead of a single value: `const [editingFields, setEditingFields] = useState<Set<string>>(new Set())`
- Show a prominent yellow banner at the top: "You have unsaved changes" when `isDirty` is true

**Effort:** Small — change the editing model

---

## C6. Elicitation Wizard — Stage 2 Shows Raw Void Codes Instead of Descriptions

### Current Problem

In Stage 2 (Archetype selection), the "Detected Gaps" section at the bottom displays raw void codes like `NO_GROUND_TRUTH` and `UNCLEAR_SUCCESS_METRIC` instead of human-readable descriptions. Some gaps only show the code, not the explanation.

### Root Cause

- **File:** `frontend/src/features/ceo/elicitation/Stage2Archetype.tsx`, lines 86–97
- The `voidList` passed from Stage 1 may contain void codes not covered by `VOID_DESCRIPTIONS` in `use-elicitation.ts`, or the description lookup falls through to showing the raw code:

```tsx
<span className="text-body-sm text-secondary">
  I understand: &ldquo;{VOID_DESCRIPTIONS[v.void_code] ?? v.void_code}&rdquo;
  // Falls back to raw code when description is missing
</span>
```

### Recommended Solution

1. **Audit all void codes** that the AI service (FastAPI) can return and ensure they all have entries in `VOID_DESCRIPTIONS` in `use-elicitation.ts`
2. **Add a visual distinction** — show the raw code as a small technical label AND the human-readable description below it:

```tsx
<span className="text-body-sm text-secondary">
  <code className="text-caption bg-slate-100 px-1 rounded">{v.void_code}</code>
  {" "}{VOID_DESCRIPTIONS[v.void_code] ?? "This area needs more detail"}
</span>
```

3. **If a void code is truly unknown**, display "Additional detail needed in this area" instead of the raw code

**Effort:** Small — add descriptions, change display logic

---

## C7. Elicitation Wizard — No Back Navigation to Review Previous Stages

### Current Problem

Once the user advances past a stage, there is no way to go back and review or edit what they entered. The CEO must either:
- Continue blindly hoping their inputs were correct
- Abandon and restart the entire session

This is especially problematic for non-technical CEOs who may realize mid-flow that they misunderstood a question.

### Root Cause

- **File:** `frontend/src/features/ceo/elicitation/ElicitationWizard.tsx`
- Each stage component only renders a "Continue →" button — no "← Back" button
- The wizard does have a `handleReturnToStage(stage)` function but it's only used by `QualityGateFailed` (when AI rejects the project)

### Recommended Solution

Add a "← Back" button to stages 2, 3, and 4:

1. **In the wizard shell**, add a `handleGoBack` function that decrements `currentStage` by 1:

```tsx
const handleGoBack = () => {
  if (currentStage > 1) {
    setCurrentStage(prev => prev - 1);
  }
};
```

2. **Pass it to each stage component** as a prop. Each stage renders:

```tsx
<button onClick={onGoBack} className="...">
  ← Back
</button>
```

3. **No API call is needed** — the session data (`voidList`, `archetype`, `probeResponses`) is already stored on the backend. Going back simply lets the user review/resubmit.

4. **For Stage 4 Scenario B** (waiting for tech team), going back means re-entering the tech team email and generating a new link.

**Important decision:** Going back does NOT delete or rollback the AI's analysis. The analysis JSON is preserved. If the user resubmits, the new data overwrites the old.

**Effort:** Small — add back buttons + pass prop through

---

## C8. Elicitation Wizard — Need Ability to Abandon/Cancel Session

### Current Problem

If a CEO starts an elicitation session and changes their mind mid-way, there is no way to cancel it. The session lives in `localStorage` forever, and the dashboard always shows "Continue Session" — even after the project was completed.

### Root Cause

- No "Cancel Session" button exists anywhere in the wizard
- The backend has `PUT /elicitation/sessions/:id/abandon` (sets state to `ABANDONED`)
- The frontend never calls it

### Recommended Solution

1. **Add "Cancel Session" button** in the wizard shell (visible on all stages)
2. **On click:** Call `PUT /elicitation/sessions/:id/abandon`, clear `currentSessionId` from `localStorage`, navigate back to dashboard
3. **Also fix dashboard logic** — after a session is completed (`state: COMPLETED`), clear the stored session ID so the dashboard shows "Start new project" instead of "Continue session"

**Files to change:**
- `ElicitationWizard.tsx` — add cancel button
- `CeoDashboard.tsx` — fix session detection to exclude completed/abandoned sessions

**Effort:** Small — ~30 lines across 2 files

---

## C9. Expert Verification — Attempt Counter Inconsistent; No Cooldown Display

### Current Problem

When an expert submits portfolio evidence for verification:

1. The "attempts remaining" counter **increases** after a rejection (should decrease)
2. After exhausting all 5 attempts (all rejected), clicking "Back" still allows re-entering the verification form instead of locking
3. After lockout, the counter resets when switching seams
4. No visible cooldown timer — user doesn't know when they can try again

### Root Cause

- **File:** `frontend/src/features/expert/verification/PortfolioSubmitForm.tsx`
- The attempt count is derived from `selectedSeamData.submissionCount` but the backend may not be returning this consistently:

```tsx
const eligible = profile.seamClaims.filter(
  (s: any) => s.verificationTier === 'CLAIMED' && 
    (!s.lockedUntil || new Date(s.lockedUntil) < new Date())
);
```

The form re-fetches eligible seams on every render, but the `submissionCount` and `lockedUntil` fields may not be refreshed from the backend after a rejection.

### Recommended Solution

1. **Fix attempt display:** Calculate remaining attempts as `5 - submissionCount` and display prominently
2. **Add lockout state:** When `submissionCount >= 5` or `lockedUntil > now`, show `<VerificationLockout />` with a countdown timer instead of allowing back-navigation
3. **Show cooldown timer** in the lockout component using a real-time countdown:

```tsx
const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(lockedUntil));
useEffect(() => {
  const timer = setInterval(() => setTimeLeft(calculateTimeLeft(lockedUntil)), 1000);
  return () => clearInterval(timer);
}, []);
```

4. **Re-fetch profile** after each verification attempt to get updated `submissionCount` and `lockedUntil`

**Effort:** Medium — logic fix in `PortfolioSubmitForm.tsx` + timer in `VerificationLockout.tsx`

---

## C10. Expert Verification — Verdict Label Says "Verified" Instead of "AI Verified"

### Current Problem

After successful AI evaluation, the Expert Profile page shows:

> ✅ **Verified**

This is misleading — it should clarify that it's **AI-verified**, not manually verified by a human admin.

### Root Cause

- **File:** `frontend/src/features/expert/profile/ExpertProfilePage.tsx`, lines 195–197
- The badge text is hardcoded:

```tsx
<span className="inline-flex items-center gap-1 ... text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
  <CheckCircle className="h-3 w-3" /> Verified
</span>
```

### Recommended Solution

Change the label from "Verified" to "AI Verified":

```tsx
<span className="inline-flex items-center gap-1 ...">
  <CheckCircle className="h-3 w-3" /> AI Verified
</span>
```

Also add a tooltip: "This seam was verified by our AI evaluation system (Tier 2 Evidence-Backed)."

**Effort:** Trivial — one text change

---

## C11. Matched Experts — Re-Clicking Shows Cached Results, No Re-Match

### Current Problem

After creating a project and clicking "View Matched Experts", the shortlist appears. But clicking "View Matched Experts" again from the dashboard shows the **same cached list** — the match scores are not recalculated. The URL stays the same, confirming it's just re-rendering previously fetched data.

### Root Cause

- **File:** `frontend/src/features/ceo/shortlist/ShortlistView.tsx`
- The `useEffect` fetches on mount only, with no refetch trigger:

```tsx
useEffect(() => {
  // fetches once, never again
  fetchShortlist();
}, [projectId]); // ← only re-fetches if projectId changes (it never does)
```

### Recommended Solution

1. **Add a "Refresh Matches" button** at the top of the shortlist that re-fetches:

```tsx
const handleRefresh = async () => {
  setIsLoading(true);
  try {
    const data = await getShortlist(projectId!);
    setExperts(data.results ?? []);
  } finally {
    setIsLoading(false);
  }
};
```

2. **Add a "Last refreshed" timestamp** so users know how fresh the data is

3. **Change from `useEffect` to `useQuery`** (TanStack Query) for proper caching, stale-time handling, and refetch capability

**Effort:** Small — add refresh button + timestamp

---

---

# ✨ PART 2 — UI/UX IMPROVEMENTS

> These are recommended changes that make the overall experience smoother and more polished. They won't break the demo if skipped, but they make a clear difference in perceived quality.

---

## U1. Add Cursor Pointer to All Clickable Elements

### What We Have

Buttons throughout the app use the default text cursor (`cursor: default`) when hovered. Users don't visually know something is clickable.

### What We Recommend

Add `cursor-pointer` (Tailwind class) to all interactive elements:
- All `<button>` components
- Clickable `<div>` cards (archetype cards, match cards)
- Checkbox labels
- Menu items in dropdowns

This can be done globally by adding to the `Button` component's base styles, and doing a quick audit pass on custom interactive elements.

**Effort:** Small — global CSS + audit pass

---

## U2. Role Switch — Navigate to Profile, Not Dashboard

### What We Have

When switching from Expert → CEO (or vice versa) via the "Continue as Expert/Client" button in Profile, the user is redirected to the **dashboard** (`/ceo` or `/expert`). This is jarring — they were on the profile page, then suddenly teleported.

### What We Recommend

Preserve the current page context when switching roles:

- If on `/expert/profile` → redirect to `/ceo/profile`
- If on `/expert/wallet` → redirect to `/ceo/wallet`
- If on `/expert/account-setting` → redirect to `/ceo/account-setting`

Implement by mapping the current path and replacing the role prefix:

```ts
const currentPath = window.location.pathname;
const newPath = currentPath.replace(/^\/(expert|ceo)/, isClient ? '/ceo' : '/expert');
navigate(newPath);
```

**Effort:** Small — modify redirect logic in `redirectByRole` in `use-auth.ts`

---

## U3. Navbar — Show Active Role Label Visibly

### What We Have

The TopNav shows only the user's avatar (initial letter) and a Pro/Free badge. To see what role they're currently in, users must click the avatar to open a dropdown.

### What We Recommend

Add a visible role label next to the avatar in the navbar:

```
[👤 N] CEO PRO   🔔  ✉️
```

For CEO role: show "CEO"
For Expert role: show "Expert"
For Tech Team: show "Tech Team"

This small label gives instant context — the user always knows which "identity" they're operating as.

**File:** `frontend/src/components/layout/TopNav.tsx`

**Effort:** Small — add a `<span>` next to the avatar

---

## U4. Notifications — Simple Dropdown List

### What We Have

The bell icon in the navbar has a red dot for unread notifications but clicking it does nothing. There's a TODO comment in TopNav.tsx.

### What We Recommend

For the demo, implement a **simple notification dropdown** showing 4 pre-defined event types:

| Event | When |
|---|---|
| 💰 Wallet Top-Up | SePay IPN confirms deposit |
| ⭐ Pro Activated | Subscription successfully activated |
| 📋 Project Published | Elicitation quality gate passes |
| 🔍 New Expert Match | Shortlist generated for project |

Store notifications in a simple Zustand store or React context. When a relevant action completes, push a notification. Show them in a dropdown triggered by the bell icon.

**Effort:** Medium — Zustand store + dropdown component + hook integration

---

## U5. CEO Dashboard — Show Project History

### What We Have

The CEO dashboard shows only:
- A subscription banner (if free tier)
- A "Start new project" / "Continue session" banner

There is no list of already-created or in-progress projects.

### What We Recommend

Add a **"Your Projects"** section below the banners:

```
┌─────────────────────────────────────────────────────────┐
│ Your Projects                                            │
│                                                          │
│ 🟢 In Progress — Predictive Analytics for Soccer        │
│    Stage: Synthesis completed · Published Jun 28, 2026  │
│    [View Matched Experts →]                              │
│                                                          │
│ 📋 Draft — RAG System for Legal Documents               │
│    Stage: 3 of 5 · Last edited Jun 27, 2026             │
│    [Continue →]                                          │
└─────────────────────────────────────────────────────────┘
```

- Fetch from `GET /projects` (or `GET /elicitation/sessions` for in-progress)
- Sort by last updated, newest first
- In-progress/active at top, completed below
- Each item links to the relevant next step

**Also fix:** After a session is **completed** (project published), clear `currentSessionId` from localStorage so the dashboard correctly shows "Start new project" instead of "Continue session".

**Files to change:**
- `CeoDashboard.tsx` — add project list section
- `ElicitationWizard.tsx` — clear session ID on completion

**Effort:** Medium — new data fetching + UI section

---

## U6. Elicitation Wizard — Show Current Stage on Dashboard Card

### What We Have

The dashboard card says either "Start new project" or "Continue session" — but it doesn't say which stage the session is at.

### What We Recommend

When a session is in progress, show the stage info:

```
┌─────────────────────────────────────────────────────────┐
│ AI Elicitation Engine                                    │
│                                                          │
│ You have an elicitation session in progress.             │
│ Session: Stage 3 of 5 — Probes                         │
│                                          [Continue →]    │
└─────────────────────────────────────────────────────────┘
```

Fetch session status on dashboard load and display `currentStage` / 5.

**Effort:** Small — display field already exists in session data

---

## U7. Elicitation Wizard — Replace Fake Progress Bars with Spinners

### What We Have

Stage 1 and Stage 5 use **animated progress bars** with random increments (`Math.random() * 12`) to simulate loading. The bar fills from 0 to ~90% over time, but this is pure UI illusion — it doesn't reflect actual AI processing progress.

Stage 1 progress bar code:
```tsx
const interval = setInterval(() =>
  setFakeProgress(p => Math.min(p + Math.random() * 12, 90)), 1000
);
```

### What We Recommend

Replace all fake progress bars with a **simple circular spinner + text**:

```
  ◌
Analyzing your project description…
This usually takes 10–30 seconds. Please wait.
```

The spinner is honest — it says "I'm waiting" without pretending to know progress. The progress bar is misleading and looks broken when it stops at 90% without completing.

**Files to change:**
- `Stage1Symptoms.tsx` — remove progress bar, use spinner
- `Stage5Loading.tsx` — remove progress bar, use spinner
- `PortfolioSubmitForm.tsx` — spinner already exists here, keep it

**Effort:** Small — replace `<div>` progress bars with `<Spinner />` component

---

## U8. Elicitation Wizard — Stage 2 Gap Section Uses Checkboxes (Consistency)

### What We Have

Stage 1 (Symptoms) shows gaps with **text-link style buttons** ("I understand"):
```
[HIGH] NO_GROUND_TRUTH
This area needs more detail...
[I understand]   ← underlined text, not checkbox
```

Stage 2 (Archetype) shows gaps with **actual checkboxes**:
```
☐ I understand: "No baseline established to measure AI performance."
```

This inconsistency is confusing — the same interaction pattern looks different across two pages.

### What We Recommend

Standardize on **checkboxes** (Stage 2's pattern) across all stages:

```
☐ I understand: "No baseline established to measure AI performance."
```

Copy the checkbox layout from `Stage2Archetype.tsx` (lines 86–97) into `Stage1Symptoms.tsx`.

**Effort:** Small — copy-paste UI pattern

---

## U9. Stage 1 — Fix Text Alignment in Gap Cards

### What We Have

After submitting the symptom text and viewing detected gaps, the text content inside each gap card is not aligned horizontally with other cards. The severity chip (HIGH/MEDIUM/LOW) and the description text have inconsistent vertical alignment.

### What We Recommend

Audit the flex layout of the gap cards. Ensure consistent `items-start` alignment and uniform padding. Use the Verdana Health design system spacing (16px = `p-4`).

**File:** `frontend/src/features/ceo/elicitation/Stage1Symptoms.tsx`

**Effort:** Small — CSS alignment fix

---

## U10. Stage 5 — Safeguard Against Stuck State (Stage Mismatch)

### What We Have

If there's a race condition or error where the wizard thinks it's at "Stage X" but the backend says "Stage Y", the UI can get stuck. Minh reported: "if error at stage X but at stage Y, stuck — no reset option except refresh."

### What We Recommend

Add a **safeguard in the wizard shell**: if the session data returned from the API says `currentStage !== wizardStage`, show a prompt:

```
⚠️ Session State Mismatch
Your session appears to be out of sync.
[Reset to Server State]  [Start Over]
```

The "Reset to Server State" button updates the wizard's stage to match the backend. "Start Over" creates a fresh session.

**File:** `frontend/src/features/ceo/elicitation/ElicitationWizard.tsx`

**Effort:** Small — add mismatch detection + recovery UI

---

## U11. Elicitation Wizard — Replace Fake Loading Progress (Bar → Spinner)

### What We Have

The progress bar at the top of each stage (circles 1-2-3-4-5) is good for navigation. But the **fake loading animation** (animated bar filling to random %) during LLM calls on Stage 1 and Stage 5 feels broken.

### What We Recommend

**Keep the stage indicator circles** — they're useful.

**Replace the fake progress bar** during "AI is analyzing..." and "Synthesizing PRD..." with:

```
      ◌
AI is analyzing your requirements…
This may take up to 30 seconds.
(simple centered spinner + message)
```

The spinning circle + honest text is more trustworthy than a fake progress bar that never reaches 100%.

**Effort:** Small — replace fake progress bar div with Spinner component

---

## U12. Expert Shortlist Cards — Add Contact Information

### What We Have

On the shortlist view (`/ceo/shortlist/:projectId`), each expert card shows match strength, seams, and domains. But there's no way to contact them or see their email/other info.

### What We Recommend

Add basic public info to each `MatchCard`:
- Expert's full name
- Years of experience (if available)
- "View Profile" button linking to the expert's public profile

This requires the backend's matching endpoint to include these fields or add a new `GET /users/:userId/public-profile` call.

**Files to change:**
- `MatchCard.tsx` — add contact fields
- Backend: `matching.service.ts` — include expert name/experience in match results (or client fetches it separately)

**Effort:** Medium — frontend + backend change

---

## U13. Expert Profile — Add Verification History Section

### What We Have

The portfolio submission form shows only:
- Current seam selection
- Attempts remaining for that seam

There's no overview of past verification attempts (which seams were tried, their results, dates).

### What We Recommend

Add a **"Verification History"** section above the submission form:

```
┌──────────────────────────────────────────────────────────┐
│ Verification History                                      │
│                                                           │
│ Seam    │ Status     │ Confidence │ Date                  │
│─────────┼────────────┼────────────┼───────────────────────│
│ A↔C     │ ✅ AI Verified │ 91%      │ Jun 25, 2026         │
│ D↔E     │ ❌ Rejected    │ 62%      │ Jun 26, 2026  (2/5)  │
│ A↔F     │ 🔒 Locked      │ —        │ Unlocks Jun 27       │
└──────────────────────────────────────────────────────────┘
```

The data is already available from the `profile.seamClaims` array which includes `verificationTier`, `submissionCount`, `lockedUntil`, and `lastEvaluatedAt` for each seam.

**Effort:** Medium — new UI section + data mapping

---

## U14. CEO Registration — Add Self-Technical Toggle

### What We Have

The backend `RegisterUserDto` already supports a `selfTechnical: boolean` field. But the registration form doesn't expose it. The only way to become "self-technical" is through profile settings later.

### What We Recommend

Add a checkbox/toggle during registration:

```
☐ I have technical expertise and can fill in infrastructure details myself
```

When checked, sends `selfTechnical: true` to `POST /auth/register`. This routes the CEO to **Stage 4 Scenario A** (self-fill) instead of **Stage 4 Scenario B** (invite tech team) — which is already implemented in the wizard shell.

**File:** `frontend/src/features/ceo/auth/CeoRegister.tsx`

**Effort:** Small — add checkbox to form

---

## U15. Elicitation Wizard — Consider Removing "Fill In Myself" Bypass for Stage 4

### What We Have

In Stage 4 Scenario B (Non-Tech CEO), there's a small link: "Actually, I'll fill in the details myself" that lets the CEO bypass the tech team invitation and fill Stage 4 directly.

### What We Recommend

This bypass undermines the purpose of the Non-Tech CEO flow — if anyone can click through, the tech team handoff is rendered meaningless. 
**Remove this bypass** for the demo. Non-tech CEOs must invite a tech team member. If no one responds, they can create a new session and register as Self-Technical from the start.

Post-demo, replace the bypass with a better solution: "Don't have a tech team? AITasker can recommend one."

**File:** `frontend/src/features/ceo/elicitation/Stage4ScenarioB.tsx`

**Effort:** Small — remove one button

---

---

# 📊 SUMMARY — ALL ISSUES AT A GLANCE

## Critical Fixes (11 issues)

| # | Issue | Effort | Files |
|---|---|---|---|
| C1 | Subscription price ₫5K → ₫500K | Tiny | `SubscriptionActivate.tsx` |
| C2 | Handoff Register stub | Medium | `HandoffRegister.tsx` (rewrite) |
| C3 | Cancel button stays after QR payment | Small | `WalletTopUp.tsx` |
| C4 | Tax code verification calls 404 endpoint | Medium | `use-user.ts`, `ProfileSettingPage`, `UserProfilePage`, `CeoRegister` |
| C5 | Editing one field wipes another | Small | `ProfileSettingPage.tsx` |
| C6 | Stage 2 shows raw void codes | Small | `Stage2Archetype.tsx`, `use-elicitation.ts` |
| C7 | No back navigation in wizard | Small | 5 stage components + wizard |
| C8 | No cancel/abandon session | Small | `ElicitationWizard.tsx`, `CeoDashboard.tsx` |
| C9 | Attempt counter inconsistent + no cooldown | Medium | `PortfolioSubmitForm.tsx`, `VerificationLockout.tsx` |
| C10 | "Verified" → "AI Verified" label | Tiny | `ExpertProfilePage.tsx` |
| C11 | Matched experts doesn't re-fetch | Small | `ShortlistView.tsx` |

## UI/UX Improvements (15 issues)

| # | Issue | Effort | Files |
|---|---|---|---|
| U1 | Cursor pointer on all clickable elements | Small | Global CSS + audit |
| U2 | Role switch → same page, different role | Small | `use-auth.ts` |
| U3 | Navbar role label | Small | `TopNav.tsx` |
| U4 | Simple notification dropdown | Medium | `TopNav.tsx` + new store |
| U5 | Project history on dashboard | Medium | `CeoDashboard.tsx` |
| U6 | Show stage on dashboard card | Small | `CeoDashboard.tsx` |
| U7 | Replace fake progress bars with spinners | Small | `Stage1Symptoms`, `Stage5Loading` |
| U8 | Stage 1 gaps use checkboxes (not text links) | Small | `Stage1Symptoms.tsx` |
| U9 | Fix gap card text alignment in Stage 1 | Small | `Stage1Symptoms.tsx` |
| U10 | Safeguard against stage mismatch | Small | `ElicitationWizard.tsx` |
| U11 | Spinner instead of fake progress bar | Small | (covered by U7) |
| U12 | Contact info on expert shortlist cards | Medium | `MatchCard.tsx` + backend |
| U13 | Expert verification history section | Medium | `PortfolioSubmitForm.tsx` |
| U14 | Self-technical toggle at registration | Small | `CeoRegister.tsx` |
| U15 | Remove "Fill In Myself" bypass in Stage 4 | Small | `Stage4ScenarioB.tsx` |

---

# 🗓️ RECOMMENDED FIX ORDER

1. **C1** (price bug) — 1 min, instant
2. **C2** (handoff register) — biggest blocker for Non-Tech CEO demo
3. **C3** (cancel button) — visual polish for wallet flow
4. **C4** (tax verification) — currently completely non-functional
5. **C5** (profile editing) — data loss UX bug
6. **C6** (void codes) — Stage 2 looks broken
7. **C7 + C8** (wizard navigation) — back button + cancel session
8. **C9 + C10** (expert verification) — counter fix + label
9. **C11** (refresh matches) — re-fetch capability
10. **U1–U15** — UI/UX improvements, in any order

---

*End of Demo Fix Plan*
