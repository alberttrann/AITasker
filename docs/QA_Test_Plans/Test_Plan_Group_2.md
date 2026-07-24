# E2E QA Test Plan

## 1. Test Environments & Preconditions
- **Test Environments:** Docker setups (isolated vs full UI) and observability tools (Prisma Studio, DevTools, DB logs).
- **Universal Checks:** Baseline checks that must pass on *every* screen (e.g., JWT validation, role-guards, UI feedback, double-submission prevention).
- **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh.
- **Data Seeds:** Ensure you have the correct persona (e.g. CEO-A, EXP-B) seeded in the database before starting the flow.

---

## Group 2 — Path A: Project Elicitation & Publication

---

# MF-4: AI Elicitation Engine (5-Stage)

## Overview

Transforms CEO free-text symptom description into a published project spec via 5 diagnostic stages. All configuration (archetypes, probe questions, void codes, domains, seams) is fetched from DB tables at call time — nothing is hardcoded in the AI service. Prompts are fetched from `prompt_templates` table with 60-second TTL cache and `.txt` file fallback. Stage 4 includes critical artifact submission. Stage 5 synthesis produces cost/duration estimates per milestone.

**Tables touched (10):** `elicitation_sessions`, `archetype_definitions`, `void_code_definitions`, `probe_questions`, `projects`, `platform_decisions`, `tech_team_profiles`, `domain_definitions`, `seam_definitions`, `prompt_templates`

**Key changes from old doc:** (1) Stage 1: LLM skip if unchanged input; `stage1_original_input` persisted; `estimated_budget_vnd` extracted; `critical_artifacts_json` detected. (2) Stage 2: archetype list from `archetype_definitions` DB — NOT hardcoded; void descriptions from `void_code_definitions`. (3) Stage 3: probe questions from `probe_questions` table — NOT hardcoded; dual check adds `irrelevant_answers` array; vagueness no longer blocks (advisory only). (4) Stage 4: `stage4-draft` auto-save endpoint; `technical_artifacts` dict for critical content; `missingArtifacts` warning response. (5) Stage 5: `estimated_total_cost_vnd` + `estimated_total_duration_days` in response.

**Endpoints:** `POST /elicitation/sessions`, `GET /elicitation/sessions/active`, `GET /elicitation/sessions`, `GET /elicitation/sessions/:id`, `PATCH /elicitation/sessions/:id/draft`, `PUT /elicitation/sessions/:id/stage1`, `GET /config/archetypes`, `GET /config/void-codes`, `PUT /elicitation/sessions/:id/stage2`, `GET /config/archetypes/:code/probe-questions`, `PUT /elicitation/sessions/:id/stage3`, `PATCH /elicitation/sessions/:id/stage4-draft` (NEW), `PUT /elicitation/sessions/:id/stage4`, `PUT /elicitation/sessions/:id/stage4-handoff`, `PUT /elicitation/sessions/:id/self-technical`, `POST /elicitation/sessions/:id/stage4-recommend`, `POST /elicitation/sessions/:id/stage5`, `PUT /elicitation/sessions/:id/revert`, `PUT /elicitation/sessions/:id/continue`, `PUT /elicitation/sessions/:id/abandon`, `DELETE /elicitation/sessions/:id`, `POST /elicitation/sessions/:id/retry-synthesis`, `GET /matching/:projectId/shortlist`

---

## ASCII Swimlane

```
┌──────────────────────────┬──────────────────────────────────────────────┬──────────────────────────┐
│      CLIENT / CEO        │       SYSTEM (NestJS + FastAPI)              │   CLIENT / TECH_TEAM     │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ SESSION START ══════  │                                              │                          │
│ [1] Clicks "New Project" │                                              │                          │
│   Sub guard: [Pro-C]     │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [2] Check for active session:                │                          │
│                          │   GET /elicitation/sessions/active           │                          │
│                          │   IF exists → return session (resume)        │                          │
│                          │   IF none → POST /elicitation/sessions:      │                          │
│                          │     INSERT elicitation_sessions {            │                          │
│                          │       user_id, current_stage:1,              │                          │
│                          │       state:"IN_PROGRESS",                   │                          │
│                          │       void_list_json:"[]" }                  │                          │
│ <────────────────────────┤                                              │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 1: SYMPTOMS ══  │                                              │                          │
│ [3] Types symptom text   │                                              │                          │
│   Auto-save draft:       │                                              │                          │
│   PATCH .../draft        │                                              │                          │
│   {symptomTextDraft:"..."│                                              │                          │
│   } (every 30s, no LLM)  │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [4] UPDATE elicitation_sessions SET          │                          │
│                          │     symptom_text_draft = draft               │                          │
│                          │   Return {saved:true} (no LLM call)          │                          │
│ <────────────────────────┤                                              │                          │
│ [5] Submits final text   │                                              │                          │
│   PUT .../stage1         │                                              │                          │
│   {symptomText:"We need  │                                              │                          │
│    an AdTech compliance  │                                              │                          │
│    pipeline based on our │                                              │                          │
│    compliance ruleset.   │                                              │                          │
│    Budget ~200M VND"}    │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [6] LLM skip check:                          │                          │
│                          │   IF symptomText === stage1_original_input   │                          │
│                          │     → return cached result (no AI call)      │                          │
│                          │                                              │                          │
│                          │ [7] Fetch live config for prompt injection:  │                          │
│                          │   SELECT archetype_definitions WHERE active  │                          │
│                          │   SELECT void_code_definitions WHERE active  │                          │
│                          │   ← injected as Jinja2 vars into prompt      │                          │
│                          │   ← prompt fetched from prompt_templates     │                          │
│                          │     table (60s TTL, .txt fallback) [NEW]     │                          │
│                          │                                              │                          │
│                          │ [8] [AI] FastAPI stage1_extract:             │                          │
│                          │   Injects {{archetypes}} {{void_codes}}      │                          │
│                          │   Returns {                                  │                          │
│                          │     symptoms:[...],                          │                          │
│                          │     scale_signals:{budget_vnd:200000000,...},│                          │
│                          │     voids:[{void_code,severity}],            │                          │
│                          │     recommended_archetypes:["3","1"],        │                          │
│                          │     critical_artifacts_required: [NEW]       │                          │
│                          │       [{artifact_key:"compliance_ruleset",   │                          │
│                          │         label:"Compliance Ruleset",          │                          │
│                          │         reason:"Ruleset defines acceptance   │                          │
│                          │           criteria for all milestones",      │                          │
│                          │         placeholder_prompt:"Paste your       │                          │
│                          │           compliance rules here"}]           │                          │
│                          │   }                                          │                          │
│                          │                                              │                          │
│                          │ [9] UPDATE elicitation_sessions SET          │                          │
│                          │     stage1_original_input = symptomText [NEW]│                          │
│                          │     stage1_symptoms_json = symptoms          │                          │
│                          │     void_list_json = voids                   │                          │
│                          │     recommended_archetypes_json = [...]      │                          │
│                          │     estimated_budget_vnd = 200000000 [NEW]   │                          │
│                          │     critical_artifacts_json = [...] [NEW]    │                          │
│                          │     current_stage = 2                        │                          │
│ <────────────────────────┤                                              │                          │
│ [10] FE shows diff:      │                                              │                          │
│   "What you wrote" vs    │                                              │                          │
│   "What AI extracted"    │                                              │                          │
│   IF critical_artifacts  │                                              │                          │
│     non-empty: show      │                                              │                          │
│     PERSISTENT BANNER:   │                                              │                          │
│   "Submit these docs in  │                                              │                          │
│    Stage 4 for accurate  │                                              │                          │
│    project scope"        │                                              │                          │
│   Voids cross-ref:       │                                              │                          │
│   GET /config/void-codes │                                              │                          │
│   → descriptions for     │                                              │                          │
│     display to CEO       │                                              │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 2: ARCHETYPE ══ │                                              │                          │
│ [11] Fetch archetype list│                                              │                          │
│   GET /config/archetypes │                                              │                          │
│   [NOT HARDCODED — live] │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [12] SELECT archetype_definitions            │                          │
│                          │   WHERE is_active=true ORDER sort_order      │                          │
│                          │   Return [{code:"1",name:"RAG/Search",...}]  │                          │
│ <────────────────────────┤                                              │                          │
│ [13] CEO reads void list │                                              │                          │
│   GET /config/void-codes │                                              │                          │
│   → names+descriptions   │                                              │                          │
│   CEO must acknowledge   │                                              │                          │
│   ALL detected voids     │                                              │                          │
│   Selects archetype "3"  │                                              │                          │
│   (AI recommended)       │                                              │                          │
│   PUT .../stage2         │                                              │                          │
│   {archetype:"3",        │                                              │                          │
│    acknowledgedVoidCodes: │                                             │                          │
│    ["MISSING_TECHNICAL_  │                                              │                          │
│     ARTIFACT","NO_GROUND_│                                              │                          │
│     TRUTH"]}             │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [14] Validate archetype code exists in       │                          │
│                          │   archetype_definitions [NEW — was in        │                          │
│                          │   recommended set check only]                │                          │
│                          │   UPDATE elicitation_sessions SET            │                          │
│                          │     archetype = "3" (locked - immutable)     │                          │
│                          │     current_stage = 3                        │                          │
│ <────────────────────────┤                                              │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 3: PROBE Q's ══ │                                              │                          │
│ [15] Fetch probe questions│                                             │                          │
│   GET /config/archetypes/│                                              │                          │
│     3/probe-questions    │                                              │                          │
│   [NOT HARDCODED — live] │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [16] SELECT probe_questions WHERE            │                          │
│                          │   archetype_code="3" AND is_active=true      │                          │
│                          │   ORDER BY display_order                     │                          │
│                          │   Return [{questionText:"How many items      │                          │
│                          │     need classifying per day?"},...] [NEW]   │                          │
│ <────────────────────────┤                                              │                          │
│ [17] CEO answers all     │                                              │                          │
│   questions (required)   │                                              │                          │
│   PUT .../stage3         │                                              │                          │
│   {probe_responses:{     │                                              │                          │
│     "How many items per  │                                              │                          │
│      day?": "50,000",    │                                              │                          │
│     "What happens on low │                                              │                          │
│      confidence?":"Route │                                              │                          │
│      to human reviewer"  │                                              │                          │
│   }}                     │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [17] [AI] FastAPI stage3_vagueness_check:    │                          │
│                          │   Passes: archetype, questions, responses,   │                          │
│                          │   stage1_symptoms [NEW], stage1_voids [NEW]  │                          │
│                          │   ← context enables RELEVANCY check          │                          │
│                          │   DUAL CHECK [NEW]:                          │                          │
│                          │   a. Vagueness check (existing):             │                          │
│                          │      vague_answers:[{question,reason}]       │                          │
│                          │   b. Relevancy check [NEW]:                  │                          │
│                          │      irrelevant_answers:[{question,issue}]   │                          │
│                          │      ← checks if answer addresses actual     │                          │
│                          │        project context, not just vague/not   │                          │
│                          │                                              │                          │
│                          │ [18] BOTH checks are ADVISORY ONLY [NEW]:    │                          │
│                          │   (old: vague → 422, CEO must re-answer)     │                          │
│                          │   (new: both advisory, always advances)      │                          │
│                          │   UPDATE elicitation_sessions SET            │                          │
│                          │     stage3_probes_json = {q:a pairs}         │                          │
│                          │     current_stage = 4                        │                          │
│                          │   Return {                                   │                          │
│                          │     currentStage:4,                          │                          │
│                          │     vaguenessResult:{                        │                          │
│                          │       vague_answers:[...],                   │                          │
│                          │       irrelevant_answers:[...] [NEW]         │                          │
│                          │     }                                        │                          │
│                          │   }                                          │                          │
│ <────────────────────────┤                                              │                          │
│ [19] FE shows:           │                                              │                          │
│   vague_answers →        │                                              │                          │
│     "Please be specific" │                                              │                          │
│   irrelevant_answers →   │                                              │                          │
│     "Off-topic answer"   │                                              │                          │
│   [SEPARATE sections]    │                                              │                          │
│   CEO proceeds anyway    │                                              │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 4: TECH CONTEXT ══════════════════════════════════════════════════════════════════════    │
│                          │                                              │                          │
│ BRANCH A: CEO fills form │                                              │                          │
│  [20a] PUT .../self-     │                                              │                          │
│   technical {self:true}  │                                              │                          │
│  Auto-save draft:        │                                              │                          │
│  PATCH .../stage4-draft  │                                              │                          │
│  {draftJson:{stack,...}} │                                              │                          │
│  (every 30s, no LLM)     │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [21a] UPDATE elicitation_sessions SET        │                          │
│                          │   stage4_draft_json = draftJson [NEW]        │                          │
│                          │   Return {saved:true}                        │                          │
│ <────────────────────────┤                                              │                          │
│  Optional AI suggest:    │                                              │                          │
│  POST .../stage4-recommend│                                             │                          │
│       └────────────────> │                                              │                          │
│                          │ [22a] [AI] FastAPI stage4_recommend:         │                          │
│                          │   Passes: symptoms, archetype, probes,       │                          │
│                          │   voids, additional_req, budget [UPDATED]    │                          │
│                          │   Returns pre-filled stack/integration/volume│                          │
│ <────────────────────────┤                                              │                          │
│  CEO submits Stage 4:    │                                              │                          │
│  PUT .../stage4          │                                              │                          │
│  {current_stack:         │                                              │                          │
│    "Python FastAPI+PG",  │                                              │                          │
│   data_available:        │                                              │                          │
│    "50k assets/day CSV", │                                              │                          │
│   latency_requirement:   │                                              │                          │
│    "Under 2s at P95",    │                                              │                          │
│   additional_requirement │                                              │                          │
│    _1: "GDPR compliant", │                                              │                          │
│   technical_artifacts: { │                                              │                          │
│     compliance_ruleset:  │                                              │                          │
│      "Rule 1: No         │                                              │                          │
│       misleading health  │                                              │                          │
│       claims.\nRule 2:   │                                              │                          │
│       Financial products │                                              │                          │
│       must show APR."    │                                              │                          │
│   }} [NEW — critical     │                                              │                          │
│      artifact content]   │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [23a] Compute missingArtifacts:              │                          │
│                          │   criticalArtifacts = session.               │                          │
│                          │     critical_artifacts_json                  │                          │
│                          │   submittedKeys = Object.keys(               │                          │
│                          │     dto.technical_artifacts)                 │                          │
│                          │   missingArtifacts = criticalArtifacts       │                          │
│                          │     .filter(a => !submittedKeys              │                          │
│                          │       .includes(a.artifact_key))             │                          │
│                          │                                              │                          │
│                          │   UPDATE elicitation_sessions SET            │                          │
│                          │     stage4_tech_inputs_json = {              │                          │
│                          │       current_stack,data_available,          │                          │
│                          │       latency_requirement,                   │                          │
│                          │       additional_requirement_1,              │                          │
│                          │       technical_artifacts:{...}              │                          │
│                          │     }                                        │                          │
│                          │     current_stage = 5                        │                          │
│                          │   Return {session,missingArtifacts:[]}       │                          │
│ <────────────────────────┤                                              │                          │
│ [24a] If missingArtifacts│                                              │                          │
│   non-empty → show modal:│                                              │                          │
│   "Incomplete spec —     │                                              │                          │
│    proceed anyway?"      │                                              │                          │
│   NOT a hard block       │                                              │                          │
│   CEO may proceed        │                                              │                          │
│                          │                                              │                          │
│ BRANCH B: Delegate to    │                                              │                          │
│   Tech Team (MF-3)       │                                              │ [20b] TECH_TEAM          │
│   CEO shares link (MF-3) │                                              │   fills Stage 4 form     │
│   CEO polls GET /:id     │                                              │   (same fields + tech_   │
│   until currentStage≥5   │                                              │   artifacts) via:        │
│                          │                                              │   PATCH .../stage4-draft │
│                          │                                              │   PUT .../stage4-handoff │
│                          │                  ┌────────────────────────── │                          │
│                          │ [21b] Same TX as 23a but via stage4-handoff  │                          │
│                          │   Validates client_subtype='TECH_TEAM'       │                          │
│                          │                                              │                          │
├──────────────────────────┼──────────────────────────────────────────────┼──────────────────────────┤
│ ══ STAGE 5: SYNTHESIS ══ │                                              │                          │
│ [25] POST .../stage5     │                                              │                          │
│       └────────────────> │                                              │                          │
│                          │ [26] Fetch live config for prompt injection: │                          │
│                          │   SELECT domain_definitions WHERE active     │                          │
│                          │   SELECT seam_definitions WHERE active       │                          │
│                          │   SELECT archetype_definitions WHERE active  │                          │
│                          │   Fetch prompt from prompt_templates table   │                          │
│                          │     (GET /internal/prompts/stage5_synthesize)│                          │
│                          │     60s TTL, .txt fallback [NEW]             │                          │
│                          │                                              │                          │
│                          │ [27] [AI] FastAPI stage5_synthesize:         │                          │
│                          │   Injects {{domains}}{{seams}}{{archetypes}} │                          │
│                          │   (all from DB — not hardcoded) [NEW]        │                          │
│                          │   Injects technical_artifacts content        │                          │
│                          │     into prompt for grounded synthesis [NEW] │                          │
│                          │   IF missingArtifacts:                       │                          │
│                          │     completeness_score capped at 0.60 [NEW]  │                          │
│                          │     sdlc_notices include missing artifact warn│                         │
│                          │   Returns {                                  │                          │
│                          │     required_seams_json,                     │                          │
│                          │     required_domains_json,                   │                          │
│                          │     milestone_framework_json:[{              │                          │
│                          │       milestone_number,                      │                          │
│                          │       deliverable_statement,                 │                          │
│                          │         ← references actual ruleset content  │                          │
│                          │       estimated_cost_vnd [NEW],              │                          │
│                          │       estimated_duration_days [NEW]          │                          │
│                          │     }],                                      │                          │
│                          │     artifact_a_json, artifact_b_json,        │                          │
│                          │     completeness_score,                      │                          │
│                          │     estimated_total_cost_vnd [NEW],          │                          │
│                          │     estimated_total_duration_days [NEW]      │                          │
│                          │   }                                          │                          │
│                          │                                              │                          │
│                          │ [28] Quality gate (3 checks):                │                          │
│                          │   a. completeness_score ≥ 0.70               │                          │
│                          │   b. Matching pre-check: ≥1 expert above     │                          │
│                          │      threshold for required seams/domains    │                          │
│                          │   c. No unresolved hard voids                │                          │
│                          │                                              │                          │
│                          │ IF ALL PASS:                                 │                          │
│                          │ [29] DB TX (atomic):                         │                          │
│                          │   INSERT projects {                          │                          │
│                          │     client_id, state:"PUBLISHED",            │                          │
│                          │     archetype:"3", tier,                     │                          │
│                          │     required_seams_json,                     │                          │
│                          │     required_domains_json,                   │                          │
│                          │     milestone_framework_json,                │                          │
│                          │     artifact_a_json, artifact_b_json,        │                          │
│                          │     estimated_total_cost_vnd [NEW],          │                          │
│                          │     estimated_total_duration_days [NEW]      │                          │
│                          │   }                                          │                          │
│                          │   UPDATE elicitation_sessions SET            │                          │
│                          │     state:"COMPLETED"                        │                          │
│                          │   UPDATE tech_team_profiles SET              │                          │
│                          │     linked_project_id = project.id [BUG FIX] │                          │
│                          │     ← was always NULL in old doc             │                          │
│                          │   INSERT platform_decisions {                │                          │
│                          │     type:"ELICITATION_SYNTHESIS",            │                          │
│                          │     entity_id:project.id }                   │                          │
│                          │   COMMIT                                     │                          │
│                          │   Fire matching engine async                 │                          │
│                          │   → INSERT project_shortlist_cache           │                          │
│                          │                                              │                          │
│                          │ IF ANY FAIL:                                 │                          │
│                          │ [30] UPDATE elicitation_sessions SET         │                          │
│                          │     state:"RETURNED"                         │                          │
│                          │   INSERT platform_decisions {                │                          │
│                          │     type:"SPEC_AUTO_RETURN",                 │                          │
│                          │     advisory_note:"[specific void reason]"   │                          │
│                          │   }                                          │                          │
│                          │   CEO re-enters at specific stage via:       │                          │
│                          │   PUT .../revert {targetStage:N}             │                          │
│                          │   NOT from Stage 1                           │                          │
│ <────────────────────────┤                                              │                          │
│ [31] View published:     │                                              │                          │
│   GET /projects/:id      │                                              │                          │
│     → required_domains_json [NEW]│                                      │                          │
│     → required_seams_json [NEW]  │                                      │                          │
│     → milestone_framework_json   │                                      │                          │
│     → estimatedTotalCostVnd [NEW]│                                      │                          │
│     → estimatedTotalDuration [NEW]│                                     │                          │
│   GET /matching/:id/shortlist    │                                      │                          │
│     → 3-5 match cards            │                                      │                          │
└──────────────────────────┴──────────────────────────────────────────────┴──────────────────────────┘
```

## Step Detail Table

| Step | Actor | Action | Tables (CRUD) | State Change | Endpoint |
|---|---|---|---|---|---|
| 2 | NestJS | Create or resume session | `elicitation_sessions` (C) | state=IN_PROGRESS | `POST /elicitation/sessions` |
| 4 | NestJS | Save Stage 1 symptom draft (no LLM) | `elicitation_sessions` (U — draft) | — | `PATCH .../draft` |
| 7-8 | NestJS→FastAPI | Fetch live config; call Stage 1 LLM | `archetype_definitions` (R), `void_code_definitions` (R), `prompt_templates` (R) | — | FastAPI internal |
| 9 | NestJS | Persist Stage 1 outputs including critical_artifacts_json | `elicitation_sessions` (U) | stage=2 | `PUT .../stage1` |
| 12 | NestJS | Return live archetype list | `archetype_definitions` (R) | — | `GET /config/archetypes` |
| 14 | NestJS | Lock archetype; advance stage | `elicitation_sessions` (U) | stage=3 | `PUT .../stage2` |
| 16 | NestJS | Return live probe questions | `probe_questions` (R) | — | `GET /config/archetypes/:code/probe-questions` |
| 17-18 | NestJS→FastAPI | Dual check (vagueness+relevancy); advance stage | `elicitation_sessions` (U) | stage=4; both checks advisory | `PUT .../stage3` |
| 21a | NestJS | Save Stage 4 draft (no LLM, no stage advance) | `elicitation_sessions` (U — stage4_draft_json) | — | `PATCH .../stage4-draft` |
| 23a | NestJS | Compute missingArtifacts; save tech inputs | `elicitation_sessions` (U) | stage=5 | `PUT .../stage4` |
| 26-27 | NestJS→FastAPI | Fetch live config; run Stage 5 synthesis | `domain_definitions` (R), `seam_definitions` (R), `archetype_definitions` (R), `prompt_templates` (R) | — | FastAPI internal |
| 29 | NestJS | Create project; link TECH_TEAM; fire matching | `projects` (C), `elicitation_sessions` (U), `tech_team_profiles` (U), `platform_decisions` (C), `project_shortlist_cache` (C) | PUBLISHED | `POST .../stage5` |

---

