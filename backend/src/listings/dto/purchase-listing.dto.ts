// POST /services/:id/purchase body — currently no fields required.
// The service ID comes from the URL. This class exists for documentation
// and to leave room for future fields (e.g., promo_code).
//
// Per docs/04 §0.11 K row 137:
//   - Actor: CEO (CLIENT with client_subtype=CEO).
//   - Guard: active_role/CEO → 403 · !PUBLISHED → 422 · insufficient balance → 422.
//   - Creates engagement + per-order VA. Returns VietQR.
export class PurchaseListingDto {}
