# Task Assignment — Khang (Current UI Owner)

> **For any questions about UI behavior, API contracts, or mock data — refer to the Master Integration Docs (File 1 & File 2) FIRST before asking teammates.**

## Your Role Tonight

Khang, you're the one who already has the most FE built. Your job tonight is to finish the **Expert Profile & Verification screens** (MF-2, Phase B & C). These are the screens that let an Expert build their capability profile and submit portfolio evidence for Tier 2 verification.

You already have the authentication, wallet, and dashboard infrastructure wired — reuse those patterns.

---

## Your Assigned Screens (5 components, ~1,200 lines total)

| # | File | Priority | Lines Est. | APIs | Ref |
|---|---|---|---|---|---|
| 1 | `features/expert/profile/DomainDepthGrid.tsx` | 🔴 P0 | ~300 | `POST /expert-profile/domains` (×N) | File 2 → Screen 3 |
| 2 | `features/expert/profile/SeamClaimsGrid.tsx` | 🔴 P0 | ~250 | `POST /expert-profile/seams` (×N) | File 2 → Screen 4 |
| 3 | `features/expert/verification/PortfolioSubmitForm.tsx` | 🔴 P0 | ~350 | `POST /portfolio-submissions` + `GET /expert-profile/me` | File 2 → Screen 8 |
| 4 | `features/expert/verification/Tier2Success.tsx` | 🟡 P1 | ~80 | None (display only) | File 2 → Screen 9 |
| 5 | `features/expert/verification/Tier2Rejected.tsx` | 🟡 P1 | ~100 | None (display only) | File 2 → Screen 10 |
| 6 | `features/expert/verification/VerificationLockout.tsx` | 🟡 P1 | ~80 | None (display only) | File 2 → Screen 11 |

---

## Task 1: DomainDepthGrid.tsx

**File**: `frontend/src/features/expert/profile/DomainDepthGrid.tsx`
**Ref**: File 2 → Section "SCREEN 3: Domain Depths Grid"
**API**: `POST /expert-profile/domains` — one call per domain selected
**Props from parent (ProfileBuilder)**: `{ onSave: (domains: DomainDepth[]) => void }`

### What to Build
A grid with 6 rows (domains A-F) × 3 radio buttons per row (SURFACE / OPERATIONAL / DEEP).

### Step-by-Step
1. **Create the component** with this interface:
```ts
interface DomainDepth {
  domainCode: string;     // "A" | "B" | "C" | "D" | "E" | "F"
  depthLevel: "SURFACE" | "OPERATIONAL" | "DEEP" | null;
}
```

2. **Hardcode the domain data** (copy from File 2, Screen 3)

3. **Render the grid** — each row has:
   - Domain label (e.g., "A · LLM App Engineering")
   - Description hint below
   - 3 radio buttons: SURFACE / OPERATIONAL / DEEP
   - Highlight row if selected

4. **"Save & Continue" button** — collect all domains with non-null depth, POST each one:
```ts
const handleSave = async () => {
  const selectedDomains = domainStates.filter(d => d.depthLevel !== null);
  const results = await Promise.all(
    selectedDomains.map(d =>
      apiClient.post('/expert-profile/domains', {
        domainCode: d.domainCode,
        depthLevel: d.depthLevel,
      })
    )
  );
  props.onSave(selectedDomains);
};
```

5. **Loading state**: Show spinner while POSTs are in flight
6. **Error state**: Show inline error banner if any POST fails

### Mock Data (use while BE is being tested)
```ts
// Each POST response mock:
const mockResponse = (code: string, depth: string) => ({
  data: {
    id: `mock-domain-${code}-${Date.now()}`,
    expertId: "mock-expert-id",
    domainCode: code,
    depthLevel: depth,
    verificationTier: "CLAIMED",
  }
});
```

### Dependencies
- `ProfileBuilder.tsx` (Minh Thức) — this component is rendered as a child tab inside it
- Coordinate with Minh Thức on the `onSave` prop signature

---

## Task 2: SeamClaimsGrid.tsx

**File**: `frontend/src/features/expert/profile/SeamClaimsGrid.tsx`
**Ref**: File 2 → Section "SCREEN 4: Seam Claims Grid"
**API**: `POST /expert-profile/seams` — one call per seam selected
**Props from parent**: `{ onSave: (seams: SeamClaim[]) => void }`

### What to Build
A checkbox list of 10 seams with descriptions. User checks 2-5 seams they have experience in.

### Step-by-Step
1. **Hardcode the seam data** (copy from File 2, Screen 4)

2. **Render checkboxes** — each seam has:
   - Checkbox with seam code (e.g., "A↔C")
   - Label: "Ground truth-driven iteration"
   - Description below

3. ⚠️ **Arrow encoding**: The `↔` character must be exact Unicode U+2194. Copy from this file.

4. **"Save & Continue"** — POST each checked seam:
```ts
const handleSave = async () => {
  const selectedSeams = seamStates.filter(s => s.checked);
  const results = await Promise.all(
    selectedSeams.map(s =>
      apiClient.post('/expert-profile/seams', { seamCode: s.code })
    )
  );
  props.onSave(selectedSeams);
};
```

5. **Show count**: "Selected: 3 seams" below the list

### Mock Data
```ts
const mockResponse = (code: string) => ({
  data: {
    id: `mock-seam-${Date.now()}`,
    expertId: "mock-expert-id",
    seamCode: code,
    verificationTier: "CLAIMED",
    submissionCount: 0,
    lockedUntil: null,
  }
});
```

### Dependencies
- `ProfileBuilder.tsx` (Minh Thức)

---

## Task 3: PortfolioSubmitForm.tsx

**File**: `frontend/src/features/expert/verification/PortfolioSubmitForm.tsx`
**Ref**: File 2 → Section "SCREEN 8: Portfolio Submission Form"
**APIs**: `GET /expert-profile/me` (fetch eligible seams) + `POST /portfolio-submissions` (submit)

### What to Build
A form where an Expert selects a seam, writes a project description and decision points, and submits for AI evaluation. This is the most complex form — it takes 10-30 seconds for the AI response.

### Step-by-Step

**Step 1: Fetch eligible seams**
```ts
useEffect(() => {
  apiClient.get('/expert-profile/me').then(({ data }) => {
    const eligible = data.seamClaims.filter(
      (s: any) => s.verificationTier === 'CLAIMED' && 
        (!s.lockedUntil || new Date(s.lockedUntil) < new Date())
    );
    setEligibleSeams(eligible);
  });
}, []);
```

**Step 2: Render the form**
- Dropdown to select a seam (populated from `eligibleSeams`)
- Large textarea for `projectDescription` (min 50 chars, show char counter)
- Large textarea for `decisionPoints` (min 20 chars, show char counter)
- Show attempts remaining info (from seam claim data)
- Submit button: "Submit for AI Evaluation"

**Step 3: Handle submission**
```ts
const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    const { data } = await apiClient.post('/portfolio-submissions', {
      seamClaimId: selectedSeam.id,
      projectDescription: description,
      decisionPoints: decisions,
    });
    setIsSubmitting(false);
    
    if (data.status === 'APPROVED') {
      showResult('success', data);
    } else {
      showResult('rejected', data);
    }
  } catch (error: any) {
    setIsSubmitting(false);
    if (error.response?.status === 429) {
      showLockout(error.response.data);
    } else {
      setError(error.response?.data?.message || 'Submission failed');
    }
  }
};
```

**Step 4: Handle the 3 possible outcomes**
| Response | What to Show |
|----------|-------------|
| `status: "APPROVED"` | Render `<Tier2Success seamCode={...} llmConfidence={...} />` |
| `status: "REJECTED"` | Render `<Tier2Rejected seamCode={...} advisoryNote={...} />` |
| `429 TOO_MANY_ATTEMPTS` | Render `<VerificationLockout seamCode={...} lockedUntil={...} />` |

You manage which screen to show via state:
```ts
const [resultView, setResultView] = useState<'form' | 'success' | 'rejected' | 'lockout'>('form');
const [resultData, setResultData] = useState<any>(null);
```

**Step 5: Loading state** — SHOW A BIG LOADING INDICATOR for the 10-30 second wait:
```
⏳  Evaluating your portfolio evidence with AI...
This takes 10–30 seconds. Please wait.
[████████████████████░░░░░░░░] Progress animation
```

### Error Handling Template
```ts
const errorMessages: Record<number, string> = {
  403: "Expert Pro subscription required. Please activate first.",
  404: "Seam claim not found. Please try again.",
  422: "This seam is already verified at a higher tier.",
  503: "AI evaluation service is temporarily unavailable. Please try again in a moment.",
};
```

### Mock
```ts
const USE_MOCK = true;
if (USE_MOCK) {
  await new Promise(r => setTimeout(r, 3000)); // simulate 3s delay
  const mockResult = {
    data: {
      id: "mock-sub-" + Date.now(),
      status: Math.random() > 0.3 ? "APPROVED" : "REJECTED",
      llmConfidence: Math.random() > 0.3 ? 0.91 : 0.62,
      evaluationTierUpgraded: Math.random() > 0.3,
      advisoryNote: Math.random() > 0.3 ? null : "Missing specific decision rationale.",
      evaluatedAt: new Date().toISOString(),
    }
  };
  return mockResult;
}
```

---

## Task 4-6: Display-Only Result Screens

### Tier2Success.tsx (File 2 → Screen 9)
- Props: `{ seamCode, llmConfidence, onClose, onSubmitAnother }`
- Show celebration UI with confidence score
- "Submit Another" button calls `onSubmitAnother`
- "Back to Profile" calls `onClose`
- NO API calls

### Tier2Rejected.tsx (File 2 → Screen 10)
- Props: `{ seamCode, llmConfidence, advisoryNote, attemptsRemaining, onRetry, onClose }`
- Show rejection message with advisory note
- Show attempts remaining: "4 of 5 remaining"
- "Try Again" calls `onRetry`
- "Back to Profile" calls `onClose`
- NO API calls

### VerificationLockout.tsx (File 2 → Screen 11)
- Props: `{ seamCode, lockedUntil, onClose }`
- Show lock icon + unlock date
- "Back to Profile" calls `onClose`
- NO API calls

---

## Your Schedule Tonight

| Time | Task | 
|------|------|
| 7:00–8:30 PM | DomainDepthGrid + SeamClaimsGrid (build + mock + test) |
| 8:30–10:00 PM | PortfolioSubmitForm (build form + 3 result screens + mock) |
| 10:00–10:30 PM | Test: register Expert → build profile → submit portfolio |
| 10:30–11:00 PM | Coordinate with Minh Thức on ProfileBuilder integration |

---

## Coordination Points

1. **With Minh Thức**: He's building `ProfileBuilder.tsx` (the parent shell). Your DomainDepthGrid and SeamClaimsGrid need to fit into his tabs. Agree on prop interfaces:
   - `onSave` callback signature
   - Whether to pass initial data for re-editing

2. **With Minh**: He's building the CEO elicitation wizard. If he finishes early, he can help test your PortfolioSubmitForm since the API pattern (POST + 10-30s wait + polling) is similar to his Stage 1.

---

## Files You Can Reference (Already Built)
- `features/expert/wallet/ExpertWallet.tsx` — wallet UI patterns
- `features/expert/onboarding/SubscriptionActivate.tsx` — subscription form patterns
- `features/ceo/onboarding/SubscriptionActivate.tsx` — success screen patterns
- `components/wallet/VietQRPanel.tsx` — reusable component patterns

---

*Good luck, Khang! 🚀*
