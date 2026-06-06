import React from 'react';
import { DamageDeductionApproval } from '../features/damage-deductions/DamageDeductionApproval';

/**
 * DamageDeductionsPage — owner-portal route wrapper that mounts the
 * DamageDeductionApproval feature component at `/damage-deductions`.
 *
 * Auth and chrome (sidebar, header, locale switcher) are provided by
 * the top-level `PrivateRoute > Layout` wrapper in `App.tsx`, so this
 * page stays a thin mount.
 *
 * Gateway routes consumed (mounted at `/damage-deductions`, NOT under
 * `/owner` — the previous `/owner/damage-deductions*` paths 404'd):
 *   GET  /api/v1/damage-deductions/open        — live open claims
 *   POST /api/v1/damage-deductions/:id/settle  — owner approve (settle at
 *        claimed/proposed) or reject (settle at 0)
 *
 * Note: the damage-deduction service is tenant-scoped (not property-scoped
 * to the owner) and exposes settlement only — there is no dedicated
 * approve/reject endpoint, so approval maps onto `settle`.
 */
export function DamageDeductionsPage() {
  return <DamageDeductionApproval />;
}

export default DamageDeductionsPage;
