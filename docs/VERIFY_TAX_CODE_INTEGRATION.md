# Verify Tax Code — FE ↔ BE Integration

> **For:** Tuấn Khang (Frontend)  
> **From:** Chí Nhân (Backend)  
> **Date:** June 28, 2026  

---

## What Changed

Two things:

| Change | What |
|---|---|
| **Register DTO** | `taxCode` field removed. Don't send it in `POST /auth/register` anymore. |
| **New endpoint** | `POST /auth/verify-tax-code` — separate endpoint just for tax code verification. |

**Why:** Tax verification is now a separate step. Users register without a tax code, then later verify it in Account Settings (`/ceo/account-setting`). Keeps registration simple and fast.

---

## New Endpoint: `POST /auth/verify-tax-code`

### Auth Required: **Yes** — JWT Bearer token + CLIENT role

### What FE Sends

```json
{
  "taxCode": "0316794479"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `taxCode` | string | Yes | Vietnamese tax code (Mã số thuế), 10–14 digits |

### What BE Returns — Tax Code Valid ✅

```json
{
  "verified": true,
  "companyName": "CÔNG TY TNHH ABC"
}
```

### What BE Returns — Tax Code Invalid ❌

```json
{
  "verified": false,
  "companyName": null
}
```

### How BE Validates

BE calls VietQR's public API: `https://api.vietqr.io/v2/business/{taxCode}`

- VietQR returns `code: "00"` → valid → BE returns `{ verified: true, companyName }`
- VietQR returns anything else or errors → invalid → BE returns `{ verified: false, companyName: null }`

---

## Updated: `POST /auth/register`

### What Changed

`taxCode` field is **removed** from `RegisterUserDto`. Don't send it anymore.

### What FE Sends (Updated)

```json
{
  "email": "ceo@example.com",
  "password": "StrongPass123!",
  "fullName": "Nguyen Van A",
  "phone": "0912345678",
  "roles": "CLIENT_CEO",
  "selfTechnical": false
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | Yes | Unique, valid email |
| `password` | string | Yes | Strong password |
| `fullName` | string | Yes | 2–50 characters |
| `phone` | string | No | Vietnamese phone number |
| `roles` | string | Yes | `"CLIENT_CEO"` or `"EXPERT"` |
| `selfTechnical` | boolean | No | Default: `false`. If `true`, CEO skips the tech team handoff in elicitation Stage 4. |

### What BE Returns (No Change)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-uuid",
    "email": "ceo@example.com",
    "fullName": "Nguyen Van A",
    "activeRole": "CLIENT",
    "clientSubtype": "CEO",
    "subscriptionClientTier": "free",
    "subscriptionExpertTier": "free"
  }
}
```

---

## How to Use: Two Flows

### Flow 1 — Registration (No Tax Code)

```
1. User fills register form → calls POST /auth/register
   └── Do NOT send taxCode. Send selfTechnical if user checks the toggle.

2. Store tokens + user → redirect to dashboard.

3. Later: User goes to Account Settings → enters tax code → calls POST /auth/verify-tax-code
   └── If verified: show "✅ CÔNG TY TNHH ABC" + save via PUT /users/me
```

### Flow 2 — Account Settings (Verify Tax Code)

User navigates to `/ceo/account-setting` → "Verify Tax Code" section:

```
Step 1: User types tax code into input
Step 2: On blur or debounce 500ms → call POST /auth/verify-tax-code
Step 3: If { verified: true }:
          - Show green: "✅ Verified: {companyName}"
          - Auto-fill companyName field
          - Call PUT /users/me with { taxCode, isTaxVerified: true, companyName }
Step 4: If { verified: false }:
          - Show red: "❌ Tax code not recognized"
```

### FE Pattern for Verify Tax Code (Account Settings)

```ts
const handleVerifyTaxCode = async (taxCode: string) => {
  if (!taxCode || taxCode.length < 10) return;

  try {
    const { data } = await apiClient.post('/auth/verify-tax-code', { taxCode });

    if (data.verified) {
      // Show success
      setTaxStatus({ verified: true, companyName: data.companyName });

      // Persist to backend
      await apiClient.put('/users/me', {
        taxCode,
        isTaxVerified: true,
        companyName: data.companyName,
      });
    } else {
      // Show error
      setTaxStatus({ verified: false, companyName: null });
    }
  } catch (err) {
    setTaxStatus({ verified: false, companyName: null });
  }
};
```

---

## Register Form — Update Checklist

| File | What to Change |
|---|---|
| `features/ceo/auth/CeoRegister.tsx` | Remove `taxCode` field from form |
| `features/ceo/auth/CeoRegister.tsx` | Add `selfTechnical` checkbox: *"I have technical expertise"* |
| `features/expert/auth/ExpertRegister.tsx` | Remove `taxCode` field (if it was there) |
| `components/pages/ProfileSettingPage.tsx` | Update tax code verification to call `POST /auth/verify-tax-code` instead of the old broken endpoint |
| `components/pages/UserProfilePage.tsx` | Update "Verified Company" badge logic — only show if `user.activeRoleProfile.isTaxVerified === true` |

---

## Quick Reference

| Endpoint | Auth | Sends | Returns |
|---|---|---|---|
| `POST /auth/register` | No | `{ email, password, fullName, phone?, roles, selfTechnical? }` | `{ access_token, refresh_token, user }` |
| `POST /auth/verify-tax-code` | JWT (CLIENT) | `{ taxCode }` | `{ verified, companyName }` |
| `PUT /users/me` | JWT | `{ taxCode?, isTaxVerified?, companyName?, ... }` | `{ success: true }` |

---

*End of Integration Guide*
