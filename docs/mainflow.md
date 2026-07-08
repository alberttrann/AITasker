# Frontend Flow Analysis: MF-1 & MF-2
### Cross-referenced against `08-mainflows_redo.md` · Frontend codebase: `frontend/src/`
> **Generated:** 2026-07-04

---

## Global Architecture

| Layer | Technology | File / Location |
|---|---|---|
| Routing | React Router v6 | `frontend/src/App.tsx` |
| Auth state (client) | Zustand (persisted) | `frontend/src/store/auth.store.ts` |
| Server state / caching | TanStack React Query | query keys documented per hook |
| HTTP client | Axios | `frontend/src/lib/api-client.ts` |
| Forms | Formik + Yup | Used in `AuthModal`, `ProfileBuilder` |
| Price constants | TypeScript enum | `frontend/src/types/enums.ts` → `SubscriptionPrice` |

### Route Guard Chain (`frontend/src/lib/route-guards.tsx`)

```
/ (public LandingPage)
/register/handoff/:token   → HandoffRegister (public, no auth required)

<ProtectedRoute>           → redirects to / if no valid token
  <RoleRoute subtype=CEO>
    /ceo/**
  <RoleRoute role=EXPERT>
    /expert/**
  <RoleRoute subtype=TECH_TEAM>
    /tech-team/**
```

---

---

# ═══════════════════════════════════════
# MF-1 · Client (CEO) Registration & Subscription
# ═══════════════════════════════════════

**Spec summary:** Register → wallet top-up via SePay QR → activate Client Pro subscription (500,000 VND / 6 months).

---

## ─── Phase A: Registration ───────────────────────────────

### What the user sees

The user lands on `/` (LandingPage). Any "Join" / "Get Started" / "Sign in" call-to-action opens `AuthModal` as an overlay.

### Components

| Component | File |
|---|---|
| `LandingPage` | `frontend/src/components/pages/LandingPage.tsx` |
| `AuthModal` | `frontend/src/components/auth/AuthModal.tsx` |
| `RegisterRoleSwitcher` | `frontend/src/components/layout/RoleSwitcher.tsx` |
| `Button`, `Input`, `Label`, `Checkbox` | `frontend/src/components/ui/` |

### User interaction (step by step)

1. **Open modal** — any CTA fires `setAuthModalOpen(true)` from a parent state/context.
2. **Mode toggle** — `AuthModal` internal state `mode: 'signin' | 'signup'`. Default driven by `initialMode` prop. User clicks the bottom link to switch.
3. **Role selection** — `RegisterRoleSwitcher` renders two cards:
   - **"I need AI help"** → sets Formik field `role = 'CLIENT_CEO'`
   - **"I provide AI services"** → sets `role = 'EXPERT'`  
   Default is `CLIENT_CEO`.
4. **Fill form** — `fullName` (required), `email` (required), `password` (required ≥6 chars), `phone` (optional).
5. **`selfTechnical` checkbox** — shown only when `values.role === 'CLIENT_CEO'`. Controls whether CEO can fill Stage 4 directly without delegating to Tech Team.
6. **Submit** — Formik `onSubmit` calls `register.mutate(...)`.

### Form validation (Yup — `registerSchema` in `AuthModal.tsx`)

| Field | Rule |
|---|---|
| `fullName` | required, min 2 chars |
| `email` | required, valid email |
| `password` | required, min 6 chars |
| `phone` | optional, must match `/^[0-9+\-\s()]*$/` |

### Hook & API call

**Hook:** `useAuth()` from `frontend/src/hooks/use-auth.ts`  
**Mutation:** `register`

```
POST /auth/register
Body: {
  fullName: string,
  email: string,
  password: string,
  phone?: string,
  selfTechnical?: boolean,   // CEO only
  roles: "CLIENT_CEO"        // passed as string (not array)
}
Response: {
  access_token: string,
  refresh_token?: string
}
```

### `onSuccess` sequence (in `use-auth.ts`)

```
1. store.setTokens(access_token, refresh_token)     // Zustand persisted
2. GET /users/me                                     // fetch full UserDto
3. store.setUser(user)                               // update Zustand
4. redirectByRole(user, navigate)
   → user.activeRole === "CLIENT"
   → user.clientSubtype === "CEO"
   → navigate("/ceo", { replace: true })
```

`AuthModal` auto-closes because a `useEffect` on `isAuthenticated` calls `onClose()`.

### Backend side-effects (not visible on FE)

- Atomic DB transaction creates: `users` (roles=["CLIENT_CEO"], active_role="CLIENT", client_subtype="CEO", sub_client_tier="free"), `client_profiles`, `wallets` (balance=0), `virtual_accounts` (type=WALLET_TOPUP, generated locally — no SePay call).
- JWT issued has `subscription_client_tier: "free"`.

### Resulting frontend state

- URL: `/ceo` → renders `CeoDashboard` with `CeoOverview`.
- `useSubscriptionStatus()` → `GET /subscriptions/status` → `{ tier: "free" }`.
- `CeoOverview` computes `hasSubscription = subStatus?.tier === 'pro'` → **false** → renders **"Upgrade to Client Pro"** banner.
- Elicitation / Matching / all Pro-gated routes are accessible by URL but backend will 403 them.

---

## ─── Phase B: Wallet Top-Up ────────────────────────────

### What the user sees

From `CeoOverview`, the user clicks "Upgrade now" on the upgrade banner → navigates to `/ceo/subscription`. `SubscriptionActivate` component detects `availableBalance < 500,000` → renders red "Insufficient balance" message + **"Top Up Wallet"** link → navigates to `/ceo/wallet`.

### Components

| Component | File |
|---|---|
| `WalletPage` | `frontend/src/components/wallet/WalletPage.tsx` |
| `WalletTopUp` | `frontend/src/features/ceo/onboarding/WalletTopUp.tsx` |
| `VietQRPanel` | `frontend/src/components/wallet/VietQRPanel.tsx` |

### User interaction

1. **Enter amount** — `Input` field accepts numeric text; formatted with `.` thousands separator (e.g., `500.000`). Minimum 1,000 VND enforced client-side.
2. **Click "Generate QR Code"** — calls `topUpMutation.mutate(numericAmount)`.
3. **QR displayed** — `VietQRPanel` receives `qrCodeUrl` and `paymentReference`, renders the SePay QR image and payment reference code.
4. **User pays externally** — scans QR in their banking app, transfers the amount.
5. **SePay IPN fires** — backend handles `POST /webhooks/sepay/ipn`; frontend is not involved in this step.
6. **Balance updates** — `useWallet()` query auto-refetches on window focus. User can also navigate back to see updated balance.
7. **"Continue to Subscription" button** — appears inside `WalletTopUp` when `availableBalance >= 500,000` (threshold hardcoded) and `showContinue` prop is `true`. Navigates to `/ceo/subscription`.

### Hooks & API calls

**Hook:** `useTopUpWallet()` from `frontend/src/hooks/use-wallet.ts`

```
POST /wallets/virtual-accounts/topup
Body: { amount: number }
Response: {
  qrCodeUrl: string,        // full SePay QR image URL
  paymentReference: string  // VA number used as bank transfer memo
}
```

**Hook:** `useWallet()` from `frontend/src/hooks/use-wallet.ts`

```
GET /wallets/me
QueryKey: ['wallet']
enabled: isAuthenticated
Response: WalletDto { availableBalance, lockedBalance, ... }
```

### State transitions in `WalletTopUp.tsx`

```
Initial state: amountInput='', topUpMutation.data = null
              → renders: Amount input + "Generate QR Code" button

After mutate success: topUpMutation.data = { qrCodeUrl, paymentReference }
              → renders: VietQRPanel + "Cancel" button

If availableBalance >= 500,000:
              → renders: "Continue to Subscription" button
```

---

## ─── Phase C: Subscription Activation ──────────────────

### What the user sees

Route `/ceo/subscription` → `SubscriptionActivate` (CEO version).

The page has two columns:
- **Left:** marketing copy — "Unlock the Client Pro Experience", feature list (AI Elicitation, Secure Escrow, etc.)
- **Right:** pricing card — price badge (from `SubscriptionPrice.CEO = 500,000`), wallet balance, and the activate button.

### Components

| Component | File |
|---|---|
| `SubscriptionActivate` (CEO) | `frontend/src/features/ceo/onboarding/SubscriptionActivate.tsx` |
| `useSubscription` | `frontend/src/hooks/use-subscription.ts` |
| `useWallet` | `frontend/src/hooks/use-wallet.ts` |

### Conditions for button display

```typescript
const availableBalance = wallet?.availableBalance ?? 0;
const price = SubscriptionPrice.CEO; // 500_000
const canAfford = availableBalance >= price;

// canAfford = true  → show "Activate Client Pro" button
// canAfford = false → show red "Insufficient balance" + "Top Up Wallet" link
```

### User interaction

1. User clicks **"Activate Client Pro"** → `handleActivate()` fires.
2. `activateSubscription.mutate({ activeRole: user?.activeRole || 'CLIENT' })`.
3. Button enters `isLoading` / `disabled` state while pending.
4. On error: `errorMsg` state set → displayed in red box above button.

### Hook & API call

**Hook:** `useSubscription().activateSubscription` from `frontend/src/hooks/use-subscription.ts`

```
POST /subscriptions/activate
Body: { activeRole: "CLIENT" }
Response: { access_token: string }   // new JWT with updated subscription claims
```

### `onSuccess` sequence (in `SubscriptionActivate.tsx`)

```
1. store.setTokens(data.access_token, '')         // Replace old JWT
2. GET /users/me (with new token in header)       // Force fresh user fetch
3. store.setUser(freshUser)                        // Update Zustand
4. queryClient.setQueryData(['user', 'me'], freshUser)
5. queryClient.invalidateQueries({ queryKey: ['wallet'] })
6. setIsSuccess(true)                              // Swap to success screen
```

### Success screen

Renders: animated Sparkles icon, "Pro Activated!", new balance, expiry date (computed client-side as `now + 6 months`), and **"Back to Dashboard"** button → `navigate('/ceo')`.

### Error cases

| HTTP | Backend code | UI shown |
|---|---|---|
| 409 | `ALREADY_SUBSCRIBED` | errorMsg: "You already have an active subscription." |
| 422 | `INSUFFICIENT_BALANCE` | errorMsg from response.data.message |
| 409 | role mismatch | errorMsg from response.data.message |

---

## ─── Subscription Status: How the Entire UI Reads It ───

After activation (and on every subsequent load), subscription state is read from the **dedicated endpoint** — not from `user.subscriptionTier` in Zustand:

**Hook:** `useSubscriptionStatus()` from `frontend/src/hooks/use-subscription.ts`

```
GET /subscriptions/status
QueryKey: ['subscriptionStatus']
enabled: isAuthenticated
Response: {
  tier: 'free' | 'pro',
  isActive: boolean,
  expiresAt?: string,
  packageId?: string
}
```

Every UI component that gates on subscription reads from this hook:

| Component | File | Logic |
|---|---|---|
| `TopNav` | `components/layout/TopNav.tsx` | `isPro = subStatus?.tier === 'pro'` — hides "Upgrade" link, shows Pro badge |
| `UserProfilePage` | `components/pages/UserProfilePage.tsx` | Pro badge, expiry tooltip |
| `WalletPage` | `components/wallet/WalletPage.tsx` | Tier badge in profile header |
| `CeoDashboard (CeoOverview)` | `features/ceo/CeoDashboard.tsx` | `hasSubscription` — controls upgrade banner |
| `ProjectsPage` | `features/ceo/pages/ProjectsPage.tsx` | `isSubscribed` — gates "Start Elicitation" button |
| `ExpertDashboard` | `features/expert/ExpertDashboard.tsx` | `hasSubscription` — controls upgrade banner |
| `ExpertWallet` | `features/expert/wallet/ExpertWallet.tsx` | Tier badge |

---

---

# ═══════════════════════════════════════
# MF-2 · Expert Registration, Profile & Tier 1→2 Verification
# ═══════════════════════════════════════

**Spec summary:** Register as Expert → build taxonomy profile (domains + seams + stack) → optionally top-up wallet + activate Expert Pro → submit portfolio for LLM Tier 2 verification → link bank account.

---

## ─── Phase A: Expert Registration ──────────────────────

### What the user sees

Same `AuthModal` as MF-1. User selects **"I provide AI services"** role card.

### Difference from CEO registration

- `selfTechnical` checkbox is **hidden** (only shown when `role === 'CLIENT_CEO'`).
- Button label: **"Sign up as Expert"**.
- Body field `roles = "EXPERT"`.

### API call

```
POST /auth/register
Body: { fullName, email, password, phone?, roles: "EXPERT" }
Response: { access_token, refresh_token }
```

### `onSuccess` redirect

`redirectByRole()` evaluates `user.activeRole === "EXPERT"` → `navigate("/expert", { replace: true })`.

### Resulting frontend state

- URL: `/expert` → `ExpertDashboard` with `ExpertOverview`.
- `useSubscriptionStatus()` → `{ tier: "free" }` → `hasSubscription = false` → **"Upgrade to Expert Pro"** banner visible.
- `useExpertProfile()` → `GET /expert-profile/me` → returns empty profile (null bio, empty arrays).

### Backend side-effects

- Atomic TX creates: `users`, `expert_profiles` (bio=null, engagement_model=null, stack_tags_json=[], archetype_history_json=[]), `wallets`, `virtual_accounts` (WALLET_TOPUP).

---

## ─── Phase B: Profile Build ─────────────────────────────

### Entry point

Expert navigates to `/expert/expert-profile` → `ExpertProfilePage`.

**Load trigger:** `useExpertProfile()` fires `GET /expert-profile/me` on mount.

### B.0 — Profile Page Overview

**Component:** `ExpertProfilePage` (`frontend/src/features/expert/profile/ExpertProfilePage.tsx`)

On load, computes `missingParts` from the fetched profile data:

```typescript
const missingDomains = domains.length === 0;
const missingSeams   = seams.length === 0;
const missingStack   = stackTags.length === 0;
const missingBio     = !bio;
```

If any are missing → amber **"Incomplete Profile"** alert with "Complete Profile" button → sets `isBuilding = true` → renders `<ProfileBuilder />`.

If seams exist and `isVerifying = true` → renders `<PortfolioSubmitForm />` inline.

### B.1 — Domain Depth Declarations

**User interaction:**
1. Clicks "Edit Profile" or "Complete Profile" → `ProfileBuilder` opens.
2. `DomainDepthGrid` shows 6 domain codes (A–F) with depth selectors (SURFACE / DEEP / EXPERT).
3. Expert selects depth for each relevant domain.

**Component:** `DomainDepthGrid` (`frontend/src/features/expert/profile/DomainDepthGrid.tsx`)

**Hook & API call (via `useExpertProfile().saveDomains`):**

```
PUT /expert-profile/domains/sync
Body: {
  domains: [{ domainCode: "A", depthLevel: "DEEP" }, ...]
}
```

After success: `queryClient.invalidateQueries(['expert-profile', 'me'])` — profile refreshes.

Each saved domain gets `verification_tier: "CLAIMED"` in the DB.

### B.2 — Seam Claims

**User interaction:**
1. `SeamClaimsGrid` shows cross-domain seam codes (e.g., `A↔D`, `E↔F`).
2. Expert toggles which seams they claim expertise in.

**Component:** `SeamClaimsGrid` (`frontend/src/features/expert/profile/SeamClaimsGrid.tsx`)

**Hook & API call (via `useExpertProfile().saveSeams`):**

```
PUT /expert-profile/seams/sync
Body: { seams: ["A↔D", "E↔F", ...] }    // array of seam code strings
```

Each seam saved as: `verification_tier: "CLAIMED"`, `submission_count: 0`, `locked_until: null`.

### B.3 — Stack Tags, Engagement Model & Bio

**User interaction:**
1. `StackTagsPicker` — free-text tag input for technologies.
2. Engagement model dropdown: `MILESTONE` | `HOURLY` | etc.
3. Bio textarea.

**Components:**
- `StackTagsPicker` (`frontend/src/features/expert/profile/StackTagsPicker.tsx`)
- Bio/model fields in `ProfileBuilder` (`frontend/src/features/expert/profile/ProfileBuilder.tsx`)

**Hook & API call (via `useExpertProfile().saveStackAndModel`):**

```
PUT /expert-profile/me
Body: {
  engagementModel: "MILESTONE",
  stackTagsJson: ["Python", "LangChain", "Go"],
  archetypeHistoryJson: [],
  bio: "..."
}
```

### The `useExpertProfile` hook

**File:** `frontend/src/hooks/use-expert-profile.ts`

```typescript
// Query
queryKey: ['expert-profile', 'me']
queryFn: GET /expert-profile/me
Returns: {
  profile: { bio, engagementModel, stackTagsJson, archetypeHistoryJson },
  domainDepths: [{ domainCode, depthLevel, verificationTier }],
  seamClaims: [{ id, seamCode, verificationTier, submissionCount, lockedUntil }]
}

// Mutations
saveDomains   → PUT /expert-profile/domains/sync
saveSeams     → PUT /expert-profile/seams/sync
saveStackAndModel → PUT /expert-profile/me

// All mutations call queryClient.invalidateQueries(['expert-profile', 'me']) on success
```

---

## ─── Phase C: Expert Subscription (Pro Activation) ──────

### Entry point

`ExpertOverview` "Upgrade to Expert Pro" banner → `/expert/subscription` → `SubscriptionActivate` (Expert version).

### Component

`frontend/src/features/expert/onboarding/SubscriptionActivate.tsx`

Identical UX pattern to CEO version, with differences:

| | CEO | Expert |
|---|---|---|
| Price | `SubscriptionPrice.CEO` (500,000) | `SubscriptionPrice.EXPERT` (300,000) |
| `activeRole` in body | `"CLIENT"` | `"EXPERT"` |
| Success redirect | `navigate('/ceo')` | `navigate('/expert')` |
| Insufficient balance link | `/ceo/wallet` | `/expert/wallet` |

### API call

```
POST /subscriptions/activate
Body: { activeRole: "EXPERT" }
Response: { access_token: string }
```

### `onSuccess` sequence (identical pattern to CEO)

```
1. store.setTokens(data.access_token, '')
2. GET /users/me (with new token)
3. store.setUser(freshUser)
4. queryClient.setQueryData(['user', 'me'], freshUser)
5. queryClient.invalidateQueries({ queryKey: ['wallet'] })
6. setIsSuccess(true) → success screen → navigate('/expert')
```

### Subscription guard for portfolio submission

Backend: `POST /portfolio-submissions` is gated by `[Pro-E] SubscriptionGuard`.  
If not subscribed, backend returns HTTP 403.  
Frontend catches 403 in `PortfolioSubmitForm` and renders:

```
error === 'EXPERT_PRO_REQUIRED'
  → amber panel: "Expert Pro Subscription Required"
  → Link to /expert/subscription
```

---

## ─── Phase D: Tier 1 → 2 Verification (Portfolio Submission) ───

### Purpose

Upgrade a seam claim from `CLAIMED` (self-declared) → `EVIDENCE_BACKED` (AI-verified) by submitting portfolio evidence to LLM evaluation.

### Entry point

`ExpertProfilePage` → "Verify a Seam" button (visible only when `seams.length > 0`) → sets `isVerifying = true` → renders `<PortfolioSubmitForm />` inline.

### Eligible seam filter (client-side, in `PortfolioSubmitForm.tsx`)

```typescript
useEffect(() => {
  if (profile?.seamClaims) {
    const eligible = profile.seamClaims.filter(
      (s) => s.verificationTier === 'CLAIMED' &&
              (!s.lockedUntil || new Date(s.lockedUntil) < new Date())
    );
    setEligibleSeams(eligible);
  }
}, [profile, resultView]);
```

Conditions that **exclude** a seam from the dropdown:
- `verificationTier === 'EVIDENCE_BACKED'` — already upgraded.
- `lockedUntil` is a future date — locked due to ≥5 failed submissions.

### Components

| Component | File |
|---|---|
| `PortfolioSubmitForm` | `frontend/src/features/expert/verification/PortfolioSubmitForm.tsx` |
| `Tier2Success` | `frontend/src/features/expert/verification/Tier2Success.tsx` |
| `Tier2Rejected` | `frontend/src/features/expert/verification/Tier2Rejected.tsx` |
| `VerificationLockout` | `frontend/src/features/expert/verification/VerificationLockout.tsx` |
| `VerificationHistoryPage` | `frontend/src/features/expert/verification/VerificationHistoryPage.tsx` |

### Form fields & client-side validation

| Field | Minimum | Description |
|---|---|---|
| Target Seam | required | Dropdown of eligible seams |
| Project Description | 50 chars | Real project using those two domains |
| Key Technical Decisions | 20 chars | Trade-offs and rationale |

"Submit for AI Evaluation" button disabled until all pass.

### Pre-submission confirmation modal

`ConfirmModal` warns:
> "Once you submit evidence for this seam, it becomes **permanently locked** to your profile and cannot be removed, regardless of whether the evaluation succeeds or fails."

User must click "Submit Evidence" to proceed.

### Hook & API call

**Hook:** `usePortfolio().submitPortfolio` from `frontend/src/hooks/use-portfolio.ts`

```
POST /portfolio-submissions
Body: {
  seamClaimId: string,
  projectDescription: string,
  decisionPoints: string
}
Timeout: implicit (LLM call takes 10–30 seconds)
Response: {
  id: string,
  status: "APPROVED" | "REJECTED",
  llmConfidence: number,          // 0.0 – 1.0; threshold ≥0.85 = APPROVED
  evaluationTierUpgraded: boolean,
  advisoryNote: string | null,
  evaluatedAt: string
}
```

### Loading state during LLM evaluation

`PortfolioSubmitForm` renders a blocking loading overlay while `isSubmitting = true`:
- Spinning loader + border animation
- Progress bar (CSS animation, `scale-x 15s ease-out`)
- Message: "Our AI is currently analyzing your portfolio. This takes about 10–30 seconds."

### Result state machine

`resultView` state: `'form'` | `'success'` | `'rejected'` | `'lockout'`

```
POST /portfolio-submissions resolves:

  status === 'APPROVED'
    → resultView = 'success'
    → renders Tier2Success (seam code + llmConfidence + congratulations)

  status === 'REJECTED' AND (submissionCount + 1) < 5
    → resultView = 'rejected'
    → renders Tier2Rejected (advisoryNote, attemptsRemaining)

  status === 'REJECTED' AND (submissionCount + 1) >= 5
    → resultView = 'lockout'
    → renders VerificationLockout (lockedUntil = now + 30 days, computed client-side)

HTTP 429 (rate limit / lock from server)
    → resultView = 'lockout'

HTTP 403 (subscription required)
    → error = 'EXPERT_PRO_REQUIRED'
    → inline amber panel shown on the form view
```

> **Important detail:** `submissionCount` before the mutation is captured **before** calling `mutateAsync` to avoid race conditions with React Query cache invalidation. The `lockedUntil` displayed in lockout is computed client-side as `Date.now() + 30 * 86400000` because the 201 response body does not include it.

### After Tier 2 success

- `Tier2Success` component renders seam code + AI confidence score.
- On next profile load: `useExpertProfile()` refetches, seam appears with `verificationTier: "EVIDENCE_BACKED"` → green "AI Verified" badge in `ExpertProfilePage`.
- Verification history accessible at `/expert/verification-history` → `VerificationHistoryPage`.

---

## ─── Phase E: Bank Account Linking ──────────────────────

### Purpose

Expert must link their SePay bank account XID to be eligible to receive payouts (withdrawals).

### Entry point

`/expert/wallet` → `ExpertWallet` → bank account section shows status.

### Bank link detection

```typescript
// In ExpertWallet.tsx
const { data: profile } = useUserProfile();   // GET /users/me
const isBankLinked = !!(profile?.sepay_bank_account_xid || profile?.bank_linked_at);
```

**Hook:** `useUserProfile()` from `frontend/src/hooks/use-wallet.ts`

```
GET /users/me
QueryKey: ['user', 'profile']
```

If not linked → amber "Not Linked" badge → **"Link Bank Account"** button → `navigate('/expert/wallet/link-bank')`.

### Components

| Component | File |
|---|---|
| `ExpertWallet` | `frontend/src/features/expert/wallet/ExpertWallet.tsx` |
| `BankHubLink` | `frontend/src/features/expert/wallet/BankHubLink.tsx` |

### API call (in `BankHubLink.tsx`)

```
POST /bank-hub/initiate-link
Body: {
  bankAccountXid: string,
  holderName: string
}
Response: { success: true }
```

On success: navigate back to `/expert/wallet` → bank status shows green "Linked" badge. No SePay OTP/callback involved — the XID is saved directly per current implementation.

---

---

# Complete API & Hook Reference

| Hook | File | Endpoint | Method | QueryKey / Purpose |
|---|---|---|---|---|
| `useAuth().register` | `hooks/use-auth.ts` | `/auth/register` | POST | Registration |
| `useAuth().login` | `hooks/use-auth.ts` | `/auth/login` | POST | Sign in |
| `useAuth().logout` | `hooks/use-auth.ts` | — | — | Clears store + React Query |
| `useAuth().switchRole` | `hooks/use-auth.ts` | `/auth/switch-role` | PUT | Role switch (dual-role users) |
| `useAuth().addRole` | `hooks/use-auth.ts` | `/users/me/add-role` | POST | Add second role |
| `useAuth().registerHandoff` | `hooks/use-auth.ts` | `/auth/register/handoff` | POST | Tech Team registration |
| `useWallet()` | `hooks/use-wallet.ts` | `/wallets/me` | GET | `['wallet']` — balance display |
| `useWalletTransactions()` | `hooks/use-wallet.ts` | `/wallets/me/transactions` | GET | `['wallet','transactions',limit]` |
| `useTopUpWallet()` | `hooks/use-wallet.ts` | `/wallets/virtual-accounts/topup` | POST | Generate QR code |
| `useUserProfile()` | `hooks/use-wallet.ts` | `/users/me` | GET | `['user','profile']` — bank link status |
| `useSubscriptionStatus()` | `hooks/use-subscription.ts` | `/subscriptions/status` | GET | `['subscriptionStatus']` — tier gates |
| `useSubscription().activateSubscription` | `hooks/use-subscription.ts` | `/subscriptions/activate` | POST | Activate Pro tier |
| `useExpertProfile()` | `hooks/use-expert-profile.ts` | `/expert-profile/me` | GET | `['expert-profile','me']` |
| `useExpertProfile().saveDomains` | `hooks/use-expert-profile.ts` | `/expert-profile/domains/sync` | PUT | Sync domain depth claims |
| `useExpertProfile().saveSeams` | `hooks/use-expert-profile.ts` | `/expert-profile/seams/sync` | PUT | Sync seam claims |
| `useExpertProfile().saveStackAndModel` | `hooks/use-expert-profile.ts` | `/expert-profile/me` | PUT | Save stack/bio/model |
| `useUpdateDomainDepth()` | `hooks/use-expert-profile.ts` | `/expert-profile/domains/:id` | PUT | Individual depth update |
| `usePortfolio().submitPortfolio` | `hooks/use-portfolio.ts` | `/portfolio-submissions` | POST | Submit Tier 2 evidence |
| `createSession()` | `hooks/use-elicitation.ts` | `/elicitation/sessions` | POST | Create/start elicitation |
| `getSession()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id` | GET | Poll session state |
| `getActiveSession()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/active` | GET | Resume active session |
| `submitStage1()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/stage1` | PUT | Symptom extraction (LLM) |
| `submitStage2()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/stage2` | PUT | Archetype selection |
| `submitStage3()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/stage3` | PUT | Probe answers + vagueness check |
| `submitStage4()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/stage4` | PUT | CEO tech context (auto-chains Stage 5) |
| `submitStage4Handoff()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/stage4-handoff` | PUT | Tech Team tech context |
| `recommendStage4()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/stage4-recommend` | POST | AI-recommended tech context |
| `inviteTechTeam()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/generate-handoff-link` | POST | Generate handoff link |
| `saveDraft()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/draft` | PATCH | Auto-save symptom text |
| `retrySynthesis()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/retry-synthesis` | POST | Retry failed synthesis |
| `revertSession()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/revert` | PUT | Return to earlier stage |
| `setSelfTechnical()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/self-technical` | PUT | Toggle CEO tech flag |
| `abandonSession()` | `hooks/use-elicitation.ts` | `/elicitation/sessions/:id/abandon` | PUT | Discard session |

---

# MF-1 Elicitation Flow (bonus — unlocked after subscription)

This is the core feature unlocked by Client Pro. Route: `/ceo/elicitation` → `ElicitationWizard`.

**Component:** `frontend/src/features/ceo/elicitation/ElicitationWizard.tsx`  
**State management:** `useReducer` with `wizardReducer` (not useState)

### Wizard initialization

```typescript
// On mount (useEffect):
1. Check location.state.resumeSessionId
   → if present: getSession(resumeSessionId)
   → else: getActiveSession()          // GET /elicitation/sessions/active
   → if 404/error: createSession()     // POST /elicitation/sessions

2. If session.state === "COMPLETED" or "RETURNED":
   → getSession(id) again for full gate result

3. dispatch INIT_SUCCESS → sets sessionId, currentStage, sessionState, archetype
```

If any call returns 403 with subscription message → `navigate('/ceo/subscription', { replace: true })`.

### Stage routing (inside the Card)

```typescript
currentStage === 1  → <Stage1Symptoms />
currentStage === 2  → <Stage2Archetype />
currentStage === 3  → <Stage3Probes />
currentStage === 4  → user.selfTechnical || forceScenarioA
                         ? <Stage4ScenarioA />
                         : <Stage4ScenarioB />
currentStage === 5  → <Stage5Loading />

sessionState=COMPLETED && gateResult.gate_passed     → <QualityGatePassed />
sessionState=RETURNED  && !gateResult.gate_passed    → <QualityGateFailed />
```

### Stage 1 — Symptom Intake

**Component:** `Stage1Symptoms.tsx`  
**Sub-states:** input screen → submitting (spinner) → results screen (voids)

- Draft auto-saved to `localStorage` + debounced `PATCH /elicitation/sessions/:id/draft` every 2 seconds while typing; immediate save on blur.
- Min 10 chars to submit (matches backend `@MinLength(10)`).
- After submit cooldown: 10-second client-side timer prevents re-submit on error.
- **If voids returned:** shows void list with severity chips (HIGH/MEDIUM/LOW); all HIGH-severity voids must be individually acknowledged (checkbox) before "Continue to Stage 2" activates.
- **If no voids:** automatically calls `onComplete()` → stage advances to 2.

```
PUT /elicitation/sessions/:id/stage1
Body: { symptomText: string }
Timeout: 120,000ms
Returns: { voidListJson, recommendedArchetypesJson, currentStage: 2, ... }
```

### Stage 2 — Archetype Selection

**Component:** `Stage2Archetype.tsx`  
Six archetype cards rendered from `ARCHETYPES` constant in `use-elicitation.ts`:

| Code | Label |
|---|---|
| 1 | AI Search & Q&A |
| 2 | Personalisation & Recs |
| 3 | Classification & Docs |
| 4 | Conversational Agent |
| 5 | Predictive Analytics |
| 6 | AI Process Automation |

**Validation:** Selected archetype must be in `recommendedArchetypesJson` from Stage 1 response. Non-recommended codes → backend returns 422. Frontend enforces this by only enabling selectable archetypes from the recommended list.

```
PUT /elicitation/sessions/:id/stage2
Body: { archetype: "1", acknowledgedVoidCodes?: string[] }
Returns: { currentStage: 3, ... }
```

### Stage 3 — Architecture Probes

**Component:** `Stage3Probes.tsx`  
Four probe questions, archetype-specific. Question set is hardcoded in `PROBES` map in `use-elicitation.ts`, keyed by archetype code.

**Vagueness check:** If answers are too vague, backend returns `{ advanced: false, flagged_questions: [...] }` without advancing `currentStage`. Stage3 re-renders with flagged questions highlighted and user must improve their answers before re-submitting.

```
PUT /elicitation/sessions/:id/stage3
Body: { probeResponses: { q1: string, q2: string, q3: string, q4: string } }
Returns: { advanced: boolean, currentStage, flaggedQuestions? }
```

### Stage 4 — Tech Context (Scenario A or B)

**Condition for Scenario A (CEO fills directly):**
```typescript
user?.selfTechnical || state.forceScenarioA
  → <Stage4ScenarioA />
```

**Condition for Scenario B (delegate to Tech Team):**
```typescript
!user?.selfTechnical && !state.forceScenarioA
  → <Stage4ScenarioB />
```

**Stage 4 Scenario A** (`Stage4ScenarioA.tsx`):
- Fields: scale & infrastructure, integration method, legacy volume, schemas, contracts.
- Submits to `PUT /elicitation/sessions/:id/stage4`.
- This **auto-chains Stage 5 synthesis** — the PUT response includes the gate result directly.
- Timeout: 120,000ms.

**Stage 4 Scenario B** (`Stage4ScenarioB.tsx`):
- CEO generates a handoff link via `POST /elicitation/sessions/:id/generate-handoff-link`.
- Link shared externally (Slack, email, etc.) — platform doesn't send emails.
- CEO can also click "Fill in myself" → `handleSetSelfTechnical(true)` → sets `forceScenarioA = true` → switches to Scenario A.
- `Stage4HandoffLink.tsx` — shows the generated invite link + 72h expiry.
- CEO polls `GET /elicitation/sessions/:id` every few seconds waiting for `currentStage >= 5`.

**Stage 4 Handoff** (Tech Team fills):
- `submitStage4Handoff()` → `PUT /elicitation/sessions/:id/stage4-handoff`.
- Auto-chains Stage 5 synthesis.

### Stage 5 — Synthesis Loading

**Component:** `Stage5Loading.tsx`  
Stage 5 is auto-chained from Stage 4 — the backend runs it internally. Stage5Loading polls `GET /elicitation/sessions/:id` to check for the final result.

**Gate result shape:**

```typescript
// gate_passed = true
{
  gate_passed: true,
  completeness_score: number,
  project_id: string
}

// gate_passed = false
{
  gate_passed: false,
  completeness_score: number,
  flagged_void: string,
  return_to_stage: number,
  advisory_note: string
}
```

### Quality Gate Results

**PASS** → `<QualityGatePassed />` — shows "Project Published!", completeness score, link to shortlist.

**FAIL** → `<QualityGateFailed />` — shows advisory note, which stage to return to, two options:
- "Return to Stage X" → calls `revertSession(sessionId, stage)` → `PUT .../revert` → dispatches `RETURN_TO_STAGE`.
- "Start Over" → calls `abandonSession()` + `createSession()`.

---

# Flow Summary Diagrams

## MF-1: CEO Flow

```
/ (LandingPage)
  ↓ click CTA
[AuthModal] — mode: signup, role: CLIENT_CEO
  ↓ POST /auth/register
  ↓ GET /users/me
/ceo (CeoDashboard)
  │  useSubscriptionStatus() → tier: "free"
  │  → Upgrade banner visible
  │  → Elicitation button disabled
  │
  ├─ /ceo/wallet (WalletTopUp)
  │     POST /wallets/virtual-accounts/topup → QR displayed
  │     SePay IPN → wallet credited (async, backend only)
  │     useWallet() refetches → balance visible
  │
  ├─ /ceo/subscription (SubscriptionActivate CEO)
  │     canAfford = balance >= 500,000
  │     POST /subscriptions/activate { activeRole: "CLIENT" }
  │     → new JWT stored → users/me fetched
  │     → isPro = true → back to /ceo
  │
  └─ /ceo/elicitation (ElicitationWizard — now accessible)
        Stage 1: PUT /stage1 (LLM, ~20s)   → voids shown, acknowledge HIGH voids
        Stage 2: PUT /stage2               → archetype from recommended list
        Stage 3: PUT /stage3               → 4 probe Qs, vagueness check
        Stage 4: PUT /stage4               → tech context (CEO) auto-chains synthesis
           OR: generate-handoff-link       → Tech Team fills via stage4-handoff
        Stage 5: (auto) GET poll           → gate result
        → PASS: /ceo/shortlist/:projectId
        → FAIL: advisory + return to stage
```

## MF-2: Expert Flow

```
/ (LandingPage)
  ↓ click CTA
[AuthModal] — mode: signup, role: EXPERT
  ↓ POST /auth/register
  ↓ GET /users/me
/expert (ExpertDashboard)
  │  useSubscriptionStatus() → tier: "free"
  │  → Upgrade banner visible
  │
  ├─ /expert/expert-profile (ExpertProfilePage)
  │     GET /expert-profile/me → empty profile
  │     → "Incomplete Profile" alert
  │     → [Edit Profile] → ProfileBuilder opens
  │
  │     DomainDepthGrid  → PUT /expert-profile/domains/sync
  │     SeamClaimsGrid   → PUT /expert-profile/seams/sync   (CLAIMED)
  │     StackTagsPicker  → PUT /expert-profile/me
  │
  │     [Verify a Seam] → PortfolioSubmitForm
  │       (requires Expert Pro — 403 otherwise)
  │       POST /portfolio-submissions (LLM eval, ~10-30s)
  │       → APPROVED: seam = EVIDENCE_BACKED + Tier2Success
  │       → REJECTED: Tier2Rejected (attemptsRemaining)
  │       → count≥5:  VerificationLockout (30 days)
  │
  ├─ /expert/wallet (ExpertWallet)
  │     POST /wallets/virtual-accounts/topup → QR
  │     GET /users/me → check bank link status
  │     → /expert/wallet/link-bank (BankHubLink)
  │         POST /bank-hub/initiate-link
  │
  └─ /expert/subscription (ExpertSubscriptionActivate)
        canAfford = balance >= 300,000
        POST /subscriptions/activate { activeRole: "EXPERT" }
        → new JWT → isPro = true → back to /expert
        → PortfolioSubmitForm now accessible
```

---

# Known Discrepancies vs Spec

| # | Spec (`08-mainflows_redo.md`) | Actual FE code | Impact |
|---|---|---|---|
| 1 | `POST /generate-handoff-link` takes **no body** | `inviteTechTeam()` sends `{ email }` in body | Confirm with BE if email field is silently ignored |
| 2 | Stage 5 synthesis auto-chained from Stage 4 PUT | `submitStage5()` function exists calling `POST .../stage5` | Function appears unused; `Stage5Loading` polls GET instead |
| 3 | `WalletTopUp.canContinue` threshold is 500,000 | Hardcoded for CEO; Expert subscription costs 300,000 | Expert top-up page (`ExpertWallet`) doesn't reuse this threshold check |
| 4 | `lockedUntil` returned by backend on rejection | 201 response doesn't include `lockedUntil`; FE computes `now + 30d` client-side | Could display wrong date if server uses different window |
| 5 | Subscription data from `GET /subscriptions/status` | Also still read from `user.subscriptionTier` in some older store paths | Subscription-specific UI now correctly uses `useSubscriptionStatus()` after recent migration |
