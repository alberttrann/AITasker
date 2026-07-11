// email requirement DROPPED entirely.
// "CEO can invite multiple TECH_TEAM members if the first doesn't
// register; only the first to consume the link creates the account."
// The link authorizes "register as TECH_TEAM linked to project X" —
// it does not pre-bind a specific email. Whoever completes registration
// via the link first supplies their own email at that point.
//
// This DTO is now empty (no body needed) but kept as a class for route
// consistency / future extension (e.g. an optional display name hint).
export class InviteTechTeamDto {}
