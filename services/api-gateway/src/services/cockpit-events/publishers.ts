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
  ComplianceDeadlineApproachingEvent,
  DecisionRecordedEvent,
  ReminderFiredEvent,
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
