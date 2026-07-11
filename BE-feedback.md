# Backend Feedback & Fixes

## Elicitation Stage Progression Bug

**Issue:** 
When a user goes back to Stage 1 and re-submits the exact same symptom text, the backend skips the AI call to save time (cache hit). However, when it returned the cached result, it failed to advance the session's `currentStage` back to 2 in the database. This caused the frontend to move to Stage 2 locally, while the backend was stuck on Stage 1, resulting in a "Session is at stage 1, expected stage 2" error when trying to proceed to Stage 3.

**Required Fix:**
In `backend/src/elicitation/elicitation.service.ts`, update the `submitStage1` method (around line 123) to ensure the stage is advanced even when using the cache:

**Change this:**
```typescript
    // LLM skip: if content is identical to what's already stored, skip AI call
    if (
      session.stage1SymptomsJson &&
      session.stage1OriginalInput === symptomText.trim()
    ) {
      return session; // return cached result without re-calling AI
    }
```

**To this:**
```typescript
    // LLM skip: if content is identical to what's already stored, skip AI call
    if (
      session.stage1SymptomsJson &&
      session.stage1OriginalInput === symptomText.trim()
    ) {
      // FIX: Ensure we still advance the stage to 2 even when using cache!
      if (session.currentStage === 1) {
        return this.prisma.elicitationSession.update({
          where: { id: sessionId },
          data: { currentStage: 2 },
        });
      }
      return session; 
    }
```

---

## Integrate Email Verification to Stage 4 Handoff

**Issue:**
When a CEO inputs an email to invite their tech team in Elicitation Stage 4, we want to run our rigorous `EmailValidatorService` check (MX records, disposable domains) against the provided email to ensure it's legitimate before generating the token and link.

**Required Fix:**
The frontend component (`Stage4ScenarioB.tsx`) is already equipped to gracefully catch and display whatever custom error message the backend throws (`err.response.data.message`). Therefore, absolutely zero frontend changes are required. 

To integrate this in the backend, follow these 3 steps:

1. **Export the validator in `auth.module.ts`**
   Open `backend/src/auth/auth.module.ts` and add `EmailValidatorService` to the `exports` array so that the elicitation module can use it:
   ```typescript
     exports: [JwtStrategy, PassportModule, AuthService, EmailValidatorService],
   ```

2. **Inject the validator in `elicitation.service.ts`**
   Open `backend/src/elicitation/elicitation.service.ts` and add it to the constructor:
   ```typescript
   constructor(
     private readonly prisma: PrismaService,
     private readonly fastapiClient: FastapiClient,
     private readonly jwtService: JwtService,
     private readonly authService: AuthService,
     private readonly matchingHelper: MatchingHelperService,
     private readonly eventEmitter: EventEmitter2,
     private readonly emailValidatorService: EmailValidatorService, // Add this
   ) {}
   ```

3. **Call the validator in the `inviteTechTeam` method**
   In the same file (`elicitation.service.ts`), scroll down to `inviteTechTeam` (around line 424) and add the validation check right before generating the token:
   ```typescript
   async inviteTechTeam(sessionId: string, ceoUserId: string, email: string) {
     const session = await this.findSessionOrThrow(sessionId);
     this.assertOwnership(session, ceoUserId);

     // ADD THIS LINE:
     await this.emailValidatorService.assertValidEmail(email);

     const jti = randomUUID();
     // ... rest of the method generating the token
   }
   ```

---

## Missing Expert Name in CEO Bids Views

**Issue:**
On the CEO bids list page (`/ceo/projects/:id/bids`) and the individual bid review page (`/ceo/project/:id/bids/:bidId`), the expert's name is not displayed because the backend endpoints don't include the `expert` relation in their database queries. This causes the frontend to display the fallback value `'Expert'`.

**Required Fix 1 (For the Bids List):**
In `backend/src/engagements/engagements.service.ts`, inside the `findAll` method for the CEO case (around line 74), include the expert relation so the frontend can read `expert.fullName`:

**Change this:**
```typescript
    // 3. CEO — engagements where they are the client.
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      return this.prisma.engagement.findMany({
        where: { clientId: user.id },
        include: {
          project: PROJECT_SUMMARY_SELECT,
          capabilityBid: true,
        },
        orderBy: { id: 'desc' },
      });
    }
```

**To this:**
```typescript
    // 3. CEO — engagements where they are the client.
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      return this.prisma.engagement.findMany({
        where: { clientId: user.id },
        include: {
          project: PROJECT_SUMMARY_SELECT,
          capabilityBid: true,
          expert: { select: { fullName: true } }, // <-- ADD THIS
        },
        orderBy: { id: 'desc' },
      });
    }
```

**Required Fix 2 (For the Individual Bid Review):**
In `backend/src/bids/bids.service.ts`, inside the `findById` method (around line 146), include the engagement and expert relations in the query so the frontend can read it via `engagement.expert.fullName`. You can then reuse the included engagement for the party check.

**Change this:**
```typescript
  async findById(bidId: string, user: ActorUser) {
    // 1. fetch the bid row only 
    const bid = await this.prisma.capabilityBid.findUnique({ where: { id: bidId } });
    if (!bid) {
      throw new NotFoundException('Bid not found.');
    }

    // 2. fetch the engagement separately for the party check
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: bid.engagementId },
      select: { id: true, expertId: true, projectId: true },
    });
```

**To this:**
```typescript
  async findById(bidId: string, user: ActorUser) {
    // 1. fetch the bid row with engagement and expert included
    const bid = await this.prisma.capabilityBid.findUnique({ 
      where: { id: bidId },
      include: {
        engagement: {
          include: { expert: { select: { fullName: true } } }
        }
      }
    });
    if (!bid) {
      throw new NotFoundException('Bid not found.');
    }

    // 2. use the included engagement for the party check
    const engagement = bid.engagement;
```

---

## Services Controller Routing Bug

**Issue:**
When fetching the expert's own services via `GET /services/me`, the request is intercepted by the wildcard route `GET /services/:id` because the `:id` route is defined before the `me` route in the controller. This causes the backend to try to parse `'me'` as a UUID, resulting in a `400 Bad Request` error. As a result, the frontend cannot load the expert's posted services.

**Required Fix:**
In `backend/src/listings/listings.controller.ts`, reorder the routes so that the specific `me` routes are defined *before* the wildcard `:id` route.

Move these two endpoints:
```typescript
  @ApiBearerAuth('JWT')
  @Get('me')
  @Roles('EXPERT')
  async myListings(@CurrentUser() user: { id: string }) { ... }

  @ApiBearerAuth('JWT')
  @Get('me/purchases')
  @Roles('CLIENT')
  async myPurchases(@CurrentUser() user: { id: string }) { ... }
```

To be *above* the `findOne` endpoint:
```typescript
  @ApiBearerAuth('JWT')
  @Get(':id')
  async findOne(...) { ... }
```

---

## FastAPI Microservice 503 Error on Service Generation

**Issue:**
When a PRO expert attempts to use the AI Generation feature (`POST /services` with `useAiGenerator: true`), the NestJS backend calls the Python FastAPI microservice at `/llm/service-generate`. The FastAPI service is returning a `503 Service Unavailable`, which cascades up to the frontend as a `500 Internal Server Error`.

**Required Fix:**
1. Ensure the Python FastAPI microservice is actually running alongside the NestJS backend in your local development environment.
2. If it is running, check the FastAPI terminal logs. A 503 usually means the LLM provider (e.g. OpenAI) call failed due to missing environment variables, network issues, or API rate limits.

---

## Standardize AI Service Generator Output Schema (`serviceGenerate`)

**Issue:**
Currently, the AI Generator endpoint (`/llm/service-generate`) returns `scope` and `timeline` as unstructured text or sometimes Python-style string representations (e.g., `"['INCLUDED:', ...]"`) which can cause display issues when populating structured form inputs on the frontend.

**Required Fix:**
To integrate seamlessly with the Frontend dynamic input builders (`ServiceCreateModal`), please ensure the FastAPI prompt/response schema for `serviceGenerate` follows this clean output format:

1. **`scope` (JSON Array String or Clean Newline-Separated Deliverables)**
   Configure the AI output schema for `scope` to return a **JSON array of clean strings** (or clean newline-separated deliverables without python array syntax `['...']`).
   - **Expected format (JSON array string):**
     ```json
     [
       "RAG system architecture design tailored for e-commerce data",
       "Implementation of RAG pipeline using Langchain and Pinecone",
       "Development of a conversational interface for chatbot"
     ]
     ```

2. **`timeline` (Structured Phases separated by Newlines)**
   Instruct the LLM to format the `timeline` string strictly with one phase per line using `Phase X: [Name] ([Duration])`, followed by a final line for `Total Estimated Time`.
   - **Expected format:**
     ```text
     Phase 1: Discovery & System Architecture Design (1 week)
     Phase 2: RAG Pipeline Development & Integration (2-3 weeks)
     Phase 3: Testing & Deployment (1 week)
     Total Estimated Time: 4-5 weeks
     ```
