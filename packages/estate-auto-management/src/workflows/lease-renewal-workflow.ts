/**
 * 90 / 60 / 30 / 0-day lease renewal cadence.
 *
 * Pure schedule generator. The orchestrator handles actual
 * notification + offer creation via injected ports.
 */

import type { LeaseRecord, WorkflowTask } from '../types.js';

const CADENCE_DAYS: ReadonlyArray<{ readonly days: number; readonly label: string }> = [
  { days: 90, label: 'Initial renewal offer' },
  { days: 60, label: '60-day renewal reminder' },
  { days: 30, label: '30-day final-call follow-up' },
  { days: 0, label: 'Renewal due today' },
];

export function planRenewalWorkflow(lease: LeaseRecord): WorkflowTask[] {
  const end = new Date(lease.endDate);
  return CADENCE_DAYS.map((c) => {
    const when = new Date(end);
    when.setUTCDate(when.getUTCDate() - c.days);
    const type =
      c.days === 90
        ? 'renewal-offer'
        : c.days === 0
          ? 'renewal-final-call'
          : 'renewal-followup';
    return {
      leaseId: lease.leaseId,
      tenantId: lease.tenantId,
      assetId: lease.assetId,
      type,
      scheduledFor: when.toISOString(),
      description: c.label,
    } as WorkflowTask;
  });
}
