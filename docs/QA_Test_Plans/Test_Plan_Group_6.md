# E2E QA Test Plan

## 1. Test Environments & Preconditions
- **Test Environments:** Docker setups (isolated vs full UI) and observability tools (Prisma Studio, DevTools, DB logs).
- **Universal Checks:** Baseline checks that must pass on *every* screen (e.g., JWT validation, role-guards, UI feedback, double-submission prevention).
- **Cross-actor visibility:** Other involved actors receive the right notification/socket update and see the new state after refresh.
- **Data Seeds:** Ensure you have the correct persona (e.g. CEO-A, EXP-B) seeded in the database before starting the flow.

---

## Group 6 — Messaging, Notifications & Chat

---

# MF-14: Messaging & Notifications

## Overview

Two-channel messaging system: project-scoped (pre-bid Q&A) and engagement-scoped (post-connection). All WebSocket notifications are now persisted to `notifications` table for REST retrieval on page refresh. `GET /conversations` provides a unified thread list (inbox view).

**Tables touched (4):** `messages`, `message_reads`, `notifications`, `engagements`

**Key changes from old doc:** (1) `notifications` table is entirely new. (2) All `notification:generic` events now persisted to DB — survive page refresh. (3) `GET /conversations` (new — unified thread list with last message + unread count). (4) `GET /projects/:id/messages/unread-count` (new). (5) `GET /engagements/:id/messages/unread-count` (was named differently in old doc).

**Endpoints:** `GET /conversations`, `GET /projects/:id/messages`, `GET /projects/:id/messages/unread-count`, `POST /messages/:id/read`, `GET /engagements/:id/messages`, `GET /engagements/:id/messages/unread-count`, `GET /notifications/me`, `GET /notifications/me/unread-count`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id`

---

## ASCII Swimlane

```
┌────────────────────────────┬──────────────────────────────────────────────────────┐
│    ALL PARTIES             │           SYSTEM (NestJS + WebSocket)                │
├────────────────────────────┼──────────────────────────────────────────────────────┤
│ ══ NOTIFICATIONS (Persistent) [NEW] ══════════════════════════════════════════════│
│                            │                                                      │
│ [1] Any event fires:       │                                                      │
│   EventEmitter.emit(       │                                                      │
│     'socket.broadcast',    │                                                      │
│     {userId,event,payload})│                                                      │
│                            │                                                      │
│                            │ [2] Gateway @OnEvent('socket.broadcast'):            │
│                            │   Step A: Emit real-time socket event:               │
│                            │     server.to(userId).emit(event,payload)            │
│                            │   Step B: IF event='notification:generic':           │
│                            │     INSERT notifications {                           │
│                            │       user_id: userId,                               │
│                            │       type: payload.type,                            │
│                            │       title: payload.title,                          │
│                            │       body: payload.body,                            │
│                            │       link: payload.link,                            │
│                            │       is_read:false                                  │
│                            │     }                                                │
│                            │   FAIL-OPEN: DB write failure never blocks           │
│                            │     WebSocket delivery                               │
│                            │                                                      │
│ [3] On page load/refresh:  │                                                      │
│   GET /notifications/me    │                                                      │
│     ?unreadOnly=true       │                                                      │
│     &limit=50 [NEW]        │                                                      │
│       └──────────────────> │                                                      │
│                            │ [4] SELECT notifications WHERE                       │
│                            │   user_id=? ORDER BY created_at DESC                 │
│                            │   Return [{id,type,title,body,link,                  │
│                            │     is_read,created_at}]                             │
│ <──────────────────────────┤                                                      │
│ [5] GET /notifications/me/ │                                                      │
│   unread-count             │                                                      │
│       └──────────────────> │                                                      │
│                            │ [6] SELECT COUNT WHERE user_id=?                     │
│                            │   AND is_read=false                                  │
│                            │   Return {unread_count:N} → nav badge                │
│ <──────────────────────────┤                                                      │
│ [7] PUT /notifications/:id/│                                                      │
│   read [NEW]               │                                                      │
│ PUT /notifications/read-all│                                                      │
│ DELETE /notifications/:id  │                                                      │
│                            │ [8] UPDATE notifications SET                         │
│                            │   is_read=true, read_at=now()                        │
│                            │   (or bulk, or delete)                               │
│                            │                                                      │
├────────────────────────────┼──────────────────────────────────────────────────────┤
│ ══ CONVERSATIONS THREAD LIST [NEW] ═══════════════════════════════════════════════│
│ [9] GET /conversations     │                                                      │
│   [NEW — inbox sidebar]    │                                                      │
│       └──────────────────> │                                                      │
│                            │ [10] For current user: SELECT engagements WHERE      │
│                            │   (expert_id OR client_id) = userId                  │
│                            │   For each engagement:                               │
│                            │     SELECT last message + unread count               │
│                            │   Return [{                                          │
│                            │     type:"engagement",                               │
│                            │     id:engagement_id,                                │
│                            │     projectName:"...",                               │
│                            │     otherParty:{id,fullName},                        │
│                            │     lastMessage:{content,createdAt},                 │
│                            │     unreadCount:N                                    │
│                            │   }] sorted by lastMessage.createdAt DESC            │
│ <──────────────────────────┤                                                      │
│                            │                                                      │
├────────────────────────────┼──────────────────────────────────────────────────────┤
│ ══ MESSAGING CHANNELS ═════│                                                      │
│ [11] Pre-bid project chat: │                                                      │
│   GET /projects/:id/       │                                                      │
│     messages               │                                                      │
│   GET /projects/:id/       │                                                      │
│     messages/unread-count  │                                                      │
│   WebSocket sendMessage    │                                                      │
│     {projectId, content}   │                                                      │
│       └──────────────────> │                                                      │
│                            │ [12] INSERT messages {project_id,sender_id,content}  │
│                            │   Emit to all parties in project room                │
│                            │                                                      │
│ [13] Engagement chat:      │                                                      │
│   GET /engagements/:id/    │                                                      │
│     messages               │                                                      │
│   GET /engagements/:id/    │                                                      │
│     messages/unread-count  │                                                      │
│   WebSocket sendMessage    │                                                      │
│     {engagementId, content}│                                                      │
│       └──────────────────> │                                                      │
│                            │ [14]INSERT messages {engagement_id,sender_id,content}│
│                            │   Emit to all engagement room participants           │
│                            │                                                      │
│ [15] Mark read:            │                                                      │
│   POST /messages/:id/read  │                                                      │
│       └──────────────────> │                                                      │
│                            │ [16] INSERT message_reads {message_id,user_id}       │
│                            │   UNIQUE(message_id,user_id) enforced                │
└────────────────────────────┴──────────────────────────────────────────────────────┘
```

---

# MF-15: Milestone Chat Assistant

## Overview

AI assistant embedded in the project milestone page. CEO or TECH_TEAM chats about milestone structure. Server owns full conversation history — FE only needs to store `chatSessionId`. `suggestedEdit` field triggers one-click apply to milestone.

**Tables touched (2):** `milestone_chat_sessions`, `milestones`

**Endpoints:** `POST /projects/:id/milestone-chat`, `GET /projects/:id/milestone-chat/sessions`, `GET /projects/:id/milestone-chat/sessions/:sessionId`

---

## ASCII Swimlane

```
┌────────────────────────────┬──────────────────────────────────────────────────────┐
│       CLIENT / CEO         │         SYSTEM (NestJS + FastAPI)                    │
├────────────────────────────┼──────────────────────────────────────────────────────┤
│ ══ NEW CONVERSATION ═══════│                                                      │
│ [1] POST /projects/:id/    │                                                      │
│   milestone-chat           │                                                      │
│   {message:"Why 3          │                                                      │
│     milestones? Can we     │                                                      │
│     reduce?"}              │                                                      │
│   ← no chatSessionId       │                                                      │
│       └──────────────────> │                                                      │
│                            │ [2] No chatSessionId → new session:                  │
│                            │   INSERT milestone_chat_sessions {                   │
│                            │     project_id, user_id,                             │
│                            │     title:"Chat · DD/MM/YYYY",                       │
│                            │     messages_json:"[]"                               │
│                            │   }                                                  │
│                            │                                                      │
│                            │ [3] Build system prompt:                             │
│                            │   Fetch from prompt_templates (60s TTL)              │
│                            │   Inject artifact_a_json +                           │
│                            │     milestone_framework_json +                       │
│                            │     budget_context                                   │
│                            │                                                      │
│                            │ [4] [AI] FastAPI milestone_chat:                     │
│                            │   messages=[{role:"user",content:message}]           │
│                            │   Returns {reply:"The 3 milestones map to...",       │
│                            │     suggested_edit:null}                             │
│                            │                                                      │
│                            │ [5] Append to history:                               │
│                            │   UPDATE milestone_chat_sessions SET                 │
│                            │     messages_json = [...prev,                        │
│                            │       {role:"user",content:message},                 │
│                            │       {role:"assistant",content:reply}]              │
│                            │   Return {reply, suggested_edit:null,                │
│                            │     chatSessionId:"uuid",                            │
│                            │     sessionTitle:"Chat · 11/07/2026",                │
│                            │     messageCount:2}                                  │
│ <──────────────────────────┤                                                      │
│ [6] FE stores only         │                                                      │
│   chatSessionId (not reply)│                                                      │
│                            │                                                      │
│ ══ FOLLOW-UP (same session)│                                                      │
│ [7] POST /projects/:id/    │                                                      │
│   milestone-chat           │                                                      │
│   {message:"Can we cut     │                                                      │
│     milestone 2 budget?",  │                                                      │
│    chatSessionId:"uuid"}   │                                                      │
│       └──────────────────> │                                                      │
│                            │ [8] Load history from milestone_chat_sessions        │
│                            │   Append new user message to history                 │
│                            │   [AI] FastAPI: full history + new message           │
│                            │   Returns {reply:"...",                              │
│                            │     suggested_edit:{                                 │
│                            │       milestone_number:2,                            │
│                            │       field:"paymentAmountVnd",                      │
│                            │       suggested_value:30000000,                      │
│                            │       reason:"Lighter scope than estimated"          │
│                            │     }}                                               │
│                            │   UPDATE messages_json with new exchange             │
│ <──────────────────────────┤                                                      │
│ [9] Shows:                 │                                                      │
│   suggested_edit → "Apply" │                                                      │
│   button: PATCH /milestones│                                                      │
│   /:id {paymentAmountVnd:  │                                                      │
│     30000000}              │                                                      │
│                            │                                                      │
│ ══ SESSION MANAGEMENT ═════│                                                      │
│ [10] GET /projects/:id/    │                                                      │
│   milestone-chat/sessions  │                                                      │
│   → sidebar list           │                                                      │
│   [{id,title,messageCount, │                                                      │
│     updatedAt}]            │                                                      │
│                            │                                                      │
│ [11] GET /projects/:id/    │                                                      │
│   milestone-chat/sessions/ │                                                      │
│   :sessionId               │                                                      │
│   → restore thread on      │                                                      │
│     page refresh           │                                                      │
│   {messagesJson:[...]}     │                                                      │
└────────────────────────────┴──────────────────────────────────────────────────────┘
```

---

# MF-16: Password Recovery & Account Security

## Overview

Three-step password recovery for unauthenticated users. Change-password flow for authenticated users. Account deactivation guard.

**Tables touched (1):** `users`

**Endpoints:** `POST /auth/forgot-password`, `GET /auth/verify-reset-token/:token`, `POST /auth/reset-password`, `PUT /auth/me/password`, `DELETE /users/me`

---

## ASCII Swimlane

```
┌─────────────────────────────┬────────────────────────────────────────────────────┐
│   ANY USER (Unauthenticated)│       SYSTEM (NestJS)                              │
├─────────────────────────────┼────────────────────────────────────────────────────┤
│ ══ FORGOT PASSWORD (UNAUTH) ═════════════════════════════════════════════════════│
│ [1] POST /auth/forgot-      │                                                    │
│   password                  │                                                    │
│   {email:"..."}             │                                                    │
│       └───────────────────> │                                                    │
│                             │ [2] SELECT users WHERE email=?                     │
│                             │   IF NOT found → same response (anti-enumeration)  │
│                             │   IF found:                                        │
│                             │     UPDATE users SET                               │
│                             │       password_reset_token = uuid(),               │
│                             │       password_reset_token_expires_at =            │
│                             │         now()+1h                                   │
│                             │     Dispatch email: /reset-password/<token>        │
│                             │   ALWAYS return: {message:"If an account with      │
│                             │     that email exists, a reset link has            │
│                             │     been sent."} [anti-enumeration]                │
│ <───────────────────────────┤                                                    │
│                             │                                                    │
│ [3] Opens email link        │                                                    │
│   /reset-password/<token>   │                                                    │
│   ← MUST call verify on     │                                                    │
│     PAGE MOUNT before       │                                                    │
│     showing form            │                                                    │
│   GET /auth/verify-reset-   │                                                    │
│   token/:token              │                                                    │
│       └───────────────────> │                                                    │
│                             │ [4] SELECT users WHERE                             │
│                             │   password_reset_token=? AND                       │
│                             │   password_reset_token_expires_at > now()          │
│                             │   IF valid → 200 {valid:true}                      │
│                             │   IF invalid/expired → 400                         │
│                             │     "This password reset link is invalid           │
│                             │      or has expired."                              │
│ <───────────────────────────┤                                                    │
│                             │                                                    │
│ [5] IF 200: shows form      │                                                    │
│   IF 400: shows error +     │                                                    │
│     "Request new link" CTA  │                                                    │
│   Fills new password        │                                                    │
│   POST /auth/reset-password │                                                    │
│   {token:"...",             │                                                    │
│    newPassword:"NewPass1!"} │                                                    │
│       └───────────────────> │                                                    │
│                             │ [6] Validate token again (double check)            │
│                             │   Validate newPassword (5 rules simultaneously)    │
│                             │   DB TX:                                           │
│                             │     UPDATE users SET                               │
│                             │       password_hash = bcrypt(newPassword),         │
│                             │       refresh_token_hash = NULL                    │
│                             │         (all sessions invalidated),                │
│                             │       password_reset_token = NULL,                 │
│                             │       password_reset_token_expires_at = NULL       │
│                             │   COMMIT                                           │
│                             │   Return {message:"Password reset.                 │
│                             │     You can now log in."}                          │
│ <───────────────────────────┤                                                    │
│ [7] Redirect to /login      │                                                    │
│   Success toast             │                                                    │
│                             │                                                    │
├─────────────────────────────┼────────────────────────────────────────────────────┤
│ ══ CHANGE PASSWORD (AUTHENTICATED) ══════════════════════════════════════════════│
│ [8] PUT /auth/me/password   │                                                    │
│   {currentPassword:"...",   │                                                    │
│    newPassword:"..."}       │                                                    │
│       └───────────────────> │                                                    │
│                             │ [9] bcrypt.compare(current, stored_hash)           │
│                             │   IF false → 401 "Current password is incorrect"   │
│                             │   Validate newPassword (5 rules)                   │
│                             │   UPDATE users SET                                 │
│                             │     password_hash = bcrypt(newPassword),           │
│                             │     refresh_token_hash = NULL                      │
│                             │   Return {message:"Password changed...             │
│                             │     Please log in again."}                         │
│ <───────────────────────────┤                                                    │
│ [10] Auto-redirect to /login│                                                    │
│   (all sessions invalidated)│                                                    │
└─────────────────────────────┴────────────────────────────────────────────────────┘
```

---

