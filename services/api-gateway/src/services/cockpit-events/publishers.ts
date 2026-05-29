/**
 * Cockpit-event publishers — domain-specific emit helpers.
 *
 * Each helper validates its inputs and publishes the matching event
 * via `publishCockpitEvent`. Centralising the publish call here means
 * the 6 mutation paths called out by the spec (decision-recorder,
 * reminders-dispatch, opportunity-scanner, risk-scanner, tenant-move,
 * compliance-deadline cron) each have a one-liner to keep their
 * cockpit pulse wired correctly.
 *
 * All emit functions are fire-and-forget — bus errors are swallowed
 * so a downstream problem can never break the mutation.
 */

import { publishCockpitEvent } from './bus.js';
import type {
  ApplicationApprovedEvent,
  ComplianceDeadlineApproachingEvent,
  DecisionRecordedEvent,
  InspectionCompletedEvent,
  LicenceRenewedEvent,
  MaintenanceCompletedEvent,
  RentCollectedEvent,
  RentPayoutInitiatedEvent,
  ReminderFiredEvent,
  SafetyIncidentEvent,
  StaffShiftEvent,
} from './types.js';

interface CommonInputs {
  readonly tenantId: string;
}

export interface PublishDecisionRecordedInput extends CommonInputs {
  readonly decisionId: string;
  readonly subject: string;
  readonly severity: DecisionRecordedEvent['severity'];
}

export function publishDecisionRecorded(
  input: PublishDecisionRecordedInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'decision.recorded',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      decisionId: input.decisionId,
      subject: input.subject,
      severity: input.severity,
    });
  } catch {
    // Best-effort.
  }
}

export interface PublishReminderFiredInput extends CommonInputs {
  readonly reminderId: string;
  readonly title: string;
  readonly channel: ReminderFiredEvent['channel'];
}

export function publishReminderFired(input: PublishReminderFiredInput): void {
  try {
    publishCockpitEvent({
      kind: 'reminder.fired',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      reminderId: input.reminderId,
      title: input.title,
      channel: input.channel,
    });
  } catch {
    // Best-effort.
  }
}

export interface PublishComplianceDeadlineInput extends CommonInputs {
  readonly filingId: string;
  readonly filingKind: string;
  readonly dueAt: string;
  readonly daysRemaining: number;
}

export function publishComplianceDeadlineApproaching(
  input: PublishComplianceDeadlineInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'compliance.deadline_approaching',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      filingId: input.filingId,
      filingKind: input.filingKind,
      dueAt: input.dueAt,
      daysRemaining: input.daysRemaining,
    } satisfies ComplianceDeadlineApproachingEvent);
  } catch {
    // Best-effort.
  }
}

export interface PublishStaffShiftInput extends CommonInputs {
  readonly staffId: string;
  readonly transition: StaffShiftEvent['transition'];
}

export function publishStaffShiftEvent(input: PublishStaffShiftInput): void {
  try {
    publishCockpitEvent({
      kind: 'staff.shift_event',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      staffId: input.staffId,
      transition: input.transition,
    });
  } catch {
    // Best-effort.
  }
}

export interface PublishLeaseSignedInput extends CommonInputs {
  readonly leaseId: string;
  readonly unitId: string;
  readonly tenantUserId: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly rentAmount: number;
  readonly currencyCode: string;
}

export function publishLeaseSigned(input: PublishLeaseSignedInput): void {
  try {
    publishCockpitEvent({
      kind: 'lease.signed',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      leaseId: input.leaseId,
      unitId: input.unitId,
      tenantUserId: input.tenantUserId,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      rentAmount: input.rentAmount,
      currencyCode: input.currencyCode,
    });
  } catch {
    // Best-effort.
  }
}

export interface PublishLeaseTerminatedInput extends CommonInputs {
  readonly leaseId: string;
  readonly unitId: string;
  readonly terminatedOn: string;
  readonly reason: 'expiry' | 'notice' | 'eviction' | 'mutual_consent';
}

export function publishLeaseTerminated(
  input: PublishLeaseTerminatedInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'lease.terminated',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      leaseId: input.leaseId,
      unitId: input.unitId,
      terminatedOn: input.terminatedOn,
      reason: input.reason,
    });
  } catch {
    // Best-effort.
  }
}

// ─── DIM-B port — 6 lifecycle publishers ────────────────────────────
// Rent collected (M-Pesa / bank / cash) — owner + tenant pulse.
export interface PublishRentCollectedInput extends CommonInputs {
  readonly invoiceId: string;
  readonly leaseId: string;
  readonly unitId: string;
  readonly amount: number;
  readonly currencyCode: string;
  readonly method: RentCollectedEvent['method'];
}

export function publishRentCollected(input: PublishRentCollectedInput): void {
  try {
    publishCockpitEvent({
      kind: 'rent.collected',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      invoiceId: input.invoiceId,
      leaseId: input.leaseId,
      unitId: input.unitId,
      amount: input.amount,
      currencyCode: input.currencyCode,
      method: input.method,
    } satisfies RentCollectedEvent);
  } catch {
    // Best-effort.
  }
}

// Maintenance work order completed.
export interface PublishMaintenanceCompletedInput extends CommonInputs {
  readonly workOrderId: string;
  readonly unitId: string | null;
  readonly category: string;
  readonly costAmount: number | null;
  readonly currencyCode: string | null;
  readonly completedBy: string;
}

export function publishMaintenanceCompleted(
  input: PublishMaintenanceCompletedInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'maintenance.completed',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      workOrderId: input.workOrderId,
      unitId: input.unitId,
      category: input.category,
      costAmount: input.costAmount,
      currencyCode: input.currencyCode,
      completedBy: input.completedBy,
    } satisfies MaintenanceCompletedEvent);
  } catch {
    // Best-effort.
  }
}

// Inspection completed (move_in | mid_tenancy | exit | compliance).
export interface PublishInspectionCompletedInput extends CommonInputs {
  readonly inspectionId: string;
  readonly unitId: string | null;
  readonly inspectionKind: InspectionCompletedEvent['inspectionKind'];
  readonly inspectorId: string;
  readonly outcome: InspectionCompletedEvent['outcome'];
}

export function publishInspectionCompleted(
  input: PublishInspectionCompletedInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'inspection.completed',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      inspectionId: input.inspectionId,
      unitId: input.unitId,
      inspectionKind: input.inspectionKind,
      inspectorId: input.inspectorId,
      outcome: input.outcome,
    } satisfies InspectionCompletedEvent);
  } catch {
    // Best-effort.
  }
}

// Tenant application approved.
export interface PublishApplicationApprovedInput extends CommonInputs {
  readonly applicationId: string;
  readonly listingId: string;
  readonly applicantUserId: string;
  readonly approvedBy: string;
}

export function publishApplicationApproved(
  input: PublishApplicationApprovedInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'application.approved',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      applicationId: input.applicationId,
      listingId: input.listingId,
      applicantUserId: input.applicantUserId,
      approvedBy: input.approvedBy,
    } satisfies ApplicationApprovedEvent);
  } catch {
    // Best-effort.
  }
}

// Rent payout initiated to landlord — mobile pulse.
export interface PublishRentPayoutInitiatedInput extends CommonInputs {
  readonly payoutId: string;
  readonly ownerId: string;
  readonly amount: number;
  readonly currencyCode: string;
  readonly initiatedBy: string;
}

export function publishRentPayoutInitiated(
  input: PublishRentPayoutInitiatedInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'rent_payout.initiated',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      payoutId: input.payoutId,
      ownerId: input.ownerId,
      amount: input.amount,
      currencyCode: input.currencyCode,
      initiatedBy: input.initiatedBy,
    } satisfies RentPayoutInitiatedEvent);
  } catch {
    // Best-effort.
  }
}

// Safety incident reported (manager + owner pulse).
export interface PublishSafetyIncidentInput extends CommonInputs {
  readonly incidentId: string;
  readonly unitId: string | null;
  readonly severity: SafetyIncidentEvent['severity'];
  readonly reportedBy: string;
  readonly summary: string;
}

export function publishSafetyIncidentReported(
  input: PublishSafetyIncidentInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'safety.incident_reported',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      incidentId: input.incidentId,
      unitId: input.unitId,
      severity: input.severity,
      reportedBy: input.reportedBy,
      summary: input.summary,
    } satisfies SafetyIncidentEvent);
  } catch {
    // Best-effort.
  }
}

// Operating licence renewed (terminal state).
export interface PublishLicenceRenewedInput extends CommonInputs {
  readonly licenceId: string;
  readonly licenceKind: string;
  readonly renewedThrough: string;
  readonly renewedBy: string;
}

export function publishLicenceRenewed(
  input: PublishLicenceRenewedInput,
): void {
  try {
    publishCockpitEvent({
      kind: 'licence.renewed',
      tenantId: input.tenantId,
      emittedAt: new Date().toISOString(),
      licenceId: input.licenceId,
      licenceKind: input.licenceKind,
      renewedThrough: input.renewedThrough,
      renewedBy: input.renewedBy,
    } satisfies LicenceRenewedEvent);
  } catch {
    // Best-effort.
  }
}
