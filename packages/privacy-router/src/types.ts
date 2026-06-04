/**
 * Privacy-router — shared domain types and boundary schemas.
 *
 * The privacy-router is the canonical home of the four-tier data-sensitivity
 * classification for the BossNyumba real-estate operating system. It routes an
 * AI inference request to a provider based on the sensitivity tier of its
 * payload, enforcing Tanzania BOT Act / PDPA data-residency rules.
 *
 * NOTE ON OVERLAP: `@bossnyumba/graph-privacy` is a *differential-privacy*
 * aggregator (epsilon/delta budget, k-anonymity) — a different concept that
 * does NOT export a sensitivity-tier classification or a field classifier.
 * There is therefore no upstream `DataClassification` to reuse; this package
 * defines it and exposes a {@link FieldClassifierPort} so any future
 * data-classification package can be injected here instead of re-implemented.
 *
 * Wire-agnostic: PII stripping, local-endpoint health, field classification,
 * audit, and the clock are all injected ports (see `./ports`), so this leaf
 * has no `node:*`, no `fetch`, no `pg`/Drizzle/Supabase, and no `process.env`
 * reads. All domain types are `readonly`; zod schemas validate at boundaries.
 */

import { z } from 'zod';

/** Four-tier data-sensitivity classification. */
export type DataClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

/** Severity order, lowest to highest. Higher index = more restrictive. */
export const CLASSIFICATION_ORDER: ReadonlyArray<DataClassification> = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
];

/**
 * Real-estate task categories. Each maps to a minimum classification in the
 * routing policy. The taxonomy spans the rent ledger, leases, disbursements,
 * property valuation, treasury, and the marketplace.
 */
export type TaskCategory =
  // PUBLIC
  | 'learning_teaching'
  | 'marketplace_listing_copy'
  | 'public_disclosure'
  | 'blog_generation'
  // INTERNAL
  | 'platform_insight'
  | 'arrears_forecast'
  | 'data_aggregation'
  | 'batch_processing'
  // CONFIDENTIAL
  | 'rent_assessment'
  | 'lease_review'
  | 'disbursement_narrative'
  | 'treasury_analysis'
  | 'workforce_advisory'
  | 'valuation_interpretation'
  | 'document_extraction'
  // RESTRICTED
  | 'compliance_investigation'
  | 'sanctions_screening'
  | 'computer_use';

/** Approved cloud providers that meet Tanzania PDPA processing standards. */
export type ApprovedCloudProvider = 'claude' | 'openai';

/** Local inference endpoint (Ollama or compatible on-prem model). */
export type LocalProvider = 'ollama';

/** All provider identities the router can select. */
export type PrivacyProvider = ApprovedCloudProvider | LocalProvider;

/** Terminal routing target, including the deny outcome. */
export type RoutingEndpoint = PrivacyProvider | 'DENIED';

/**
 * Result of stripping PII from a payload. `mappings` carries the reversible
 * token-to-original substitutions so a caller can restore the response. Kept
 * as a plain object (not a Map) so results stay JSON-serialisable and
 * immutable.
 */
export interface StripResult {
  readonly stripped: string;
  readonly mappings: Readonly<Record<string, string>>;
}

/** Input to a single routing decision. */
export interface PrivacyRoutingRequest {
  /** The text payload to be sent to a provider. */
  readonly text: string;
  /** Explicit task category, if known from the task router. */
  readonly taskCategory?: TaskCategory;
  /** Field paths present in the payload (for classification lookup). */
  readonly fieldPaths?: ReadonlyArray<string>;
  /** Explicit classification override (skips auto-detection). */
  readonly classificationOverride?: DataClassification;
  /** Known names to strip (forwarded to the PII stripper). */
  readonly knownNames?: ReadonlyArray<string>;
  /** Preferred cloud provider when cloud is allowed. */
  readonly preferredProvider?: ApprovedCloudProvider;
}

/** Result returned by every routing decision. */
export interface PrivacyRoutingResult {
  readonly endpoint: RoutingEndpoint;
  readonly piiStripped: boolean;
  readonly strippedFields: ReadonlyArray<string>;
  readonly classification: DataClassification;
  readonly reason: string;
  readonly timestamp: string;
  /** Token mappings for response restoration when PII was stripped. */
  readonly piiMappings?: Readonly<Record<string, string>>;
  /** The (possibly stripped) text to send to the provider. */
  readonly processedText?: string;
}

/** A single audit entry for a routing decision. Raw PII is never recorded. */
export interface PrivacyAuditEntry {
  readonly timestamp: string;
  readonly classification: DataClassification;
  readonly endpoint: RoutingEndpoint;
  readonly piiStripped: boolean;
  readonly strippedFieldCount: number;
  readonly taskCategory: TaskCategory | 'unknown';
  readonly reason: string;
}

// ─────────────────────────────────────────────────────────────────────
// Boundary schemas — validate untrusted input at the facade edge.
// ─────────────────────────────────────────────────────────────────────

const classificationEnum = z.enum([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
]);

const taskCategoryEnum = z.enum([
  'learning_teaching',
  'marketplace_listing_copy',
  'public_disclosure',
  'blog_generation',
  'platform_insight',
  'arrears_forecast',
  'data_aggregation',
  'batch_processing',
  'rent_assessment',
  'lease_review',
  'disbursement_narrative',
  'treasury_analysis',
  'workforce_advisory',
  'valuation_interpretation',
  'document_extraction',
  'compliance_investigation',
  'sanctions_screening',
  'computer_use',
]);

const approvedProviderEnum = z.enum(['claude', 'openai']);

/**
 * Request schema. Validates an inbound routing request at the wire boundary.
 * A malformed payload is rejected here (caught by the facade) rather than
 * flowing into the routing core. `text` may be empty (a zero-length payload
 * is a valid PUBLIC route), but must be a string.
 */
export const privacyRoutingRequestSchema = z.object({
  text: z.string(),
  taskCategory: taskCategoryEnum.optional(),
  fieldPaths: z.array(z.string().min(1)).optional(),
  classificationOverride: classificationEnum.optional(),
  knownNames: z.array(z.string().min(1)).optional(),
  preferredProvider: approvedProviderEnum.optional(),
});

/**
 * Numeric-input schema for the audit-log `limit` argument. A non-finite,
 * negative, or non-integer limit is coerced/rejected here so the ring-buffer
 * read never receives a hostile bound.
 */
export const auditLimitSchema = z.number().int().nonnegative();
