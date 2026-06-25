export enum DisputeState {
  PENDING        = 'PENDING',         // filed, AI evaluation in flight
  AI_RESOLVED    = 'AI_RESOLVED',     // AI confidence >= 0.80, auto-resolved
  ESCALATED      = 'ESCALATED',       // AI confidence < 0.80, awaiting Admin
  ADMIN_RESOLVED = 'ADMIN_RESOLVED',  // Admin made the final call
  WITHDRAWN      = 'WITHDRAWN',       // filer withdrew before resolution (§6.4)
}