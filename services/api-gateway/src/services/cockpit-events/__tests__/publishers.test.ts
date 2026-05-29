/**
 * cockpit-events publishers — round-trip via the in-process bus.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  publishApplicationApproved,
  publishComplianceDeadlineApproaching,
  publishDecisionRecorded,
  publishInspectionCompleted,
  publishLeaseSigned,
  publishLeaseTerminated,
  publishLicenceRenewed,
  publishMaintenanceCompleted,
  publishReminderFired,
  publishRentCollected,
  publishRentPayoutInitiated,
  publishSafetyIncidentReported,
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

  // ─── DIM-B port — 7 new lifecycle publishers ──────────────────────
  it('publishRentCollected emits rent.collected', () => {
    publishRentCollected({
      tenantId: TENANT_ID,
      invoiceId: 'inv-1',
      leaseId: 'l-1',
      unitId: 'u-1',
      amount: 250000,
      currencyCode: 'TZS',
      method: 'mpesa',
    });
    expect(received[0]?.kind).toBe('rent.collected');
  });

  it('publishMaintenanceCompleted emits maintenance.completed', () => {
    publishMaintenanceCompleted({
      tenantId: TENANT_ID,
      workOrderId: 'wo-1',
      unitId: 'u-1',
      category: 'plumbing',
      costAmount: 80000,
      currencyCode: 'TZS',
      completedBy: 'tech-1',
    });
    expect(received[0]?.kind).toBe('maintenance.completed');
  });

  it('publishInspectionCompleted emits inspection.completed', () => {
    publishInspectionCompleted({
      tenantId: TENANT_ID,
      inspectionId: 'ins-1',
      unitId: 'u-1',
      inspectionKind: 'move_in',
      inspectorId: 'mgr-1',
      outcome: 'pass',
    });
    expect(received[0]?.kind).toBe('inspection.completed');
  });

  it('publishApplicationApproved emits application.approved', () => {
    publishApplicationApproved({
      tenantId: TENANT_ID,
      applicationId: 'app-1',
      listingId: 'lst-1',
      applicantUserId: 'usr-1',
      approvedBy: 'owner-1',
    });
    expect(received[0]?.kind).toBe('application.approved');
  });

  it('publishRentPayoutInitiated emits rent_payout.initiated', () => {
    publishRentPayoutInitiated({
      tenantId: TENANT_ID,
      payoutId: 'po-1',
      ownerId: 'owner-1',
      amount: 1000000,
      currencyCode: 'TZS',
      initiatedBy: 'system',
    });
    expect(received[0]?.kind).toBe('rent_payout.initiated');
  });

  it('publishSafetyIncidentReported emits safety.incident_reported', () => {
    publishSafetyIncidentReported({
      tenantId: TENANT_ID,
      incidentId: 'inc-1',
      unitId: 'u-1',
      severity: 'high',
      reportedBy: 'staff-1',
      summary: 'water leak in basement',
    });
    expect(received[0]?.kind).toBe('safety.incident_reported');
  });

  it('publishLicenceRenewed emits licence.renewed', () => {
    publishLicenceRenewed({
      tenantId: TENANT_ID,
      licenceId: 'lic-1',
      licenceKind: 'NCA_property_management',
      renewedThrough: '2027-05-31',
      renewedBy: 'compliance-officer-1',
    });
    expect(received[0]?.kind).toBe('licence.renewed');
  });
});
