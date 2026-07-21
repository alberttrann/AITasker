# Expert Profile Building Flow: Bug Fixes & Developer Tutorial Guide

This guide documents the root causes, complete code changes, and best practices learned while diagnosing and fixing the **Expert Profile Building** flow across the React frontend and NestJS backend.

---

## 📌 Executive Summary

During testing of the Expert Profile Building flow (Steps 1 through 4), three critical categories of failures prevented experts from completing their profiles:

1. **HTTP Method Mismatches (`404 Not Found`)**:
   - `POST /expert-profile/domains/sync` → NestJS controller only registered `@Put('sync')`.
   - `POST /expert-profile/seams/sync` → NestJS controller only registered `@Put('sync')`.
   - `PATCH /expert-profile/me` → NestJS controller only registered `@Put('me')`.

2. **Payload Property Schema Mismatch**:
   - Frontend sent `{ items: [{ code, depth }] }`, whereas backend `SyncDomainsDto` expected `{ domains: [{ domainCode, depthLevel }] }`.
   - Frontend sent `{ items: [{ code }] }`, whereas backend `SyncSeamsDto` expected `{ seams: ["A↔B", ...] }`.

3. **Seam Code Character Separator Mismatch (`↔` vs `<->`)**:
   - Frontend `SeamClaimsGrid` hardcoded `seam.code.split('<->')`. Backend returned unicode arrow `A↔B`.
   - `.split('<->')` failed to split, causing all seam options to remain disabled with red error *"Requires domains A↔C"*.

---

## 🛠️ Detailed Code Changes Made

### 1. Frontend React Query Mutations (`frontend/src/hooks/use-expert-profile.ts`)

#### [use-expert-profile.ts](file:///d:/AITaskerVer4/frontend/src/hooks/use-expert-profile.ts)

```typescript
// ❌ BEFORE (Caused 404s and validation failures):
const saveDomains = useMutation({
  mutationFn: async (domains: { domainCode: string; depthLevel: string }[]) => {
    await apiClient.post('/expert-profile/domains/sync', {
      items: domains.map(d => ({ code: d.domainCode, depth: d.depthLevel })),
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
  },
});

const saveSeams = useMutation({
  mutationFn: async (seams: { code: string }[]) => {
    await apiClient.post('/expert-profile/seams/sync', {
      items: seams.map(s => ({ code: s.code })),
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
  },
});

const saveStackAndModel = useMutation({
  mutationFn: async (payload: { engagementModel?: string; stackTagsJson?: string[]; archetypeHistoryJson?: any[]; bio?: string }) => {
    await apiClient.patch('/expert-profile/me', payload);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
  },
});

// ✅ AFTER (Fixed HTTP methods and request body field names):
const saveDomains = useMutation({
  mutationFn: async (domains: { domainCode: string; depthLevel: string }[]) => {
    await apiClient.put('/expert-profile/domains/sync', {
      domains: domains.map(d => ({ domainCode: d.domainCode, depthLevel: d.depthLevel })),
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
  },
});

const saveSeams = useMutation({
  mutationFn: async (seams: { code: string }[]) => {
    await apiClient.put('/expert-profile/seams/sync', {
      seams: seams.map(s => s.code),
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
  },
});

const saveStackAndModel = useMutation({
  mutationFn: async (payload: { engagementModel?: string; stackTagsJson?: string[]; archetypeHistoryJson?: any[]; bio?: string }) => {
    await apiClient.put('/expert-profile/me', payload);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['expert-profile', 'me'] });
  },
});
```

---

### 2. Seam Code Separator Parsing (`frontend/src/features/expert/profile/SeamClaimsGrid.tsx`)

#### [SeamClaimsGrid.tsx](file:///d:/AITaskerVer4/frontend/src/features/expert/profile/SeamClaimsGrid.tsx)

```typescript
// ❌ BEFORE (Line 117 failed to split unicode '↔'):
const requiredDomains = seam.code.split('<->');

// ✅ AFTER (Handles both '↔' and '<->' dynamically):
const requiredDomains = seam.code.includes('↔') ? seam.code.split('↔') : seam.code.split('<->');
```

---

### 3. Backend NestJS Controllers Dual-Decorator Support

#### [domain-depths.controller.ts](file:///d:/AITaskerVer4/backend/src/expert-profiles/domain-depths.controller.ts)
```typescript
@Put('sync')
@Post('sync') // Added alias for POST requests
@ApiBearerAuth('JWT')
async syncDomainDepths(@CurrentUser() user: { id: string }, @Body() dto: SyncDomainsDto) {
  return this.expertProfileService.syncDomainDepths(user.id, dto.domains);
}
```

#### [seam-claims.controller.ts](file:///d:/AITaskerVer4/backend/src/expert-profiles/seam-claims.controller.ts)
```typescript
@Put('sync')
@Post('sync') // Added alias for POST requests
@ApiBearerAuth('JWT')
async syncSeamClaims(@CurrentUser() user: { id: string }, @Body() dto: SyncSeamsDto) {
  return this.expertProfileService.syncSeamClaims(user.id, dto.seams);
}
```

#### [expert-profiles.controller.ts](file:///d:/AITaskerVer4/backend/src/expert-profiles/expert-profiles.controller.ts)
```typescript
@Put('me')
@Patch('me') // Added alias for PATCH requests
@ApiBearerAuth('JWT')
async updateMyProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateExpertProfileDto) {
  return this.expertService.updateMyProfile(user.id, dto);
}
```

---

## 🎓 Developer Tutorial & Best Practices

### Rule 1: Always Match Controller Method Decorators in API Clients
In NestJS, routes are method-strict. A `@Put()` route will not match a `POST` or `PATCH` request unless explicit decorators are added:
```typescript
// NestJS Controller:
@Put('me')
@Patch('me') // Supports both PUT and PATCH
```

### Rule 2: Keep DTO Names and Client Request Body Keys Identical
Before making frontend mutations, inspect the backend DTO class:
```typescript
// backend SyncDomainsDto:
export class SyncDomainsDto {
  @IsArray()
  domains: UpsertDomainDepthDto[]; // Key MUST be 'domains', not 'items'
}
```

### Rule 3: Robust String Separator Handling
When dealing with composite keys (like `A↔B` or `A<->B`), use regex or fallback checks to avoid broken splits:
```typescript
const parts = code.split(/↔|<->/);
```

---

## 🧪 Verification Matrix

| Step | Flow Component | Action | Expected Result | Result |
|---|---|---|---|---|
| Step 1 | Domain Expertise | Select levels, click *Save & Continue* | `PUT /expert-profile/domains/sync` returns 200 OK | ✅ Passed |
| Step 2 | Seam Expertise | View available seams | Seams like `A↔B` are enabled when domains A and B are selected | ✅ Passed |
| Step 2 | Seam Expertise | Select 2-5 seams, click *Save & Continue* | `PUT /expert-profile/seams/sync` returns 200 OK | ✅ Passed |
| Step 3 | Stack, Model & Bio | Fill bio and tags, click *Save & Continue* | `PUT /expert-profile/me` returns 200 OK (no 404 PATCH error) | ✅ Passed |
| Step 4 | Profile Review | Click *Publish Expert Profile* | Profile published successfully | ✅ Passed |
