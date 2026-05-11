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
 * Required gateway routes (already implemented):
 *   GET  /api/v1/owner/damage-deductions?status=pending_owner
 *   POST /api/v1/owner/damage-deductions/:id/approve
 *   POST /api/v1/owner/damage-deductions/:id/reject
 */
export function DamageDeductionsPage() {
  return <DamageDeductionApproval />;
}

export default DamageDeductionsPage;
