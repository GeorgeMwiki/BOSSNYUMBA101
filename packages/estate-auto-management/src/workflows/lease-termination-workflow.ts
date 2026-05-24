/**
 * Lease termination workflow with statutory notice windows.
 *
 * Default 60-day notice + 14-day inspection + handover task on
 * termination date. Per-jurisdiction overrides allowed.
 */

import type { LeaseRecord, WorkflowTask } from '../types.js';

export interface TerminationOptions {
  readonly statutoryNoticeDays?: number;
  readonly inspectionDaysBeforeEnd?: number;
}

export function planTerminationWorkflow(
  lease: LeaseRecord,
  effectiveTerminationDate: string,
  options: TerminationOptions = {},
): WorkflowTask[] {
  const notice = options.statutoryNoticeDays ?? 60;
  const inspect = options.inspectionDaysBeforeEnd ?? 14;
  const end = new Date(effectiveTerminationDate);

  const noticeDate = new Date(end);
  noticeDate.setUTCDate(noticeDate.getUTCDate() - notice);
  const inspectDate = new Date(end);
  inspectDate.setUTCDate(inspectDate.getUTCDate() - inspect);

  return [
    {
      leaseId: lease.leaseId,
      tenantId: lease.tenantId,
      assetId: lease.assetId,
      type: 'termination-notice',
      scheduledFor: noticeDate.toISOString(),
      description: `Issue ${notice}-day termination notice`,
    },
    {
      leaseId: lease.leaseId,
      tenantId: lease.tenantId,
      assetId: lease.assetId,
      type: 'termination-inspection',
      scheduledFor: inspectDate.toISOString(),
      description: `Pre-termination inspection (${inspect} days before end)`,
    },
    {
      leaseId: lease.leaseId,
      tenantId: lease.tenantId,
      assetId: lease.assetId,
      type: 'termination-handover',
      scheduledFor: end.toISOString(),
      description: 'Final handover + deposit reconciliation',
    },
  ];
}
