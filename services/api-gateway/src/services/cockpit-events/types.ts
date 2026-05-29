/**
 * Cockpit Events — wire types (BossNyumba real-estate domain).
 *
 * The cockpit SSE stream multiplexes multiple event kinds onto a single
 * per-tenant channel. Each event is JSON-encoded as the SSE `data`
 * field and named via the SSE `event` field; the wire envelope is
 * stable so older owner-web clients keep working when we add fields.
 *
 * NEVER mutate an event after publishing — the bus may broadcast to
 * multiple subscribers and the toast renderer freezes the payload.
 *
 * Domain mapping from Borjie -> BossNyumba: the mining-specific events
 * (production.posted, licence.renewed, etc.) are remapped to property-
 * management equivalents (rent.collected, lease.signed,
 * maintenance.completed, etc.). Generic event kinds (decision.recorded,
 * reminder.fired) are preserved.
 */

export const COCKPIT_EVENT_KINDS = [
  'decision.recorded',
  'reminder.fired',
  'opportunity.scan_completed',
  'risk.changed',
  'staff.shift_event',
  'compliance.deadline_approaching',
  'persona.acted',
  'persona.proposes',
  // Property-management primary events
  'rent.collected',
  'lease.signed',
  'lease.renewed',
  'lease.terminated',
  'maintenance.completed',
  'maintenance.requested',
  'inspection.completed',
  'inspection.scheduled',
  'application.submitted',
  'application.approved',
  'application.rejected',
  'viewing.scheduled',
  'viewing.completed',
  'regulator.request_received',
  'regulator.request_status_changed',
  // Cross-actor real-time visibility
  'rfa.dispatched',
  'task.assigned',
  'safety.incident_reported',
  'rent_payout.initiated',
  'payroll.committed',
  'licence.renewed',
  'chat.handoff',
  'manager.approved',
  'bid.placed',
  'incident.escalated',
  // Chat-driven dynamic tab CRUD
  'cockpit.tab.spawned',
  'cockpit.tab.updated',
  'cockpit.tab.removed',
  'cockpit.tab.proposed',
  // Day-1 super-powered demo
  'property.celebrate',
] as const;

export type CockpitEventKind = (typeof COCKPIT_EVENT_KINDS)[number];

/** Discriminated-union payload for the cockpit SSE stream. */
export type CockpitEvent =
  | DecisionRecordedEvent
  | ReminderFiredEvent
  | OpportunityScanCompletedEvent
  | RiskChangedEvent
  | StaffShiftEvent
  | ComplianceDeadlineApproachingEvent
  | PersonaActedEvent
  | PersonaProposesEvent
  | RentCollectedEvent
  | LeaseSignedEvent
  | LeaseRenewedEvent
  | LeaseTerminatedEvent
  | MaintenanceCompletedEvent
  | MaintenanceRequestedEvent
  | InspectionCompletedEvent
  | InspectionScheduledEvent
  | ApplicationSubmittedEvent
  | ApplicationApprovedEvent
  | ApplicationRejectedEvent
  | ViewingScheduledEvent
  | ViewingCompletedEvent
  | RegulatorRequestReceivedEvent
  | RegulatorRequestStatusChangedEvent
  | RfaDispatchedEvent
  | TaskAssignedEvent
  | SafetyIncidentEvent
  | RentPayoutInitiatedEvent
  | PayrollCommittedEvent
  | LicenceRenewedEvent
  | ChatHandoffEvent
  | ManagerApprovedEvent
  | BidPlacedEvent
  | IncidentEscalatedEvent
  | CockpitTabSpawnedEvent
  | CockpitTabUpdatedEvent
  | CockpitTabRemovedEvent
  | CockpitTabProposedEvent
  | PropertyCelebrateEvent;

interface BaseEvent {
  readonly tenantId: string;
  readonly emittedAt: string;
}

export interface DecisionRecordedEvent extends BaseEvent {
  readonly kind: 'decision.recorded';
  readonly decisionId: string;
  readonly subject: string;
  readonly severity: 'low' | 'medium' | 'high' | 'sovereign';
}

export interface ReminderFiredEvent extends BaseEvent {
  readonly kind: 'reminder.fired';
  readonly reminderId: string;
  readonly title: string;
  readonly channel: 'email' | 'sms' | 'slack';
}

export interface OpportunityScanCompletedEvent extends BaseEvent {
  readonly kind: 'opportunity.scan_completed';
  readonly opportunityCount: number;
  /** Top expected-value across all opportunities (in primary currency). */
  readonly topExpectedValue: number;
  readonly currencyCode: string;
}

export interface RiskChangedEvent extends BaseEvent {
  readonly kind: 'risk.changed';
  readonly riskId: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly previousSeverity: 'low' | 'medium' | 'high' | 'critical' | null;
}

export interface StaffShiftEvent extends BaseEvent {
  readonly kind: 'staff.shift_event';
  readonly staffId: string;
  readonly transition: 'shift_start' | 'shift_end';
}

export interface ComplianceDeadlineApproachingEvent extends BaseEvent {
  readonly kind: 'compliance.deadline_approaching';
  readonly filingId: string;
  readonly filingKind: string;
  readonly dueAt: string;
  readonly daysRemaining: number;
}

/**
 * The platform persona acted on the owner's behalf — T2 or T3 execution.
 */
export interface PersonaActedEvent extends BaseEvent {
  readonly kind: 'persona.acted';
  readonly actionId: string;
  readonly actionKind: string;
  readonly category: string;
  readonly delegationTier: 'T0' | 'T1' | 'T2' | 'T3';
  readonly summary: string;
}

/**
 * The platform persona drafted a proposal awaiting owner approval.
 */
export interface PersonaProposesEvent extends BaseEvent {
  readonly kind: 'persona.proposes';
  readonly actionId: string;
  readonly actionKind: string;
  readonly category: string;
  readonly delegationTier: 'T0' | 'T1' | 'T2' | 'T3';
  readonly summary: string;
}

/** Rent has just been collected for a tenancy. */
export interface RentCollectedEvent extends BaseEvent {
  readonly kind: 'rent.collected';
  readonly invoiceId: string;
  readonly leaseId: string;
  readonly unitId: string;
  readonly amount: number;
  readonly currencyCode: string;
  readonly method: 'mpesa' | 'bank_transfer' | 'cash' | 'card' | 'standing_order';
}

/** A new lease was just signed and activated. */
export interface LeaseSignedEvent extends BaseEvent {
  readonly kind: 'lease.signed';
  readonly leaseId: string;
  readonly unitId: string;
  readonly tenantUserId: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly rentAmount: number;
  readonly currencyCode: string;
}

/** A lease was renewed (extended) — fires post-counterparty signature. */
export interface LeaseRenewedEvent extends BaseEvent {
  readonly kind: 'lease.renewed';
  readonly leaseId: string;
  readonly unitId: string;
  readonly renewedThrough: string;
  readonly rentAmount: number;
  readonly currencyCode: string;
}

/** A lease has terminated (notice complete OR vacated). */
export interface LeaseTerminatedEvent extends BaseEvent {
  readonly kind: 'lease.terminated';
  readonly leaseId: string;
  readonly unitId: string;
  readonly terminatedOn: string;
  readonly reason: 'expiry' | 'notice' | 'eviction' | 'mutual_consent';
}

/** Maintenance work order was completed. */
export interface MaintenanceCompletedEvent extends BaseEvent {
  readonly kind: 'maintenance.completed';
  readonly workOrderId: string;
  readonly unitId: string | null;
  readonly category: string;
  readonly costAmount: number | null;
  readonly currencyCode: string | null;
  readonly completedBy: string;
}

/** Tenant or landlord requested maintenance. */
export interface MaintenanceRequestedEvent extends BaseEvent {
  readonly kind: 'maintenance.requested';
  readonly workOrderId: string;
  readonly unitId: string | null;
  readonly category: string;
  readonly severity: 'low' | 'medium' | 'high' | 'urgent';
  readonly requestedBy: string;
}

/** Property inspection completed (move-in, mid-tenancy, exit). */
export interface InspectionCompletedEvent extends BaseEvent {
  readonly kind: 'inspection.completed';
  readonly inspectionId: string;
  readonly unitId: string | null;
  readonly inspectionKind: 'move_in' | 'mid_tenancy' | 'exit' | 'compliance';
  readonly inspectorId: string;
  readonly outcome: 'pass' | 'pass_with_notes' | 'fail';
}

/** Property inspection scheduled. */
export interface InspectionScheduledEvent extends BaseEvent {
  readonly kind: 'inspection.scheduled';
  readonly inspectionId: string;
  readonly unitId: string | null;
  readonly inspectionKind: 'move_in' | 'mid_tenancy' | 'exit' | 'compliance';
  readonly scheduledFor: string;
  readonly inspectorId: string | null;
}

/** A prospective tenant submitted a rental application. */
export interface ApplicationSubmittedEvent extends BaseEvent {
  readonly kind: 'application.submitted';
  readonly applicationId: string;
  readonly listingId: string;
  readonly applicantUserId: string;
}

/** A rental application was approved. */
export interface ApplicationApprovedEvent extends BaseEvent {
  readonly kind: 'application.approved';
  readonly applicationId: string;
  readonly listingId: string;
  readonly applicantUserId: string;
  readonly approvedBy: string;
}

/** A rental application was rejected. */
export interface ApplicationRejectedEvent extends BaseEvent {
  readonly kind: 'application.rejected';
  readonly applicationId: string;
  readonly listingId: string;
  readonly applicantUserId: string;
  readonly rejectedBy: string;
  readonly reason: string | null;
}

/** Property viewing scheduled. */
export interface ViewingScheduledEvent extends BaseEvent {
  readonly kind: 'viewing.scheduled';
  readonly viewingId: string;
  readonly listingId: string;
  readonly prospectUserId: string;
  readonly scheduledFor: string;
}

/** Property viewing completed. */
export interface ViewingCompletedEvent extends BaseEvent {
  readonly kind: 'viewing.completed';
  readonly viewingId: string;
  readonly listingId: string;
  readonly prospectUserId: string;
  readonly outcome: 'interested' | 'not_interested' | 'no_show';
}

/**
 * Housing authority / regulator inbox received a new request. Drives
 * the owner cockpit's "Regulator inbox" pulse tile.
 */
export interface RegulatorRequestReceivedEvent extends BaseEvent {
  readonly kind: 'regulator.request_received';
  readonly requestId: string;
  readonly regulator: string;
  readonly subjectKind: string;
  readonly dueAt: string;
  readonly summaryEn: string;
  readonly summarySw: string;
}

/** Regulator request state-machine transition. */
export interface RegulatorRequestStatusChangedEvent extends BaseEvent {
  readonly kind: 'regulator.request_status_changed';
  readonly requestId: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly actorId: string;
}

// ───────────────────────────────────────────────────────────────────
// Cross-actor real-time events
// ───────────────────────────────────────────────────────────────────

/**
 * RFA (Request-For-Application) dispatched to a manager or staff
 * member for fulfilment. Property-management analogue of mining RFB.
 */
export interface RfaDispatchedEvent extends BaseEvent {
  readonly kind: 'rfa.dispatched';
  readonly rfaId: string;
  readonly managerId: string;
  readonly listingId: string;
  readonly dispatchedBy: string;
}

/** Task assigned to a staff member — drives mobile inbox pulse. */
export interface TaskAssignedEvent extends BaseEvent {
  readonly kind: 'task.assigned';
  readonly taskId: string;
  readonly assigneeId: string;
  readonly assignedBy: string;
  readonly title: string;
  readonly unitId: string | null;
  readonly priority: 'low' | 'medium' | 'high' | 'urgent';
}

/** Staff reported a safety incident — owner + manager pulse. */
export interface SafetyIncidentEvent extends BaseEvent {
  readonly kind: 'safety.incident_reported';
  readonly incidentId: string;
  readonly unitId: string | null;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly reportedBy: string;
  readonly summary: string;
}

/** Rent payout initiated to the landlord — mobile pulse. */
export interface RentPayoutInitiatedEvent extends BaseEvent {
  readonly kind: 'rent_payout.initiated';
  readonly payoutId: string;
  readonly ownerId: string;
  readonly amount: number;
  readonly currencyCode: string;
  readonly initiatedBy: string;
}

/** Payroll run committed — staff pulse "you've been paid". */
export interface PayrollCommittedEvent extends BaseEvent {
  readonly kind: 'payroll.committed';
  readonly payrollRunId: string;
  readonly periodEnd: string;
  readonly netTotal: number;
  readonly currencyCode: string;
  readonly headcount: number;
  readonly committedBy: string;
}

/** Operating licence renewed (final terminal state). */
export interface LicenceRenewedEvent extends BaseEvent {
  readonly kind: 'licence.renewed';
  readonly licenceId: string;
  readonly licenceKind: string;
  readonly renewedThrough: string;
  readonly renewedBy: string;
}

/** Chat handed off owner → manager → junior or any chain. */
export interface ChatHandoffEvent extends BaseEvent {
  readonly kind: 'chat.handoff';
  readonly handoffId: string;
  readonly fromActor: string;
  readonly toActor: string;
  readonly reason: string;
}

/** Manager approved / rejected / deferred a request. */
export interface ManagerApprovedEvent extends BaseEvent {
  readonly kind: 'manager.approved';
  readonly approvalId: string;
  readonly subject: string;
  readonly approvedBy: string;
  readonly decision: 'approve' | 'reject' | 'defer';
}

/** Marketplace / listings bid placed — seller surface pulse. */
export interface BidPlacedEvent extends BaseEvent {
  readonly kind: 'bid.placed';
  readonly bidId: string;
  readonly listingId: string | null;
  readonly amount: number;
  readonly currencyCode: string;
  readonly bidderId: string;
}

/** Incident escalated up the chain — owner cockpit alert pulse. */
export interface IncidentEscalatedEvent extends BaseEvent {
  readonly kind: 'incident.escalated';
  readonly incidentId: string;
  readonly fromLevel: string;
  readonly toLevel: string;
  readonly escalatedBy: string;
}

// ───────────────────────────────────────────────────────────────────
// Chat-driven dynamic tab CRUD
// ───────────────────────────────────────────────────────────────────

/** A new tab was spawned (brain or owner click). */
export interface CockpitTabSpawnedEvent extends BaseEvent {
  readonly kind: 'cockpit.tab.spawned';
  readonly userId: string;
  readonly tabId: string;
  readonly tabType: string;
  readonly title: string;
  readonly config: Record<string, unknown>;
  readonly originDeviceId: string | null;
  readonly source: 'brain' | 'owner';
}

/** A tab's config or title was patched. */
export interface CockpitTabUpdatedEvent extends BaseEvent {
  readonly kind: 'cockpit.tab.updated';
  readonly userId: string;
  readonly tabId: string;
  readonly patch: { readonly config?: Record<string, unknown>; readonly title?: string };
  readonly originDeviceId: string | null;
  readonly source: 'brain' | 'owner';
}

/** A tab was removed from the strip. */
export interface CockpitTabRemovedEvent extends BaseEvent {
  readonly kind: 'cockpit.tab.removed';
  readonly userId: string;
  readonly tabId: string;
  readonly originDeviceId: string | null;
  readonly source: 'brain' | 'owner';
}

/** A proactive proposal landed in the owner's inbox. */
export interface CockpitTabProposedEvent extends BaseEvent {
  readonly kind: 'cockpit.tab.proposed';
  readonly userId: string;
  readonly proposalId: string;
  readonly tabType: string;
  readonly title: string;
  readonly reasonEn: string;
  readonly reasonSw: string | null;
  /** ≥1 grounded id per the evidence rule. */
  readonly evidenceIds: ReadonlyArray<string>;
  readonly confidence: number | null;
}

// ───────────────────────────────────────────────────────────────────
// Day-1 super-powered demo
//
// Fires exactly once per tenant — after the first corpus_doc_uploads
// row crosses the 'indexed' threshold and the onboarding jumpstart
// prepared the Day-1 insights card.
// ───────────────────────────────────────────────────────────────────

export interface PropertyCelebrateEvent extends BaseEvent {
  readonly kind: 'property.celebrate';
  readonly userId: string;
  readonly uploadId: string;
  readonly filename: string;
  readonly headerEn: string;
  readonly headerSw: string;
  readonly proposalCount: number;
}
