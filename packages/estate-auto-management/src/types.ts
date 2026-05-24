/**
 * @bossnyumba/estate-auto-management — shared types.
 *
 * All types are immutable. All advisor functions consume them
 * read-only and return new objects.
 */

// ---------------------------------------------------------------------------
// Assets / sensors / health
// ---------------------------------------------------------------------------

export type AssetFamily = 'hvac' | 'elevator' | 'pump' | 'generator' | 'gate-motor';

export interface AssetTelemetry {
  readonly assetId: string;
  readonly family: AssetFamily;
  /** Vibration RMS, mm/s (relative). */
  readonly vibrationMm: number;
  /** Surface temperature, °C. */
  readonly tempC: number;
  /** Total run-hours since commissioning. */
  readonly runHours: number;
  /** Days since the last preventive service. */
  readonly lastServiceAgeDays: number;
  /** Count of out-of-band spikes in the last 30 days. */
  readonly spikeCount30d: number;
}

export interface FailureForecast {
  readonly assetId: string;
  readonly family: AssetFamily;
  /** Normalised health score, 0–1 (lower = healthier). */
  readonly score: number;
  /** P(failure within Δd) per Weibull tail. */
  readonly probabilityWithin: Readonly<{
    readonly d7: number;
    readonly d30: number;
    readonly d90: number;
  }>;
  readonly verdict: 'healthy' | 'monitor' | 'service' | 'urgent';
}

// ---------------------------------------------------------------------------
// Vendors / dispatch
// ---------------------------------------------------------------------------

export interface VendorProfile {
  readonly id: string;
  readonly name: string;
  readonly family: AssetFamily;
  /** Median priceper job, normalised currency unit. */
  readonly medianJobPrice: number;
  /** Median response-time in hours. */
  readonly medianResponseHours: number;
  /** Re-work rate, 0..1 (lower = better quality). */
  readonly reworkRate: number;
  /** Distance from estate, kilometres. */
  readonly distanceKm: number;
  /** Insurance + licence valid? */
  readonly compliant: boolean;
  /** Availability flag (used by selector to fall back). */
  readonly available: boolean;
}

export interface VendorScore {
  readonly vendorId: string;
  readonly priceScore: number;
  readonly responseScore: number;
  readonly qualityScore: number;
  readonly proximityScore: number;
  readonly complianceScore: number;
  readonly total: number;
}

export interface VendorBid {
  readonly vendorId: string;
  readonly quotedPrice: number;
  readonly quotedResponseHours: number;
  readonly validUntilDays: number;
}

export interface VendorSelection {
  readonly selected: VendorScore | undefined;
  readonly ranked: ReadonlyArray<VendorScore>;
  readonly reason: string;
}

export interface VendorDispatchTrigger {
  readonly assetId: string;
  readonly family: AssetFamily;
  readonly priority: 'low' | 'med' | 'high' | 'critical';
  readonly slaHours: number;
  readonly dispatchedAt: string; // ISO
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Rent collection
// ---------------------------------------------------------------------------

export interface RentDue {
  readonly tenantId: string;
  readonly leaseId: string;
  readonly amount: number;
  readonly dueDate: string; // ISO yyyy-mm-dd
  readonly currency: string;
}

export type CollectionChannel =
  | 'mpesa-stk-push'
  | 'whatsapp-payment'
  | 'bank-transfer'
  | 'card-token';

export interface CollectionAttempt {
  readonly tenantId: string;
  readonly leaseId: string;
  readonly attemptNumber: number;
  readonly channel: CollectionChannel;
  /** Minutes from due date. */
  readonly offsetMinutes: number;
  readonly amount: number;
  readonly reason: string;
}

export interface PaymentHistorySummary {
  readonly fullPayCountLast6m: number;
  readonly currentBalanceMonths: number;
}

export type EscalationStage =
  | 'soft-reminder'
  | 'firm-reminder'
  | 'notice-to-cure'
  | 'eviction-prep';

export interface EscalationStep {
  readonly atDayFromDue: number;
  readonly stage: EscalationStage;
  readonly channels: ReadonlyArray<CommsChannel>;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------

export type CommsChannel = 'whatsapp' | 'sms' | 'email' | 'voice';

export interface TenantReachability {
  readonly tenantId: string;
  readonly whatsappReadRate: number; // 0..1
  readonly smsDeliveryRate: number; // 0..1
  readonly emailOpenRate: number; // 0..1
  readonly voiceAnswerRate: number; // 0..1
}

export interface ChannelScore {
  readonly channel: CommsChannel;
  readonly score: number;
}

export interface ChannelRouteDecision {
  readonly tenantId: string;
  readonly preferred: CommsChannel;
  readonly fallbacks: ReadonlyArray<CommsChannel>;
  readonly scores: ReadonlyArray<ChannelScore>;
}

// ---------------------------------------------------------------------------
// Lease workflows
// ---------------------------------------------------------------------------

export interface LeaseRecord {
  readonly leaseId: string;
  readonly tenantId: string;
  readonly assetId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly monthlyRent: number;
  readonly currency: string;
}

export type WorkflowTaskType =
  | 'renewal-offer'
  | 'renewal-followup'
  | 'renewal-final-call'
  | 'termination-notice'
  | 'termination-inspection'
  | 'termination-handover'
  | 'monthly-close';

export interface WorkflowTask {
  readonly leaseId?: string;
  readonly assetId?: string;
  readonly tenantId?: string;
  readonly type: WorkflowTaskType;
  readonly scheduledFor: string; // ISO
  readonly description: string;
}

// ---------------------------------------------------------------------------
// Reporting cadence
// ---------------------------------------------------------------------------

export type StakeholderKind = 'owner' | 'board' | 'regulator';
export type CadencePeriod = 'monthly' | 'quarterly' | 'yearly';
export type DeliveryChannel = 'email' | 'portal' | 'whatsapp' | 'paper';
export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';

export interface StakeholderPreference {
  readonly stakeholderId: string;
  readonly kind: StakeholderKind;
  readonly cadence: CadencePeriod;
  readonly delivery: DeliveryChannel;
  readonly format: ReportFormat;
}

export interface ReportScheduleEntry {
  readonly stakeholderId: string;
  readonly kind: StakeholderKind;
  readonly cadence: CadencePeriod;
  readonly nextRun: string; // ISO yyyy-mm-dd
  readonly delivery: DeliveryChannel;
  readonly format: ReportFormat;
}

// ---------------------------------------------------------------------------
// RPA orchestration
// ---------------------------------------------------------------------------

export interface RpaStep {
  readonly id: string;
  readonly name: string;
  readonly dependsOn?: ReadonlyArray<string>;
  /** Synchronous handler invoked by the orchestrator. */
  readonly run: () => Promise<unknown>;
  /** Optional idempotency key. */
  readonly idempotencyKey?: string;
  /** Retry policy: max attempts (default 3). */
  readonly maxAttempts?: number;
}

export interface RpaRunResult {
  readonly stepId: string;
  readonly status: 'success' | 'failure' | 'skipped';
  readonly attempts: number;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Ports (injected)
// ---------------------------------------------------------------------------

export interface NotifyPort {
  send(
    tenantId: string,
    channel: CommsChannel,
    body: string,
  ): Promise<{ delivered: boolean }>;
}

export interface PaymentPort {
  /** Initiate an STK push (or equivalent) for tenantId. */
  charge(req: {
    readonly tenantId: string;
    readonly amount: number;
    readonly currency: string;
    readonly idempotencyKey: string;
  }): Promise<{ accepted: boolean; reference?: string }>;
}

export interface WorkOrderPort {
  open(req: VendorDispatchTrigger): Promise<{ workOrderId: string }>;
}
