# Task Assignment — Minh Thức (Expert Profile Builder + Tech Team Stage 4)

> **For any questions about UI behavior, API contracts, or mock data — refer to the Master Integration Docs (File 1 & File 2) FIRST before asking teammates.**

## Your Role Tonight

Minh Thức, you're building the **Expert Profile Builder** (the shell that ties together Khang's domain/seam components) plus the **Tech Team Stage 4 form**. You're the bridge between Khang's profile components and Minh's elicitation wizard — your ProfileBuilder is what the Expert sees after registration, and your Stage4Form is what the Tech Team sees after clicking the handoff link.

---

## Your Assigned Screens (4 components, ~600 lines total)

| # | File | Priority | Lines Est. | APIs | Ref |
|---|---|---|---|---|---|
| 1 | `features/expert/profile/ProfileBuilder.tsx` | 🔴 P0 | ~180 | `GET /expert-profile/me` (to load existing state) | File 2 → Screen 2 |
| 2 | `features/expert/profile/StackTagsPicker.tsx` | 🔴 P0 | ~200 | `PUT /expert-profile/me` | File 2 → Screen 5 |
| 3 | `features/tech-team/stage4/Stage4Form.tsx` | 🟡 P1 | ~180 | `PUT /elicitation/sessions/:id/stage4-handoff` | File 2 → Screen 12 |
| 4 | `features/tech-team/stage4/Stage4Submitted.tsx` | 🟡 P1 | ~50 | None (display only) | File 2 → Screen 13 |

---

## Architecture Overview

### ProfileBuilder (Parent Shell)
```
ProfileBuilder (you build this)
  ├── Tab 1: DomainDepthGrid    (Khang builds)
  ├── Tab 2: SeamClaimsGrid     (Khang builds)
  ├── Tab 3: StackTagsPicker    (you build this)
  └── Tab 4: Profile Review     (you build inside ProfileBuilder)
```

### Tech Team Stage 4
```
CEO generates handoff link (already built by Minh — Stage4ScenarioB)
  → Tech Team clicks link → registers → sees Stage4Form (you build)
  → Submit → Stage4Submitted (you build)
  → CEO's polling detects completion → advances wizard
```

---

## Task 1: ProfileBuilder.tsx (PARENT SHELL — START HERE FIRST)

**File**: `frontend/src/features/expert/profile/ProfileBuilder.tsx`
**Ref**: File 2 → Section "SCREEN 2: Profile Builder — Shell"
**Route**: `/expert/profile`
**API**: `GET /expert-profile/me` (to load existing state)

### What to Build
A tabbed form shell with 4 tabs:
1. **Domains** → renders `<DomainDepthGrid />` (Khang's component)
2. **Seams** → renders `<SeamClaimsGrid />` (Khang's component)  
3. **Tags** → renders `<StackTagsPicker />` (you build)
4. **Review** → shows summary of everything (you build)

### Key State
```ts
const [activeTab, setActiveTab] = useState<'domains' | 'seams' | 'tags' | 'review'>('domains');
const [selectedDomains, setSelectedDomains] = useState<any[]>([]);
const [selectedSeams, setSelectedSeams] = useState<any[]>([]);
const [stackTags, setStackTags] = useState<string[]>([]);
const [engagementModel, setEngagementModel] = useState<string>('MILESTONE');
const [isLoading, setIsLoading] = useState(true);

// On mount: load existing profile data
useEffect(() => {
  apiClient.get('/expert-profile/me').then(({ data }) => {
    if (data.domainDepths?.length) setSelectedDomains(data.domainDepths);
    if (data.seamClaims?.length) setSelectedSeams(data.seamClaims);
    if (data.profile?.stackTagsJson?.length) setStackTags(data.profile.stackTagsJson);
    if (data.profile?.engagementModel) setEngagementModel(data.profile.engagementModel);
    setIsLoading(false);
  }).catch(() => setIsLoading(false));
}, []);
```

### Tab Navigation
```tsx
<div className="flex border-b mb-6">
  {[
    { key: 'domains', label: '1. Domains', done: selectedDomains.length > 0 },
    { key: 'seams',   label: '2. Seams',   done: selectedSeams.length > 0 },
    { key: 'tags',    label: '3. Stack',   done: stackTags.length > 0 },
    { key: 'review',  label: '4. Review',  done: false },
  ].map(tab => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key as any)}
      className={`px-4 py-2 border-b-2 font-medium text-sm
        ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
    >
      {tab.label}
      {tab.done && <span className="ml-1 text-green-500">✓</span>}
    </button>
  ))}
</div>
```

### Tab Content Rendering
```tsx
{activeTab === 'domains' && (
  <DomainDepthGrid 
    onSave={(domains) => {
      setSelectedDomains(domains);
      setActiveTab('seams');
    }} 
  />
)}
{activeTab === 'seams' && (
  <SeamClaimsGrid 
    onSave={(seams) => {
      setSelectedSeams(seams);
      setActiveTab('tags');
    }} 
  />
)}
{activeTab === 'tags' && (
  <StackTagsPicker 
    initialTags={stackTags}
    initialModel={engagementModel}
    onSave={(tags, model) => {
      setStackTags(tags);
      setEngagementModel(model);
      setActiveTab('review');
    }} 
  />
)}
{activeTab === 'review' && (
  <ProfileReview 
    domains={selectedDomains}
    seams={selectedSeams}
    tags={stackTags}
    model={engagementModel}
    onPublish={handlePublish}
    onEdit={(tab) => setActiveTab(tab)}
  />
)}
```

### Profile Review Tab (built inline in ProfileBuilder)
Show all selected data in cards:
```tsx
<div className="space-y-6">
  <h3 className="text-lg font-bold">Review Your Profile</h3>
  
  {/* Domains */}
  <div className="bg-white rounded-lg p-4 border">
    <h4 className="font-semibold">Domain Expertise</h4>
    {selectedDomains.map(d => (
      <div key={d.domainCode} className="flex justify-between py-2 border-b">
        <span>{d.domainCode} · {getDomainLabel(d.domainCode)}</span>
        <span className="font-bold">{d.depthLevel}</span>
      </div>
    ))}
    <button onClick={() => onEdit('domains')} className="text-blue-600 text-sm mt-2">Edit Domains</button>
  </div>
  
  {/* Seams, Tags, Model — same pattern */}
  
  {/* Publish button */}
  <button onClick={onPublish} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">
    ✅  Publish Profile
  </button>
</div>
```

### handlePublish
```ts
const handlePublish = async () => {
  // All data already saved from individual tabs.
  // This is the final confirmation — show success and redirect.
  // No additional API call needed (each tab already POSTed).
  toast.success("Profile published! You are now visible to CEOs looking for AI experts.");
  navigate('/expert');
};
```

### Loading State
```tsx
if (isLoading) return <div className="text-center py-12"><Spinner /> Loading profile...</div>;
```

---

## Task 2: StackTagsPicker.tsx

**File**: `frontend/src/features/expert/profile/StackTagsPicker.tsx`
**Ref**: File 2 → Section "SCREEN 5: Stack Tags & Engagement Model"
**API**: `PUT /expert-profile/me`

### What to Build
A tag input (type + Enter to add, × to remove) + engagement model radio buttons.

### Props
```ts
interface StackTagsPickerProps {
  initialTags: string[];
  initialModel: string;
  onSave: (tags: string[], model: string) => void;
}
```

### Tag Input Pattern
```tsx
const [tags, setTags] = useState<string[]>(initialTags);
const [inputValue, setInputValue] = useState('');
const [model, setModel] = useState(initialModel);

const addTag = () => {
  const trimmed = inputValue.trim();
  if (trimmed && !tags.includes(trimmed)) {
    setTags([...tags, trimmed]);
  }
  setInputValue('');
};

const removeTag = (tag: string) => {
  setTags(tags.filter(t => t !== tag));
};

// Enter key handler
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTag();
  }
};
```

### Render Tags as Chips
```tsx
<div className="flex flex-wrap gap-2 mt-3">
  {tags.map(tag => (
    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
      {tag}
      <button onClick={() => removeTag(tag)} className="hover:text-red-600">×</button>
    </span>
  ))}
</div>
```

### Suggested Tags (click to add)
```tsx
const SUGGESTED_TAGS = ['Python', 'TypeScript', 'React', 'Next.js', 'Docker', 'Kubernetes', 
  'TensorFlow', 'PyTorch', 'LangChain', 'Kafka', 'PostgreSQL', 'Redis', 'AWS', 'GCP'];

<div className="flex flex-wrap gap-2 mt-2">
  {SUGGESTED_TAGS.filter(t => !tags.includes(t)).slice(0, 8).map(tag => (
    <button key={tag} onClick={() => setTags([...tags, tag])}
      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600">
      + {tag}
    </button>
  ))}
</div>
```

### Engagement Model Radio Buttons
```tsx
const MODELS = [
  { value: 'MILESTONE', label: 'Milestone-based', desc: 'Fixed-price per milestone, clear deliverables' },
  { value: 'HOURLY',     label: 'Hourly',         desc: 'Bill by the hour, flexible scope' },
  { value: 'HYBRID',     label: 'Hybrid',         desc: 'Mix of milestone + hourly for discovery phases' },
];

{MODELS.map(m => (
  <label key={m.value} className={`block p-4 border rounded-lg cursor-pointer mb-2
    ${model === m.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
    <input type="radio" name="model" value={m.value} checked={model === m.value}
      onChange={() => setModel(m.value)} className="mr-2" />
    <span className="font-semibold">{m.label}</span>
    <p className="text-sm text-gray-500 ml-6">{m.desc}</p>
  </label>
))}
```

### Save Handler
```ts
const handleSave = async () => {
  try {
    await apiClient.put('/expert-profile/me', {
      engagementModel: model,
      stackTagsJson: tags,
      archetypeHistoryJson: [],
    });
    onSave(tags, model);
  } catch (error: any) {
    alert(error.response?.data?.message || 'Failed to save profile');
  }
};
```

---

## Task 3: Stage4Form.tsx (TECH TEAM)

**File**: `frontend/src/features/tech-team/stage4/Stage4Form.tsx`
**Ref**: File 2 → Section "SCREEN 12: Tech Team — Stage 4 Form"
**API**: `PUT /elicitation/sessions/:sessionId/stage4-handoff`

### What to Build
A form identical to Stage4ScenarioA (CEO tech context), but for Tech Team. 3 textareas + 2 URL list inputs.

### Step 1: Get sessionId
The sessionId is embedded in the handoff invite JWT. Extract it:

```ts
// Option A: stored in auth or URL param
const sessionId = useAuthStore(s => s.handoffSessionId);

// Option B: decode from invite token (if available)
const inviteToken = new URLSearchParams(window.location.search).get('token');
const sessionId = inviteToken 
  ? JSON.parse(atob(inviteToken.split('.')[1])).sessionId 
  : null;
```

**Coordinate with Khang/Nhan on where sessionId gets stored after handoff registration.**

### Form Fields
Same structure as Stage4ScenarioA:
```json
{
  "scaleAndInfrastructure": "We are on GCP GKE, autoscaling 200-800 nodes...",
  "integrationMethod": "Pub/Sub with BigQuery sink for analytics...",
  "legacyVolume": "4 years of transaction data, ~3TB in BigQuery...",
  "schemas": ["https://company.com/schema.json"],
  "contracts": ["https://company.com/api-spec.yaml"]
}
```

### Submit Handler
```ts
const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    const { data } = await apiClient.put(
      `/elicitation/sessions/${sessionId}/stage4-handoff`,
      {
        scaleAndInfrastructure,
        integrationMethod,
        legacyVolume,
        schemas: schemaUrls,
        contracts: contractUrls,
      }
    );
    setIsSubmitting(false);
    onComplete(data); // triggers Stage4Submitted
  } catch (error: any) {
    setIsSubmitting(false);
    setError(error.response?.data?.message || 'Submission failed');
  }
};
```

### URL List Input (same as Stage4ScenarioA)
```tsx
// Schemas input
<div className="mb-4">
  <label className="block font-semibold mb-1">Schemas / Data Models (optional)</label>
  <div className="flex gap-2">
    <input value={schemaInput} onChange={e => setSchemaInput(e.target.value)}
      placeholder="https://..." className="flex-1 border rounded px-3 py-2" />
    <button onClick={addSchema} className="px-4 py-2 bg-gray-100 rounded">Add</button>
  </div>
  <div className="flex flex-wrap gap-2 mt-2">
    {schemaUrls.map((url, i) => (
      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
        {url.substring(0, 40)}...
        <button onClick={() => removeSchema(i)}>×</button>
      </span>
    ))}
  </div>
</div>
```

### Loading State
```tsx
{isSubmitting && (
  <div className="text-center py-8">
    <Spinner />
    <p className="mt-2">Submitting technical context...</p>
  </div>
)}
```

### Mock
```ts
const mockSubmit = async () => {
  await new Promise(r => setTimeout(r, 1000));
  return {
    data: {
      id: sessionId,
      currentStage: 5,
      state: "IN_PROGRESS",
      updatedAt: new Date().toISOString(),
    }
  };
};
```

---

## Task 4: Stage4Submitted.tsx (DISPLAY ONLY)

**File**: `frontend/src/features/tech-team/stage4/Stage4Submitted.tsx`
**Ref**: File 2 → Section "SCREEN 13: Stage 4 Submitted"
**No APIs — pure display**

### What to Build
Success confirmation screen after Tech Team submits Stage 4.

### UI
```tsx
<div className="text-center py-12">
  <div className="text-6xl mb-4">✅</div>
  <h2 className="text-2xl font-bold">Technical Context Submitted!</h2>
  <p className="text-slate-600 mt-2 max-w-md mx-auto">
    Your technical details have been sent to the AI system.
    The CEO will be notified when the project is published.
  </p>
  <p className="text-slate-500 mt-4 text-sm">
    You'll be able to review bids and verify deliverables
    once the project is matched with an expert.
  </p>
  <button onClick={() => navigate('/tech-team')} 
    className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">
    Go to Dashboard
  </button>
</div>
```

---

## Route Setup

Add these routes to `App.tsx`:

```tsx
// Expert profile builder (inside existing EXPERT role guard)
<Route path="/expert/profile" element={<ProfileBuilder />} />

// Tech Team stage 4 is already inside TechTeamDashboard — 
// just need to render Stage4Form/Stage4Submitted conditionally there
```

For the Tech Team dashboard, render conditionally:
```tsx
// Inside TechTeamDashboard.tsx
{handoffSessionId && !stage4Submitted && (
  <Stage4Form sessionId={handoffSessionId} onComplete={() => setStage4Submitted(true)} />
)}
{stage4Submitted && <Stage4Submitted />}
```

---

## Your Schedule Tonight

| Time | Task |
|------|------|
| 7:00–7:45 PM | ProfileBuilder.tsx (tab shell + review tab) |
| 7:45–8:30 PM | StackTagsPicker.tsx (tag input + engagement model) |
| 8:30–9:00 PM | Coordinate with Khang — verify DomainDepthGrid/SeamClaimsGrid prop interfaces |
| 9:00–9:45 PM | Stage4Form.tsx (Tech Team) |
| 9:45–10:00 PM | Stage4Submitted.tsx (quick display screen) |
| 10:00–10:30 PM | Full test: register Expert → ProfileBuilder → register Tech Team via handoff → Stage4Form |
| 10:30–11:00 PM | Coordinate with Minh — test that Tech Team Stage4Form advances CEO's ElicitationWizard |

---

## Coordination Points

1. **With Khang (CRITICAL)**: He's building `DomainDepthGrid` and `SeamClaimsGrid`. You need to agree on:
   ```ts
   // DomainDepthGrid props:
   { onSave: (domains: Array<{ domainCode: string; depthLevel: string }>) => void }
   
   // SeamClaimsGrid props:
   { onSave: (seams: Array<{ code: string; ... }>) => void }
   ```
   **Contact Khang at 8:30 PM sharp to sync interfaces.**

2. **With Minh**: He's building the CEO's `ElicitationWizard.tsx`. When your Tech Team `Stage4Form` submits successfully, the CEO's wizard needs to detect it via polling. Make sure your submit calls `PUT /elicitation/sessions/:id/stage4-handoff` with the correct `sessionId`. Minh's `Stage4ScenarioB.tsx` is already doing polling — coordinate that the sessionId is shared.

3. **With Nhan (Backend)**: The `stage4-handoff` endpoint requires `clientSubtype === 'TECH_TEAM'` in the JWT. Make sure the Tech Team's auth token has this claim after registering via handoff.

---

## Files You Can Reference (Already Built)

- `features/expert/wallet/ExpertWallet.tsx` — form layout patterns
- `features/expert/onboarding/SubscriptionActivate.tsx` — multi-step form patterns
- `components/wallet/WalletPage.tsx` — tabbed interface patterns
- `features/ceo/CeoDashboard.tsx` — dashboard shell pattern

---

*Good luck, Minh Thức! You're the bridge between Khang's profile components and Minh's elicitation flow. 🚀*
