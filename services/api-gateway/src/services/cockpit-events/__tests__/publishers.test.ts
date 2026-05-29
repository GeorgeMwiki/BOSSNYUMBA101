/**
 * cockpit-events publishers — round-trip via the in-process bus.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  publishComplianceDeadlineApproaching,
  publishDecisionRecorded,
  publishLeaseSigned,
  publishLeaseTerminated,
  publishReminderFired,
  publishStaffShiftEvent,
  subscribeCockpitEvents,
  __resetCockpitBusForTests,
} from '../index.js';
import type { CockpitEvent } from '../types.js';

const TENANT_ID = 'tenant-pub';

describe('cockpit-events publishers', () => {
  let received: CockpitEvent[];
  let unsubscribe: () => void;

  beforeEach(() => {
    __resetCockpitBusForTests();
    received = [];
    unsubscribe = subscribeCockpitEvents(TENANT_ID, (e) => received.push(e));
  });
  afterEach(() => {
    unsubscribe();
    __resetCockpitBusForTests();
  });

  it('publishDecisionRecorded emits a decision.recorded event', () => {
    publishDecisionRecorded({
      tenantId: TENANT_ID,
      decisionId: 'd-1',
      subject: 'Approve renovation budget',
      severity: 'high',
    });
    expect(received).toHaveLength(1);
    expect(received[0]?.kind).toBe('decision.recorded');
  });

  it('publishReminderFired emits a reminder.fired event', () => {
    publishReminderFired({
      tenantId: TENANT_ID,
      reminderId: 'r-1',
      title: 'Rent due tomorrow',
      channel: 'sms',
    });
    expect(received).toHaveLength(1);
    expect(received[0]?.kind).toBe('reminder.fired');
  });

  it('publishComplianceDeadlineApproaching emits compliance.deadline_approaching', () => {
    publishComplianceDeadlineApproaching({
      tenantId: TENANT_ID,
      filingId: 'f-1',
      filingKind: 'kra_mri',
      dueAt: '2026-06-30T00:00:00.000Z',
      daysRemaining: 14,
    });
    expect(received[0]?.kind).toBe('compliance.deadline_approaching');
  });

  it('publishStaffShiftEvent emits staff.shift_event', () => {
    publishStaffShiftEvent({
      tenantId: TENANT_ID,
      staffId: 's-1',
      transition: 'shift_start',
    });
    expect(received[0]?.kind).toBe('staff.shift_event');
  });

  it('publishLeaseSigned emits lease.signed', () => {
    publishLeaseSigned({
      tenantId: TENANT_ID,
      leaseId: 'l-1',
      unitId: 'u-1',
      tenantUserId: 't-1',
      startsOn: '2026-06-01',
      endsOn: '2027-05-31',
      rentAmount: 500000,
      currencyCode: 'TZS',
    });
    expect(received[0]?.kind).toBe('lease.signed');
  });

  it('publishLeaseTerminated emits lease.terminated', () => {
    publishLeaseTerminated({
      tenantId: TENANT_ID,
      leaseId: 'l-1',
      unitId: 'u-1',
      terminatedOn: '2026-06-30',
      reason: 'notice',
    });
    expect(received[0]?.kind).toBe('lease.terminated');
  });
});
