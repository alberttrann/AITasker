# AITasker — FE ↔ BE Integration Guide (v2)
## For: Khang (Frontend) · By: Nhân (Backend)
## Scope: MF-1 (CEO Flow) + MF-2 (Expert Flow) Demo
## Last updated: 2026-06-26 (v2.1 — corrected verify-email: endpoint does NOT exist, see alternatives below)
## ⚠️ THIS DOCUMENT REPLACES `FE_BE_INTEGRATION_GUIDE.md` — old version is outdated

---

# 🚨 CRITICAL CORRECTION (June 26, 2026)

## POST /auth/verify-email — DOES NOT EXIST (Documentation Bug)

**The `POST /auth/verify-email` endpoint documented below in PART 0 was written as a planned feature but was NEVER implemented on the backend.** There is no `verifyEmail` method in `auth.controller.ts` and no `verify-email.dto.ts` file. **Do NOT call this endpoint — it returns 404.**

### How to Handle Tax Code Verification Instead:

**Option A — Simplest (Recommended):** Just include `taxCode` in the register payload. The BE verifies it internally during registration.
```ts
// In RegisterPage.tsx — just add taxCode to register:
apiClient.post('/auth/register', {
  email, password, fullName, phone,
  roles: "CLIENT_CEO",
  taxCode: "0316794479"   // ← BE auto-verifies via VietQR
});
// After register → GET /users/me → check user.activeRoleProfile.companyName
```

**Option B — Real-time feedback (if you want green/red while typing):** Call VietQR API directly from the browser — it's a public API, no key needed.
```ts
// Debounce 500ms after user finishes typing taxCode:
const verifyTaxCode = async (taxCode: string) => {
  try {
    const res = await fetch(`https://api.vietqr.io/v2/business/${taxCode}`);
    const data = await res.json();
    if (data.code === '00') {
      setTaxStatus({ verified: true, companyName: data.data.name });
      // Show: ✅ {data.data.name}
    } else {
      setTaxStatus({ verified: false, companyName: null });
      // Show: ❌ Tax code not recognized
    }
  } catch {
    setTaxStatus({ verified: false, companyName: null });
  }
};
```
This is the EXACT SAME API the BE calls internally — it's public, free, no CORS issues. The BE will still re-verify on register (double-check safety).

**Bottom line:** Skip the `POST /auth/verify-email` section below — it doesn't exist. Use Option A or B above.

---

# 📌 LATEST UPDATE — 2026-06-24

## PUT /users/me — Update Profile (NOW DOCUMENTED)

**Khang reported this was missing. It IS implemented — here are the full specs:**

| Item | Detail |
|---|---|
| **Endpoint** | `PUT /users/me` |
| **Auth** | JWT required (all roles: CLIENT, EXPERT, ADMIN) |
| **Controller** | `users.controller.ts` → `updateUserProfile()` |
| **Service** | `users.service.ts` → `updateUserProfile()` |
| **DTO** | `update-user.dto.ts` — all fields optional |
| **Response** | `{ success: true }` |

### What FE Sends (ALL fields optional — send only what changed)
```json
{
  "fullName": "Nguyen Van A",
  "phone": "0912345678",
  "companyName": "CÔNG TY TNHH ABC",
  "industry": "Fintech",
  "ceoName": "Nguyen Van A"
}
```

### What BE Updates
- **Always:** `users.fullName`, `users.phone`
- **If activeRole = CLIENT:** also updates `client_profiles.companyName`, `client_profiles.industry`, `client_profiles.ceoName`
- **If activeRole = EXPERT:** only updates `users.fullName` and `users.phone` (client profile fields are ignored)

### After Success
- FE calls `GET /users/me` to refresh the user profile with updated data

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 404 | User not found | "User not found." |

Full details in Part 2 → Screen 7 below.

---

## Tax Code Verification (NO ENDPOINT — Use Direct VietQR API)

### ❌ `POST /auth/verify-email` DOES NOT EXIST — See correction at top of this document.

**Instead**, call VietQR directly from the browser for real-time feedback:

```ts
// Debounce 500ms after user finishes typing taxCode in register form
const verifyTaxCode = async (taxCode: string) => {
  try {
    const res = await fetch(`https://api.vietqr.io/v2/business/${taxCode}`);
    const data = await res.json();
    if (data.code === '00') {
      setTaxStatus({ verified: true, companyName: data.data.name });
    } else {
      setTaxStatus({ verified: false, companyName: null });
    }
  } catch {
    setTaxStatus({ verified: false, companyName: null });
  }
};
```

**Response shapes:**
- ✅ Valid: `{ code: "00", data: { name: "CÔNG TY TNHH ABC" } }`
- ❌ Invalid: `{ code: "01" }` or any non-"00" code

The BE will also re-verify internally when `taxCode` is sent with `POST /auth/register`.

---

## How to Read This Guide

Each section describes one screen. For each endpoint:

| Section | Meaning |
|---|---|
| **API to Call** | Which endpoint, method, URL |
| **Auth Required?** | Yes = Bearer token required · No = open |
| **What FE Sends** | Exact JSON body (copy-paste ready) |
| **What BE Returns** | Exact JSON response shape (from Nhân's actual code) |
| **What to Display** | What should appear on screen |
| **Possible Errors** | HTTP codes, when they happen, message to show |

---

# PART 0 — GLOBAL AUTH FLOW (Must Read First)

## The Token System

```
1. POST /auth/register → { access_token, refresh_token }    ← BOTH TOKENS RETURNED (auto-login!)
2. FE stores both tokens → calls GET /users/me → stores user → redirects to dashboard
3. POST /auth/login → { access_token, refresh_token }       ← BOTH TOKENS RETURNED
4. FE stores both tokens → calls GET /users/me → stores user → redirects to dashboard
5. Every future request: FE auto-attaches Bearer <access_token>
6. On 401: FE interceptor calls POST /auth/refresh with refresh_token in body → gets new token pair
7. Refresh token rotation: each refresh returns a NEW refresh_token (old one discarded)
```

## ⚠️ FE Must Chain GET /users/me After Getting Tokens

Both register and login return `{ access_token, refresh_token }` — they do NOT return a user object.
Khang's `use-auth.ts` must chain `GET /users/me` after receiving tokens to get the full user profile.

### Required FE Pattern (applies to register AND login onSuccess):

```
Step 1: store.setTokens(data.access_token, data.refresh_token)    // store both tokens
Step 2: const userRes = await apiClient.get('/users/me')          // fetch full profile
Step 3: store.setUser(userRes.data)                                // store user object
Step 4: redirectByRole(userRes.data.activeRole, ...)               // redirect
```

### Additional FE Change:

| File | What to Change |
|---|---|
| `use-auth.ts` | **SwitchRole onSuccess:** the BE returns `{ access_token }`, not `UserDto`. Store new token, then call `GET /users/me` to get updated user. |

## JWT Token Contents (decoded from access_token)

After login, the JWT contains:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "activeRole": "CLIENT",
  "clientSubType": "CEO",
  "subscriptionClientTier": "free",
  "subscriptionExpertTier": "free"
}
```

## After Login — Redirect Rules

| activeRole | clientSubType | Redirect To |
|---|---|---|
| CLIENT | CEO | /ceo (CEO Dashboard) |
| CLIENT | TECH_TEAM | /tech-team |
| EXPERT | (null) | /expert (Expert Dashboard) |
| ADMIN | (null) | /admin |

The redirect logic is inside `use-auth.ts` — Khang owns this file.

---

# PART 1 — AUTH SCREENS

## Screen 1: Register Page → `features/auth/RegisterPage.tsx`

### API: POST /auth/register
**Auth Required:** No

### What FE Sends
```json
{
  "email": "ceo@example.com",
  "password": "StrongPass123!",
  "fullName": "Nguyen Van A",
  "phone": "0912345678",
  "roles": "CLIENT_CEO",
  "taxCode": "0316794479"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| email | string | Yes | Unique, valid email format |
| password | string | Yes | Strong password (uppercase + lowercase + number + special char) |
| fullName | string | Yes | 2–50 characters |
| phone | string | No | Vietnamese phone format (optional) |
| roles | enum | Yes | `"CLIENT_CEO"` = CEO account, `"EXPERT"` = Expert account |
| taxCode | string | No | Vietnamese tax number (Mã số thuế). If valid, verifies as Business Client |

### What BE Returns (Success)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### ⚠️ Register returns BOTH tokens — auto-login! No need to redirect to /login.

**FE must do this on register success:**
1. Store both tokens: `store.setTokens(data.access_token, data.refresh_token)`
2. Fetch user profile: `apiClient.get('/users/me')` → `store.setUser(userRes.data)`
3. Redirect to dashboard based on `userRes.data.activeRole`

### What BE Does Behind the Scenes
1. Creates `users` row (with role, activeRole, clientSubtype)
2. Creates `client_profiles` or `expert_profiles` row
3. Creates `wallets` row (availableBalance = 0, lockedBalance = 0)
4. Creates `virtual_accounts` row (permanent top-up VA number)
5. If `taxCode` is provided AND valid → updates `client_profiles.companyName` with verified company name from VietQR API
6. If `taxCode` is invalid or not provided → `companyName` stays `null`

### Client Verification — How It Works

| taxCode? | VietQR Result | companyName | Badge on FE |
|---|---|---|---|
| Not provided | — | `null` | "General Client" |
| Provided, valid ✅ | code = "00" | `"CÔNG TY TNHH ABC"` | "Verified Client — CÔNG TY TNHH ABC" |
| Provided, invalid ❌ | code ≠ "00" or error | `null` | "General Client" |

**FE badge logic:** Check `GET /users/me` → `activeRoleProfile.companyName`:
- `null` → show "General Client" badge (grey/default)
- any string → show "Verified Client — {companyName}" badge (green/verified)

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 409 | Email already registered | "This email is already registered. Please login instead." |
| 400 | Validation failed (bad password, short name, etc.) | Show the first validation error message from the response |

---

## Screen 2: Login Page → `features/auth/LoginPage.tsx`

### API: POST /auth/login
**Auth Required:** No

### What FE Sends
```json
{
  "email": "ceo@example.com",
  "password": "StrongPass123!"
}
```

### What BE Returns (Success)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### ⚠️ Login returns BOTH tokens — but NOT the user object

**FE must do this on login success:**
1. Store both tokens: `store.setTokens(data.access_token, data.refresh_token)`
2. Fetch user profile: `apiClient.get('/users/me')` → `store.setUser(userRes.data)`
3. Redirect based on `userRes.data.activeRole`

### After Login Success
```
Step 1: store.setTokens(data.access_token, data.refresh_token)
Step 2: apiClient.get('/users/me') → store.setUser(response)
Step 3: redirectByRole(response.activeRole, response.clientSubtype)
```

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 401 | Wrong email or password | "Invalid email or password." |
| 403 | Account suspended (is_active = false) | "Your account has been suspended. Contact support." |

---

## Screen 3: Switch Role → `components/layout/RoleSwitcher.tsx`

### API: PUT /auth/switch-role
**Auth Required:** Yes (JWT)

### What FE Sends
```json
{
  "activeRole": "EXPERT"
}
```
activeRole must be either `"CLIENT"` or `"EXPERT"`. User must already have that role in their `roles` array.

### What BE Returns (Success)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```
Returns a NEW JWT with updated `activeRole` claim. Does NOT return a user object.

### ⚠️ FE must chain GET /users/me after receiving the new token

**FE must do this on switch-role success:**
1. Store new token: `store.setTokens(data.access_token, null)`
2. Call `apiClient.get('/users/me')` → `store.setUser(response)`
3. Redirect to new dashboard based on updated `activeRole`

### What to Display
- Dropdown or toggle: "Switch to Expert" / "Switch to Client"
- After switching: redirect to appropriate dashboard
- Hide the switcher if user only has one role

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 401 | User does not have the target role | "You do not have permission to switch to this role." |
| 422 | User only has one role | "Your account only has one role. Add a role first." |

---

## Screen 4: Token Refresh (Auto — No UI)

### API: POST /auth/refresh
**Auth Required:** No (no JWT guard on this endpoint)

### What FE Sends
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### What BE Returns (Success)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

> **Token rotation:** Each refresh also returns a NEW refresh_token. The FE must update both tokens in the store. This is automatically handled by `api-client.ts`.

### What BE Does Behind the Scenes
1. Reads `refresh_token` from request body (NOT Authorization header)
2. Verifies the refresh token signature + expiry via `jwtService.verifyAsync()`
3. Validates `payload.type === 'refresh'` (rejects access tokens used at this endpoint)
4. Extracts `payload.sub` → queries user from DB
5. Issues NEW access_token + NEW refresh_token (rotation)
6. Returns both

The FE interceptor (`api-client.ts`) handles this automatically:
1. Request gets 401 → interceptor calls POST /auth/refresh with refresh_token in body
2. BE returns new access_token + new refresh_token → interceptor updates store + retries original request

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 401 | Refresh token expired or invalid | Redirect to /login (handled by api-client interceptor) |
| 401 | Token is not type 'refresh' (access token sent here) | Redirect to /login |

---

# PART 2 — USER PROFILE SCREENS

## Screen 5: View My Profile → Dashboard headers

### API: GET /users/me
**Auth Required:** Yes (JWT)
**Allowed Roles:** CLIENT, EXPERT, ADMIN

### What BE Returns (Success) — CEO Example
```json
{
  "email": "ceo@example.com",
  "fullName": "Nguyen Van A",
  "phone": "0912345678",
  "roles": ["CLIENT_CEO"],
  "activeRole": "CLIENT",
  "clientSubtype": "CEO",
  "subscriptionTier": "free",
  "activeRoleProfile": {
    "userId": "a1b2c3d4-...",
    "companyName": "CÔNG TY TNHH ABC",
    "industry": null,
    "ceoName": null
  },
  "subscriptionExpires": null
}
```

### What BE Returns (Success) — Expert Example
```json
{
  "email": "expert@example.com",
  "fullName": "Tran Van B",
  "phone": "0987654321",
  "roles": ["EXPERT"],
  "activeRole": "EXPERT",
  "clientSubtype": null,
  "subscriptionTier": "free",
  "activeRoleProfile": {
    "userId": "e5f6g7h8-...",
    "bio": null,
    "engagementModel": null,
    "stackTagsJson": [],
    "archetypeHistoryJson": []
  },
  "subscriptionExpires": null
}
```

### activeRoleProfile Field Reference

**When activeRole is CLIENT (CEO):**
| Field | Type | Meaning |
|---|---|---|
| userId | string | User UUID |
| companyName | string or null | **null = General Client**, string = Verified Business Client |
| industry | string or null | Industry (e.g., "Fintech", "Healthcare") |
| ceoName | string or null | CEO's full name |

**When activeRole is EXPERT:**
| Field | Type | Meaning |
|---|---|---|
| userId | string | User UUID |
| bio | string or null | Expert bio |
| engagementModel | string or null | "MILESTONE", "HOURLY", "HYBRID" |
| stackTagsJson | array | Tech stack tags |
| archetypeHistoryJson | array | Project archetype history |

### What to Display

**TopNav / Dashboard Header:**
- User's `fullName` and `email`
- Welcome greeting: "Welcome, {fullName}"
- Subscription badge: "Free Tier" or "Pro — expires {subscriptionExpires}"
- If `subscriptionTier === "free"`: show upgrade banner / CTA

**Client Verification Badge (CEO only):**
- Check `activeRoleProfile.companyName`:
  - `null` → show "General Client" badge (grey, neutral color)
  - any string → show "🏢 Verified Client — {companyName}" badge (green, verified color)

---

## Screen 6: Add Second Role → Profile Settings

### API: POST /users/me/add-role
**Auth Required:** Yes (JWT)
**Allowed Roles:** CLIENT, EXPERT

### What FE Sends
```json
{
  "newRole": "EXPERT"
}
```
newRole: `"CLIENT_CEO"` or `"EXPERT"` — the role the user does NOT currently have.

### What BE Returns (Success)
```json
{
  "success": true
}
```

### What BE Does
1. Adds the new role to `users.roles` JSON array
2. Creates `clientProfiles` or `expertProfiles` row if not exists

### What to Display
- Button: "Become an Expert too" / "Also act as Client"
- After success: show success toast + refresh user profile

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 409 | Role already exists | "You already have this role." |
| 401 | User not found | "User not found." |

---

## Screen 7: Update Profile → Profile Settings page

### API: PUT /users/me
**Auth Required:** Yes (JWT)
**Allowed Roles:** CLIENT, EXPERT, ADMIN

### What FE Sends
```json
{
  "fullName": "Nguyen Van A",
  "phone": "0912345678",
  "companyName": "CÔNG TY TNHH ABC",
  "industry": "Fintech",
  "ceoName": "Nguyen Van A"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| fullName | string | No (optional) | 2–50 characters |
| phone | string | No (optional) | Vietnamese phone format |
| companyName | string | No (optional) | Business name — only used when activeRole = CLIENT |
| industry | string | No (optional) | e.g., "Fintech", "Healthcare" — only used when activeRole = CLIENT |
| ceoName | string | No (optional) | CEO's full name — only used when activeRole = CLIENT |

> **ALL fields are optional.** Send only the fields the user changed. Empty body = no-op (still returns success).

### What BE Returns (Success)
```json
{
  "success": true
}
```

### What BE Updates
| If activeRole is... | Fields updated |
|---|---|
| CLIENT | `users.fullName`, `users.phone`, `client_profiles.companyName`, `client_profiles.industry`, `client_profiles.ceoName` |
| EXPERT | `users.fullName`, `users.phone` only (client profile fields silently ignored) |

All updates happen in a single DB transaction — partial failure rolls back everything.

### What to Display
- Profile form pre-filled with current data from `GET /users/me`
- After save: toast "Profile updated!" + re-fetch `GET /users/me` to refresh display
- If activeRole is EXPERT: hide companyName, industry, ceoName fields (they don't apply)

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 404 | User not found | "User not found." |
| 400 | Validation (name too short, etc.) | Show first field error |

---

# PART 3 — WALLET SCREENS

## Screen 8: Wallet Balance → `components/wallet/WalletCard.tsx`

**Used in:** TopNav, WalletTopUp page, ExpertWallet page

### API: GET /wallets/me
**Auth Required:** Yes (JWT)
**Allowed Roles:** CLIENT, EXPERT

### What BE Returns (Success)
```json
{
  "id": "wallet-uuid",
  "userId": "user-uuid",
  "availableBalance": 500000,
  "lockedBalance": 0
}
```

| Field | Type | Meaning |
|---|---|---|
| availableBalance | number | Money available to spend (VND) |
| lockedBalance | number | Money held in escrow (VND) |

### What to Display
- Format VND with commas: "500,000 VND" → use `new Intl.NumberFormat('vi-VN').format(amount) + ' VND'`
- If balance = 0 AND subscription = "free": show "Top up to get started" CTA
- If balance = 0 AND subscription = "pro": show "Add funds to continue"

---

## Screen 9: Transaction History

### API: GET /wallets/me/transactions
**Auth Required:** Yes (JWT)
**Allowed Roles:** CLIENT, EXPERT

### What BE Returns (Success)
```json
[
  {
    "id": "tx-uuid-1",
    "amount": 500000,
    "transactionType": "TOP_UP",
    "createdAt": "2026-06-20T10:30:00.000Z"
  }
]
```

### Transaction Types
| transactionType | Meaning | Display Color / Icon |
|---|---|---|
| TOP_UP | Bank transfer received | 🟢 Green, arrow-down (money in) |
| SUBSCRIPTION | Paid for Pro subscription | 🔴 Red, arrow-up (money out) |
| ESCROW_LOCK | Milestone funded / locked | 🟡 Yellow, lock icon |
| ESCROW_RELEASE | Payment received from escrow | 🟢 Green, arrow-down (money in) |
| WITHDRAWAL | Sent to bank account | 🔴 Red, arrow-up (money out) |

---

## Screen 10: Wallet Top-Up → `features/ceo/onboarding/WalletTopUp.tsx`

### ⚠️ FILE IS CURRENTLY EMPTY (0 bytes) — Khang must build this screen

### API: POST /wallets/virtual-accounts/topup
**Auth Required:** Yes (JWT)
**Allowed Roles:** CLIENT, EXPERT

### What FE Sends
```json
{
  "amount": 500000
}
```
amount in VND, no decimals.

### What BE Returns (Success)
```json
{
  "qrCodeUrl": "https://qr.sepay.vn/img?bank=MBBank&acc=0394654576&template=compact&amount=500000&des=WALLETTOPUPabc123",
  "paymentReference": "WALLETTOPUPabc123"
}
```

### Screen Layout (Khang to build)

| Section | Content |
|---|---|
| **Amount input** | Text field: enter amount in VND. Validate: minimum 10,000 VND. |
| **Generate button** | "Generate QR Code" → calls API → shows QR |
| **QR display** | `<img src={qrCodeUrl} />` — the VietQR code image |
| **Transfer info** | Bank: MB Bank (MBBank) · Account: 0394654576 · Amount: {amount} VND · Reference: {paymentReference} |
| **Copy buttons** | Copy button next to account number, amount, and reference |
| **Waiting state** | "Waiting for payment confirmation..." spinner |
| **Success state** | Green checkmark + "Payment received! ₫{newBalance} VND" |
| **Continue button** | "Continue to Subscription" — shows when balance ≥ 500,000 VND |

### Step 2: Wait for Payment Confirmation (for demo)
For the demo, Nhân will manually trigger the SePay IPN webhook via curl/Postman. After the webhook fires:
- Socket event `payment:confirmed` is emitted
- FE re-fetches `GET /wallets/me` → balance updates
- Show "Continue to Subscription" CTA when balance >= 500,000

If WebSocket is not ready before demo, Khang can implement a simple **polling fallback**: re-fetch `GET /wallets/me` every 3 seconds for up to 2 minutes after generating the QR code.

---

## Screen 11: VietQR Panel → `components/wallet/VietQRPanel.tsx`

### ⚠️ FILE IS CURRENTLY EMPTY (0 bytes) — Reusable component

### Props (Khang to define)
```typescript
interface VietQRPanelProps {
  qrCodeUrl: string;        // QR image URL from API
  paymentReference: string;  // Transfer reference/memo
  amount: number;            // Amount in VND
  bankName?: string;         // Default: "MB Bank"
  accountNumber?: string;    // Default: "0394654576"
  onPaymentConfirmed?: () => void;  // Callback when payment confirmed
}
```

### What to Display
- QR code image: `<img src={qrCodeUrl} alt="VietQR" />`
- Transfer instructions card with copyable fields
- Loading spinners: "Đang chờ thanh toán..."
- Success state: green checkmark + "Thanh toán thành công!"
- Listen for `payment:confirmed` socket event (or poll GET /wallets/me)

---

# PART 4 — SUBSCRIPTION SCREEN

## Screen 12: Activate Pro → `features/ceo/onboarding/SubscriptionActivate.tsx`

### ⚠️ FILE IS CURRENTLY EMPTY (0 bytes) — Khang must build this screen

### API: POST /subscriptions/activate
**Auth Required:** Yes (JWT)
**Allowed Roles:** CLIENT, EXPERT

### What FE Sends
```json
{
  "activeRole": "CLIENT"
}
```
activeRole must match user's current `activeRole`.

### What BE Returns (Success)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```
Returns a new JWT with updated `subscriptionClientTier: "pro"` (or `subscriptionExpertTier: "pro"`) claim.

### ⚠️ After subscription activation, FE must:
1. Store the new access_token (the subscription tier is embedded in the JWT)
2. Call `GET /users/me` to get updated user profile (with new subscriptionTier)
3. Call `GET /wallets/me` to get updated balance (500,000 VND deducted)

### What BE Does Behind the Scenes
1. Checks wallet balance ≥ 500,000 VND
2. Deducts 500,000 VND from wallet
3. Creates transaction record (SUBSCRIPTION)
4. Sets subscription tier to "pro"
5. Sets expiry date to now + 6 months
6. Returns new JWT with updated subscription claims

### Screen Layout (Khang to build)

**Before activation:**
| Element | Content |
|---|---|
| Plan card | "CLIENT PRO" title |
| Features list | AI-powered elicitation, expert matching, milestone tracking |
| Price | 500,000 VND / 6 months |
| Balance display | "Your balance: ₫{availableBalance} VND" |
| Activate button | "Activate Client Pro" (disabled if balance < 500,000) |
| Warning | If balance insufficient: "Insufficient balance. Top up first." with link to top-up |

**After success:**
| Element | Content |
|---|---|
| Success message | 🎉 "Pro Activated!" |
| Expiry date | "Expires: {date 6 months from now}" |
| New balance | "Remaining balance: ₫{newBalance} VND" |
| CTA button | "Start Your First AI Project" → navigate to elicitation |

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 409 | Already subscribed + not expired | "Your subscription is still active until {expiryDate}." |
| 409 | Insufficient balance | "Insufficient balance. Top up at least 500,000 VND first." |
| 409 | Wrong activeRole | "Switch to {targetRole} before activating subscription." |

---

## Screen 13: Subscription Status (View Only)

### API: GET /subscriptions/status
**Auth Required:** Yes (JWT)
**Allowed Roles:** CLIENT, EXPERT

### What BE Returns (Success)
```json
{
  "subscriptionTier": "free",
  "subscriptionExpires": null
}
```

Or for Pro users:
```json
{
  "subscriptionTier": "pro",
  "subscriptionExpires": "2026-12-24T10:30:00.000Z"
}
```

### What to Display
- Tier badge: "Free Tier" or "Pro Tier"
- Expiry: "{days} days remaining" if pro, or "Upgrade to Pro" CTA if free

---

# PART 5 — EXPERT WALLET SCREENS (MF-2)

## Screen 14: Expert Wallet → `features/expert/wallet/ExpertWallet.tsx`

### ⚠️ FILE IS CURRENTLY EMPTY (0 bytes) — Khang must build this screen

### APIs Used
| API | What For |
|---|---|
| `GET /wallets/me` | Show available balance |
| `GET /wallets/me/transactions` | Show transaction history |
| `GET /users/me` | Check bank account linked status + subscription tier |

### Screen Layout (Khang to build)
- Available balance card (top)
- Bank account status card: "Linked ✅" or "Not linked ❌"
- "Link Bank Account" button (if not linked)
- "Withdraw to Bank" button (if linked — disabled for MF-2 demo)
- Transaction history list below

### Bank Account Logic
- Call `GET /users/me`
- The user object has `sepay_bank_account_xid` field (from the JWT claims or user API)
- Actually check the response: if `activeRoleProfile` has no bank info, show "Not linked"

For the demo:
- Khang can mock: after calling `POST /bank-hub/initiate-link` successfully, show "Linked" state
- Or check `GET /users/me` response for bank-linked status

---

## Screen 15: Bank Hub Link → `features/expert/wallet/BankHubLink.tsx`

### ⚠️ FILE IS CURRENTLY EMPTY (0 bytes) — Khang must build this screen

### API: POST /bank-hub/initiate-link
**Auth Required:** Yes (JWT)
**Allowed Roles:** EXPERT only

### What FE Sends
```json
{
  "bank_account_xid": "xid-from-sepay-12345",
  "holder_name": "Tran Van B"
}
```

### What BE Returns (Success)
```json
{
  "success": true
}
```

### ⚠️ Current Status: BE writes directly to DB (bypasses SePay OTP for demo). Nhân will add the SePay redirect flow later.

### Screen Layout (Khang to build)
| Element | Content |
|---|---|
| Explanation card | "Link your bank account via SePay Bank Hub to receive payments." |
| Form | Account holder name (input) + Bank account XID (input) |
| Link button | "Link Bank Account" → calls API |
| Success state | "Bank account linked! You can now receive payments." |

### Possible Errors
| HTTP | When | Show User |
|---|---|---|
| 409 | Bank already linked | "A bank account is already linked to your profile." |

---

# PART 6 — QUICK REFERENCE: ALL ENDPOINTS

| # | Method | Endpoint | Auth | Roles | Returns | Screen |
|---|---|---|---|---|---|---|
| 1 | POST | /auth/register | No | — | `{ access_token, refresh_token }` | RegisterPage |
| 2 | POST | /auth/login | No | — | `{ access_token, refresh_token }` | LoginPage |
| 3 | PUT | /auth/switch-role | Yes | CLIENT, EXPERT | `{ access_token }` | RoleSwitcher |
| 4 | POST | /auth/refresh | No | — | `{ access_token, refresh_token }` (rotation) | (auto — api-client interceptor) |
| 5 | GET | /users/me | Yes | CLIENT, EXPERT, ADMIN | `{ email, fullName, phone, roles, activeRole, clientSubtype, subscriptionTier, activeRoleProfile, subscriptionExpires }` | Dashboard headers |
| 6 | PUT | /users/me | Yes | CLIENT, EXPERT, ADMIN | `{ success: true }` | Profile settings |
| 7 | POST | /users/me/add-role | Yes | CLIENT, EXPERT | `{ success: true }` | Profile settings |
| 8 | GET | /wallets/me | Yes | CLIENT, EXPERT | `{ id, userId, availableBalance, lockedBalance }` | WalletCard, TopNav |
| 9 | GET | /wallets/me/transactions | Yes | CLIENT, EXPERT | `[{ id, amount, transactionType, createdAt }]` | Transaction history |
| 10 | POST | /wallets/virtual-accounts/topup | Yes | CLIENT, EXPERT | `{ qrCodeUrl, paymentReference }` | WalletTopUp |
| 11 | POST | /subscriptions/activate | Yes | CLIENT, EXPERT | `{ access_token }` | SubscriptionActivate |
| 12 | GET | /subscriptions/status | Yes | CLIENT, EXPERT | `{ subscriptionTier, subscriptionExpires }` | Subscription display |
| — | (direct VietQR) | GET https://api.vietqr.io/v2/business/{taxCode} | No | — | `{ code: "00", data: { name } }` // public API | RegisterPage (real-time tax lookup) |
| 13 | POST | /bank-hub/initiate-link | Yes | EXPERT | `{ success: true }` | BankHubLink |

---

# PART 7 — CRITICAL FE FIXES KHANG MUST MAKE

## Fix #1: Register Flow (Auto-Login)

**File:** `hooks/use-auth.ts` → `register` mutation `onSuccess`

**BE now returns `{ access_token, refresh_token }`** — both tokens are provided.

**What it must do:**
```
onSuccess: async (data) => {
  store.setTokens(data.access_token, data.refresh_token)       // ✅ both tokens exist
  const userRes = await apiClient.get('/users/me')             // fetch user profile
  store.setUser(userRes.data)                                   // store user
  redirectByRole(userRes.data.activeRole, ...)
}
```

The register mutation type should expect `{ access_token: string; refresh_token: string }` (no `user` field).

---

## Fix #2: Login Flow (Both Tokens + Chain GET /users/me)

**File:** `hooks/use-auth.ts` → `login` mutation

**BE now returns `{ access_token, refresh_token }`** — both tokens are provided.

**What it must do:**
```
onSuccess: async (data) => {
  store.setTokens(data.access_token, data.refresh_token)       // ✅ both tokens exist
  const userRes = await apiClient.get('/users/me')             // fetch user profile
  store.setUser(userRes.data)                                   // store user
  redirectByRole(userRes.data.activeRole, ...)
}
```

The login mutation type should expect `{ access_token: string; refresh_token: string }` (no `user` field).

---

## Fix #3: API Interceptor — Update Store on Refresh

**File:** `lib/api-client.ts` → refresh interceptor

**BE now returns `{ access_token, refresh_token }` from /auth/refresh (token rotation).**

The interceptor currently does `setTokens(access_token, refresh_token)` — this is correct and already handles the new response shape. No change needed, just verify it works.

---

## Fix #4: Switch Role Flow

**File:** `hooks/use-auth.ts` → `switchRole` mutation

**BE still returns `{ access_token }` only — no refresh_token for switch-role.**

**What it must do:**
```
onSuccess: async (data) => {
  store.setTokens(data.access_token, null)            // new token (no refresh_token from switch)
  const userRes = await apiClient.get('/users/me')    // get updated user
  store.setUser(userRes.data)
  redirectByRole(userRes.data.activeRole, ...)
}
```

---

## Fix #5: Subscription Activate Flow

**After calling `POST /subscriptions/activate`:**
```
onSuccess: async (data) => {
  store.setTokens(data.access_token, null)           // new JWT with pro tier
  const userResponse = await apiClient.get('/users/me')
  store.setUser(userResponse.data)
  // Refresh wallet balance
  queryClient.invalidateQueries(['wallet'])
}
```

---

## Fix #6: Client Verification Badge

**Where to add:** Dashboard headers, TopNav, Profile page

**Logic:**
```
const user = useAuth().user
const companyName = user?.activeRoleProfile?.companyName

if (user?.activeRole === 'CLIENT') {
  if (companyName) {
    showBadge("🏢 Verified Client — " + companyName, green)
  } else {
    showBadge("General Client", grey)
  }
}
```

---

# PART 8 — WHAT KHANG MUST BUILD (EMPTY FILES)

These files currently exist but have 0 bytes — they are empty shells. Khang must build them:

| File | Priority | Screen |
|---|---|---|
| `features/ceo/onboarding/WalletTopUp.tsx` | 🔴 P0 | Wallet top-up with QR code |
| `features/ceo/onboarding/SubscriptionActivate.tsx` | 🔴 P0 | Pro subscription activation |
| `components/wallet/VietQRPanel.tsx` | 🔴 P0 | Reusable VietQR display component |
| `components/wallet/WalletCard.tsx` | 🔴 P0 | Balance display (used in TopNav + Wallet page) |
| `components/layout/AppShell.tsx` | 🔴 P0 | App shell layout wrapper |
| `features/expert/wallet/ExpertWallet.tsx` | 🟡 P1 | Expert wallet overview |
| `features/expert/wallet/BankHubLink.tsx` | 🟡 P1 | Bank account linking form |

---

# PART 9 — FILES ALREADY BUILT (No Changes Needed)

| File | Status | What It Does |
|---|---|---|
| `auth/RegisterPage.tsx` | ✅ Built (8.7KB) | Role selection + registration form |
| `auth/LoginPage.tsx` | ✅ Built (7.8KB) | Login form |
| `layout/RoleSwitcher.tsx` | ✅ Built (1.5KB) | Role switch dropdown |
| `layout/TopNav.tsx` | ✅ Built (1.9KB) | Top navigation bar |
| `lib/api-client.ts` | ✅ Built (2.7KB) | Axios + JWT interceptor + 401 refresh |
| `lib/auth-context.tsx` | ✅ Built (1.6KB) | AuthProvider wrapper |
| `store/auth.store.ts` | ✅ Built (2.2KB) | Zustand auth store (persisted) |
| `lib/route-guards.tsx` | ✅ Built (3.5KB) | Route protection |
| `hooks/use-auth.ts` | ⚠️ Built (3.2KB) — NEEDS FIXES #1, #2, #4 above | Auth hook |
| `hooks/use-wallet.ts` | ✅ Built (1.6KB) | Wallet hook |

---

# PART 10 — BE FIXES NHÂN WILL COMPLETE BEFORE DEMO

| # | Fix | File | Status |
|---|---|---|---|
| 1 | Refresh token endpoint: remove JwtAuthGuard, read from body, verify type, rotate tokens | `auth/auth.controller.ts` + `auth/auth.service.ts` | ✅ DONE |
| 2 | Register returns both access_token + refresh_token | `auth/auth.service.ts` | ✅ DONE |
| 3 | Login returns both access_token + refresh_token | `auth/auth.service.ts` | ✅ DONE |
| 4 | Subscription activate: return structured object (not just access_token) | `subscriptions/subscriptions.service.ts` | 🟡 P1 |
| 5 | Bank hub link: return redirect URL instead of direct DB write | `payments/bank-hub.controller.ts` | 🟠 P2 |
| 6 | ~~Verify email endpoint~~ (CANCELED — not needed. FE calls VietQR directly or just includes taxCode in register. See correction at top.) | — | ✅ SKIP |

---

## Team Notes

- **Nhân (Chí Nhân):** Backend — auth, wallet, subscription, SePay IPN. All core endpoints DONE. Fixing refresh + minor response shapes before demo.
- **Khang (Tuấn Khang):** Frontend — must update use-auth.ts (fixes #1-#3 above) + build 7 empty files (Part 8) + add client verification badge.
- **Minh Hùng:** FastAPI / LLM service, DevOps, CI/CD, DB.
- **Cao Minh:** Elicitation, projects, expert profiles, engagements, bids.
- **Minh Thức:** Milestones, messaging, reviews, admin, tests.

*End of Integration Guide*
