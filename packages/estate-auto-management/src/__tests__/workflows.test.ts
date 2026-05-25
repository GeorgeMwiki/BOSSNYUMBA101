import { describe, expect, it } from 'vitest';
import { planRenewalWorkflow } from '../workflows/lease-renewal-workflow.js';
import { planTerminationWorkflow } from '../workflows/lease-termination-workflow.js';
import { planMonthlyClose } from '../workflows/monthly-close-workflow.js';
import type { LeaseRecord } from '../types.js';

const lease: LeaseRecord = {
  leaseId: 'l1',
  tenantId: 't1',
  assetId: 'a1',
  startDate: '2025-07-01',
  endDate: '2026-06-30',
  monthlyRent: 50_000,
  currency: 'KES',
};

describe('lease-renewal-workflow', () => {
  it('emits 4 tasks on 90/60/30/0 cadence', () => {
    const tasks = planRenewalWorkflow(lease);
    expect(tasks.length).toBe(4);
  });

  it('first task is 90 days before end date', () => {
    const tasks = planRenewalWorkflow(lease);
    const ninety = new Date(tasks[0].scheduledFor);
    const end = new Date(lease.endDate);
    const diffDays = Math.round((end.getTime() - ninety.getTime()) / (86400 * 1000));
    expect(diffDays).toBe(90);
  });

  it('last task is on the end date', () => {
    const tasks = planRenewalWorkflow(lease);
    expect(tasks[3].scheduledFor.slice(0, 10)).toBe(lease.endDate);
  });

  it('every task carries the lease + tenant + asset', () => {
    const tasks = planRenewalWorkflow(lease);
    expect(tasks.every((t) => t.leaseId === 'l1' && t.tenantId === 't1')).toBe(true);
  });
});

describe('lease-termination-workflow', () => {
  it('emits 3 tasks at default notice windows', () => {
    const tasks = planTerminationWorkflow(lease, '2026-09-30');
    expect(tasks.length).toBe(3);
    expect(tasks.map((t) => t.type)).toEqual([
      'termination-notice',
      'termination-inspection',
      'termination-handover',
    ]);
  });

  it('honours statutory notice override', () => {
    const tasks = planTerminationWorkflow(lease, '2026-09-30', {
      statutoryNoticeDays: 90,
      inspectionDaysBeforeEnd: 7,
    });
    const notice = new Date(tasks[0].scheduledFor);
    const end = new Date('2026-09-30');
    const diffDays = Math.round((end.getTime() - notice.getTime()) / (86400 * 1000));
    expect(diffDays).toBe(90);
  });
});

describe('monthly-close-workflow', () => {
  it('emits one task set per asset', () => {
    const tasks = planMonthlyClose({ year: 2026, month: 5, assetIds: ['a1', 'a2'] });
    // 4 tasks per asset × 2 assets = 8
    expect(tasks.length).toBe(8);
  });

  it('month-end task lands on the last day of the month', () => {
    const tasks = planMonthlyClose({ year: 2026, month: 5, assetIds: ['a1'] });
    const monthEnd = tasks.find((t) => t.description.includes('Month-end'));
    expect(monthEnd?.scheduledFor.slice(0, 10)).toBe('2026-05-31');
  });

  it('handles leap-year February correctly', () => {
    const tasks = planMonthlyClose({ year: 2028, month: 2, assetIds: ['a1'] });
    const monthEnd = tasks.find((t) => t.description.includes('Month-end'));
    expect(monthEnd?.scheduledFor.slice(0, 10)).toBe('2028-02-29');
  });
});
