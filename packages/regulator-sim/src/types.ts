/**
 * Regulator simulation — shared domain types + boundary schemas.
 *
 * Mirrors the artefacts a Tanzania property / housing regulator, the lands
 * registry, or a PDPA examiner would request of a BossNyumba operator:
 * decision audit replays, subject-access / erasure proofs, and a supervision
 * document pack.
 *
 * The decision domains covered are lease / rent / payout decisions, with
 * property-specific decision-reason codes and portfolio supervision metrics.
 * All types are readonly; zod schemas validate at the package boundary.
 *
 * @module @bossnyumba/regulator-sim/types
 */

import { z } from 'zod';

/** A single decision the regulator may replay. */
export type DecisionOutcome =
  | 'approve'
  | 'approve_with_conditions'
  | 'decline'
  | 'defer';

/** The property decision domains the replay covers. */
export type DecisionDomain = 'lease' | 'rent' | 'payout';

export interface DecisionRecord {
  readonly decisionId: string;
  readonly domain: DecisionDomain;
  readonly decidedAt: string; // ISO 8601
  readonly outcome: DecisionOutcome;
  /** Chain-of-thought sink (id or content hash). Must be present. */
  readonly cotTrace: string;
  /** Decision-reason codes, property-specific (see DEFAULT_ALLOWED_REASON_CODES). */
  readonly reasonCodes: ReadonlyArray<string>;
  /** Tenant/owner-facing reason notes. Both must be non-empty. */
  readonly reasonNotesEn: string;
  readonly reasonNotesSw: string;
  readonly modelId: string;
  readonly modelCardVersion: string;
  readonly modelCardCurrentAt: string; // ISO 8601 of last model-card review
  readonly fairnessTpDelta: number; // |TPR_protected - TPR_baseline|
  readonly fairnessFpDelta: number;
  /** Whether this action crossed an org / subsidiary boundary. */
  readonly crossOrgAction: boolean;
  readonly approverIds: ReadonlyArray<string>; // for the four-eye check
}

export interface AuditReplayInput {
  readonly fromIso: string;
  readonly toIso: string;
  readonly records: ReadonlyArray<DecisionRecord>;
  /** Allowed disparate-impact tolerance (e.g. 0.1 for +/-10pp). */
  readonly fairnessTolerance: number;
  /** Models registered in the model registry. */
  readonly registeredModelIds: ReadonlyArray<string>;
  /** Reason codes accepted under the property decision framework. */
  readonly allowedReasonCodes: ReadonlyArray<string>;
  /** Max age (days) for a current model card. */
  readonly modelCardMaxAgeDays: number;
}

export type AuditFindingCode =
  | 'missing_cot'
  | 'missing_bilingual_notes'
  | 'unknown_model'
  | 'stale_model_card'
  | 'disallowed_reason_code'
  | 'fairness_breach'
  | 'missing_four_eye';

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditFinding {
  readonly decisionId: string;
  readonly code: AuditFindingCode;
  readonly severity: FindingSeverity;
  readonly detail: string;
}

export interface AuditReplayResult {
  readonly windowFrom: string;
  readonly windowTo: string;
  readonly recordsReplayed: number;
  readonly findings: ReadonlyArray<AuditFinding>;
  readonly passed: boolean;
}

// PDPA -----------------------------------------------------------------------

export interface SubjectAccessRequest {
  readonly subjectId: string;
  readonly receivedAt: string;
  readonly scope: 'full' | 'summary';
}

export interface ErasureRequest {
  readonly subjectId: string;
  readonly receivedAt: string;
}

export type PdpaAction = 'access' | 'erasure';

export interface PdpaResult {
  readonly subjectId: string;
  readonly action: PdpaAction;
  readonly artefactsCount: number;
  readonly fulfilledAt: string;
  readonly redactedFields: ReadonlyArray<string>;
  readonly residualOnLegalHold: ReadonlyArray<string>;
  readonly passed: boolean;
  readonly reason?: string;
}

// Supervision pack -----------------------------------------------------------

export interface SupervisionPackInput {
  readonly periodFromIso: string;
  readonly periodToIso: string;
  readonly institution: string;
  /** Portfolio / lease registration reference filed with the regulator. */
  readonly portfolioRegistrationNumber: string;
  /** Rent collected as a share of rent billed in the period (0..1). */
  readonly rentCollectionRatio: number;
  /** Active leases in good standing as a share of total (0..1). */
  readonly leaseComplianceRatio: number;
  /** Treasury liquidity coverage ratio (0..1+). */
  readonly liquidityRatio: number;
  /** AML / sanctions alerts raised + closed in the period. */
  readonly amlAlerts: number;
  readonly amlClosed: number;
}

export interface SupervisionDocument {
  readonly section: string;
  readonly title: string;
  readonly contents: string;
}

export interface SupervisionPackResult {
  readonly institution: string;
  readonly periodFromIso: string;
  readonly periodToIso: string;
  readonly documents: ReadonlyArray<SupervisionDocument>;
  readonly checksum: string;
}

/** Default property decision-reason codes accepted by the framework. */
export const DEFAULT_ALLOWED_REASON_CODES: ReadonlyArray<string> = [
  'INSPECTION_VERIFIED',
  'INSPECTION_INSUFFICIENT',
  'LEASE_VALID',
  'LEASE_LAPSED',
  'RENT_RECONCILED',
  'RENT_SHORTFALL',
  'TITLE_VERIFIED',
  'PAYOUT_WITHIN_TREASURY_LIMIT',
  'PAYOUT_EXCEEDS_TREASURY_LIMIT',
  'BENEFICIAL_OWNER_VERIFIED',
  'SANCTIONS_CLEAR',
];

// Boundary schemas -----------------------------------------------------------

/**
 * Boundary schema for an audit-replay request. Validates the request shape at
 * the wire facade before any pure replay logic runs. The record array is
 * validated structurally; the replay itself never throws on a finding.
 */
export const decisionRecordSchema = z.object({
  decisionId: z.string().min(1),
  domain: z.enum(['lease', 'rent', 'payout']),
  decidedAt: z.string().min(1),
  outcome: z.enum(['approve', 'approve_with_conditions', 'decline', 'defer']),
  cotTrace: z.string(),
  reasonCodes: z.array(z.string()),
  reasonNotesEn: z.string(),
  reasonNotesSw: z.string(),
  modelId: z.string(),
  modelCardVersion: z.string(),
  modelCardCurrentAt: z.string(),
  fairnessTpDelta: z.number(),
  fairnessFpDelta: z.number(),
  crossOrgAction: z.boolean(),
  approverIds: z.array(z.string()),
});

export const auditReplayInputSchema = z.object({
  fromIso: z.string().min(1),
  toIso: z.string().min(1),
  records: z.array(decisionRecordSchema),
  fairnessTolerance: z.number().min(0),
  registeredModelIds: z.array(z.string()),
  allowedReasonCodes: z.array(z.string()),
  modelCardMaxAgeDays: z.number().int().min(0),
});

/** Boundary schema for a subject-access request. */
export const subjectAccessRequestSchema = z.object({
  subjectId: z.string().min(1),
  receivedAt: z.string().min(1),
  scope: z.enum(['full', 'summary']),
});

/** Boundary schema for an erasure request. */
export const erasureRequestSchema = z.object({
  subjectId: z.string().min(1),
  receivedAt: z.string().min(1),
});

/**
 * Numeric-input schema for the supervision pack. Ratios are non-negative
 * finite numbers (liquidity can exceed 1.0); alert counts are non-negative
 * integers. This is the numeric boundary guard for externally-sourced metrics.
 */
export const supervisionPackInputSchema = z.object({
  periodFromIso: z.string().min(1),
  periodToIso: z.string().min(1),
  institution: z.string().min(1),
  portfolioRegistrationNumber: z.string().min(1),
  rentCollectionRatio: z.number().min(0).finite(),
  leaseComplianceRatio: z.number().min(0).finite(),
  liquidityRatio: z.number().min(0).finite(),
  amlAlerts: z.number().int().min(0),
  amlClosed: z.number().int().min(0),
});
