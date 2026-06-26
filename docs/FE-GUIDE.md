# Frontend Developer Guide: MF-1 (CEO Journey) & MF-2 (Expert Journey)

This guide provides a detailed breakdown of the two main flows currently implemented in the AITasker frontend. It maps out screen flows, interactions, hook usage, and the React patterns/knowledge demonstrated for teaching and verification purposes.

---

## 💾 Local Storage Architecture

Before diving into the flows, it's critical to understand the state persistence strategy. The following data is saved in `localStorage`:

1. **`auth-storage` (managed by Zustand Persist)**
   - **What it saves**: `accessToken`, `refreshToken`, and a serialized `user` object containing their profile, `activeRole` (CLIENT_CEO, EXPERT, etc.), and `subscriptionTier`.
   - **What it does**: Persists the user's authentication and authorization state across browser refreshes.
   - **Purpose**: Enables the frontend to maintain a logged-in session, conditionally render UI based on roles/tiers without waiting for a backend API call on every load, and seamlessly attach the `accessToken` to all API requests via the Axios interceptor.

2. **`aitasker-remembered-email`**
   - **What it saves**: The email address of a user.
   - **What it does**: Automatically populates the login email field when the user returns to the login modal.
   - **Purpose**: Improves User Experience (UX) by remembering user credentials if they checked "Remember me" during their last login.

3. **`currentSessionId`**
   - **What it saves**: The UUID of an active Elicitation Session (MF-1).
   - **What it does**: Tracks the CEO's progress in the AI elicitation wizard.
   - **Purpose**: Allows a CEO to leave the wizard, browse other parts of the app (or close the browser), and resume exactly where they left off in the elicitation process without losing their data.

---

## 👔 MF-1: CEO Elicitation Journey

**Goal:** Allow a Client CEO to define an AI project requirement via an AI-assisted elicitation wizard, verify their payment/subscription status, and pass a quality gate.

### Screen Flow
1. **CEO Dashboard** (`/ceo`)
2. **Wallet & Subscription** (`/ceo/wallet`, `/ceo/subscription`)
3. **Elicitation Wizard Shell** (`/ceo/elicitation`)
   - Stage 1: Symptoms Input (`<Stage1Symptoms />`)
   - Stage 2: Archetype Selection (`<Stage2Archetype />`)
   - Stage 3: Probe Questions (`<Stage3Probes />`)
   - Stage 4: Tech Context (`<Stage4ScenarioA />` or `<Stage4ScenarioB />`)
   - Stage 5: AI Synthesis Loading (`<Stage5Loading />`)
   - Result: Quality Gate Passed or Failed (`<QualityGatePassed />`, `<QualityGateFailed />`)

### 1. CEO Dashboard (`features/ceo/CeoDashboard.tsx`)
- **What it does**: The landing page for the CEO. Shows a summary and checks if they have an active session or need to upgrade to "Client Pro".
- **Buttons**:
  - **"Upgrade now"**: Redirects to `/ceo/subscription`.
  - **"Resume Session"** (conditional): Redirects to `/ceo/elicitation`.
- **Hooks Provoked**:
  - `useAuth()` (Zustand context): To check `user.subscriptionTier`.
  - `useNavigate()` (React Router): For button redirects.
  - `useEffect()`: To check `localStorage` for `currentSessionId`.
- **React Knowledge Demonstrated**:
  - **Conditional Rendering**: Displays upgrade banners only if `subscriptionTier !== 'pro'`.
  - **Side Effects**: Checking persistent storage on mount to alter UI state.

### 2. Wallet & Subscription (`features/ceo/onboarding/...`)
- **What it does**: Allows the CEO to top-up their wallet via a VietQR code and purchase a Pro subscription.
- **Buttons**:
  - **"Generate QR Code"**: Triggers `POST /wallets/virtual-accounts/topup` to fetch the QR URL.
  - **"Activate Client Pro"**: Triggers `POST /subscriptions/activate`.
- **Hooks Provoked**:
  - `useMutation` (TanStack Query): Used to handle the POST requests for both QR generation and subscription activation. Manages `isPending` and `isError` states.
  - `useWallet()` (TanStack Query custom hook): Used to fetch the latest balance.
  - `useRef` & `useEffect`: Used to implement a **polling pattern** (checking `GET /wallets/me` every 5 seconds until the balance updates).
- **React Knowledge Demonstrated**:
  - **Asynchronous State Management**: Handling API loading, error, and success states declaratively.
  - **Ref vs State**: Using `useRef` to hold the interval ID for polling so it doesn't trigger re-renders, and cleaning it up in the `useEffect` return function to prevent memory leaks.

### 3. Elicitation Wizard Shell (`features/ceo/elicitation/ElicitationWizard.tsx`)
- **What it does**: The master controller for the 5-stage AI elicitation process. It orchestrates the child stages.
- **Buttons**: None directly (renders child components).
- **Hooks Provoked**:
  - `useState()`: Tracks `currentStage`, `sessionState`, `archetype`, and `voidList`.
  - `useMutation`: Triggers `POST /elicitation/sessions` to create a new session or resume an existing one.
- **React Knowledge Demonstrated**:
  - **State Machine Pattern**: The wizard acts as a finite state machine, rendering specific child components based on the `currentStage` integer.
  - **Prop Drilling / Lifting State Up**: The shell passes `onComplete`, `sessionId`, and specific state down to children, allowing children to update the parent's state and trigger stage progression.

### 4. Stage 1: Symptoms (`Stage1Symptoms.tsx`)
- **What it does**: Collects the initial problem description from the CEO and fetches potential "gaps" (voids) identified by the AI.
- **Buttons**:
  - **"Analyze my project"**: Submits the textarea content.
- **Hooks Provoked**:
  - `useState()`: Manages the textarea value.
  - `useMutation`: Calls `PUT /elicitation/sessions/:id/stage1`.
- **React Knowledge Demonstrated**:
  - **Controlled Components**: The textarea value is tied directly to React state.
  - **Complex Async Handling**: Managing a slow LLM response (10-30 seconds) by rendering a prominent loading state.

### 5. Stage 2 & 3: Archetypes & Probes (`Stage2Archetype.tsx`, `Stage3Probes.tsx`)
- **What it does**: CEO selects the AI project type (Archetype) and answers specific infrastructure questions dynamically loaded based on that archetype.
- **Buttons**:
  - **"Continue"**: Submits the selected archetype / probe answers.
- **Hooks Provoked**:
  - `useFormik` (or standard controlled forms): To manage multi-input form state.
- **React Knowledge Demonstrated**:
  - **Dynamic Rendering**: Rendering different form questions based on the `archetype` string passed down from the parent wizard.
  - **Mapping Arrays to UI**: `ARCHETYPES.map(...)` to generate selectable UI cards.

### 6. Quality Gates (`QualityGatePassed.tsx`, `QualityGateFailed.tsx`)
- **What it does**: The final result screen. If the AI synthesis approves the requirements, it passes. If it lacks detail, it fails and asks the CEO to refine.
- **Buttons**:
  - **"Return to Dashboard" / "View Handoff Link"**.
- **Hooks Provoked**:
  - `useNavigate()`: To route away from the wizard.
- **React Knowledge Demonstrated**:
  - **Presentational Components**: "Dumb" components that mostly just take props and render a UI without complex internal state.

---

## 🛠️ MF-2: Expert Verification Journey

**Goal:** Allow an Expert to build their technical profile, claim "seams" (cross-domain expertise), and submit a portfolio for AI evaluation to reach "Tier 2" (Evidence-Backed).

### Screen Flow
1. **Expert Dashboard** (`/expert`)
2. **Profile Builder Shell** (`/expert/profile/ProfileBuilder.tsx`)
   - Tab 1: Domain Depths (`<DomainDepthGrid />`)
   - Tab 2: Seam Claims (`<SeamClaimsGrid />`)
   - Tab 3: Tech Stack & Tools (`<StackTagsPicker />`)
   - Tab 4: Review (`<ExpertProfilePage />`)
3. **Verification & Portfolio** (`/expert/verification/...`)
   - Submit Portfolio (`<PortfolioSubmitForm />`)
   - Success / Rejection (`<Tier2Success />`, `<Tier2Rejected />`)

### 1. Profile Builder Shell (`features/expert/profile/ProfileBuilder.tsx`)
- **What it does**: A tabbed layout that guides the expert through filling out their capabilities.
- **Buttons**:
  - **"Next Tab" / "Previous Tab"**: Navigates through the profile builder stages.
- **Hooks Provoked**:
  - `useState()`: Tracks `activeTab` ('domains' | 'seams' | 'tags' | 'review').
  - `useQuery` (TanStack Query): Fetches the existing expert profile via `GET /expert-profile/me` to pre-populate tabs.
- **React Knowledge Demonstrated**:
  - **Tabbed Navigation State**: Similar to the wizard in MF-1, but allows freer movement backwards and forwards.
  - **Derived State**: Combining data from multiple child tabs to form the final payload in the 'Review' tab.

### 2. Domain Depths & Seam Claims (`DomainDepthGrid.tsx`, `SeamClaimsGrid.tsx`)
- **What it does**: Allows the expert to select their depth in various AI domains (Surface, Operational, Deep) and check off cross-domain seams they have experience in.
- **Buttons**:
  - **Radio Buttons / Checkboxes**: For selecting domains and seams.
  - **"Save & Continue"**: Submits the selections.
- **Hooks Provoked**:
  - `useState()`: Tracks complex nested state (e.g., mapping `domainCode` to `depthLevel`).
  - `useMutation`: Submits bulk data to `POST /expert-profile/domains` or `seams`.
- **React Knowledge Demonstrated**:
  - **Complex Form State**: Managing state arrays and dictionaries (e.g., `{ 'A': 'DEEP', 'B': 'SURFACE' }`).
  - **Promise.all**: Executing multiple API calls concurrently when the user saves multiple domains at once.

### 3. Stack Tags Picker (`StackTagsPicker.tsx`)
- **What it does**: A custom tag input system where users can type technologies, hit enter to add them, or click suggestions.
- **Buttons**:
  - **"Add Tag"**: Appends string to array.
  - **"Remove (x)"**: Removes string from array.
- **Hooks Provoked**:
  - `useState()`: For the current input string and the array of `tags`.
  - `useCallback()`: For the 'remove tag' function to maintain reference stability.
- **React Knowledge Demonstrated**:
  - **Array State Immutability**: Using spread operators `[...tags, newTag]` and `.filter()` to modify arrays in React without mutating the original state.
  - **Keyboard Events**: Intercepting `onKeyDown` to check for `Enter` key presses.

### 4. Portfolio Submission Form (`features/expert/verification/PortfolioSubmitForm.tsx`)
- **What it does**: Allows Tier 1 experts to select a claimed seam and submit a detailed description of their past project. An AI evaluates the text to upgrade them to Tier 2.
- **Buttons**:
  - **"Submit for AI Evaluation"**: Triggers `POST /portfolio-submissions`.
- **Hooks Provoked**:
  - `useFormik` / `yup`: Ensures that the `projectDescription` is at least 50 characters and `decisionPoints` is at least 20 characters before allowing submission.
  - `useMutation`: Handles the slow LLM verification request.
- **React Knowledge Demonstrated**:
  - **Form Validation**: Using schema-based validation (Yup) to block bad user input at the client level before making costly AI backend requests.
  - **Conditional UI Rendering based on Server Data**: Using the results of the mutation (e.g., `status === 'APPROVED'`) to dynamically mount the `<Tier2Success />` or `<Tier2Rejected />` components without changing the route.
