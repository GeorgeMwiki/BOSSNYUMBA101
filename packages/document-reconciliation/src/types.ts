/**
 * Cross-document fact reconciliation — shared types.
 *
 * A real-estate matter accumulates paperwork: NIDA/TIN identity, lease and
 * letting-agent licences, condition surveys, rent receipts, bank + M-PESA
 * statements, lease agreements. When several documents are submitted for one
 * tenant or owner, the brain projects each to a normalized {@link FactBag},
 * then runs pairwise comparisons to surface mismatches before a decision.
 * STRICT mismatches block; SOFT mismatches flag for human review.
 *
 * Extends {@link @bossnyumba/document-analysis}: the reconciler consumes the
 * extractor output shape (a flat field map) that pipeline produces. Thresholds
 * are named constants (no magic numbers in business logic). All domain types
 * here are readonly; the zod schemas validate at the package boundaries.
 *
 * @module @bossnyumba/document-reconciliation/types
 */

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Document taxonomy (real-estate matter)
// ----------------------------------------------------------------------------

/**
 * Property-domain document taxonomy. Aligns with the broader
 * `@bossnyumba/document-analysis` doc types and adds the identity / financial
 * documents the reconciler compares across.
 */
export type PropertyDocType =
  | 'nida'
  | 'tin-certificate'
  | 'drivers-licence'
  | 'passport'
  | 'voter-id'
  | 'lease-agreement'
  | 'letting-agent-licence'
  | 'condition-survey'
  | 'rent-receipt'
  | 'bank-statement'
  | 'mpesa-statement'
  | 'tenancy-application'
  | 'business-registration'
  | 'tax-clearance'
  | 'other';

// ----------------------------------------------------------------------------
// Normalized value shapes
// ----------------------------------------------------------------------------

export interface NormalizedName {
  readonly first: string;
  readonly middle?: string;
  readonly last: string;
  /** Original full-string after whitespace collapse + uppercase. */
  readonly full: string;
}

/** E.164 phone string. */
export type E164Phone = string;

export interface NormalizedAddress {
  readonly raw: string;
  readonly poBox?: string;
  readonly region?: string;
  readonly district?: string;
  readonly street?: string;
}

export interface BankAccountFact {
  readonly bank: string;
  readonly accountNumber: string;
}

// ----------------------------------------------------------------------------
// FactBag — one per source document
// ----------------------------------------------------------------------------

/** Comparable fact fields; also used as confidence-map keys. */
export type FactField =
  | 'primaryName'
  | 'dateOfBirth'
  | 'nationalId'
  | 'tin'
  | 'phones'
  | 'addresses'
  | 'bankAccounts'
  | 'amount';

export interface FactBag {
  readonly primaryName?: NormalizedName;
  /** ISO 8601 date string YYYY-MM-DD. */
  readonly dateOfBirth?: string;
  /** Digits-only national id. */
  readonly nationalId?: string;
  /** Digits-only TIN. */
  readonly tin?: string;
  readonly phones: readonly E164Phone[];
  readonly addresses: readonly NormalizedAddress[];
  readonly bankAccounts: readonly BankAccountFact[];
  /** Optional monetary fact (e.g. rent-receipt amount), minor-unit-free. */
  readonly amount?: number;
  readonly sourceDocId: string;
  readonly sourceDocType: PropertyDocType;
  readonly fieldConfidences: Readonly<Record<FactField, number>>;
}

// ----------------------------------------------------------------------------
// Match results
// ----------------------------------------------------------------------------

export interface NameMatchResult {
  readonly matched: boolean;
  readonly distance: number;
  readonly reasons: readonly string[];
  readonly swapDetected: boolean;
}

export interface AddressMatchResult {
  readonly matched: boolean;
  readonly similarity: number;
  readonly reasons: readonly string[];
}

export type DateTolerance = 'exact' | 'monthYear' | 'year';

// ----------------------------------------------------------------------------
// Mismatch + report
// ----------------------------------------------------------------------------

export type MismatchSeverity = 'STRICT_MISMATCH' | 'SOFT_MISMATCH';

export interface FactPairSource {
  readonly docId: string;
  readonly docType: PropertyDocType;
  readonly confidence: number;
}

export interface Mismatch {
  readonly field: FactField;
  readonly severity: MismatchSeverity;
  readonly leftValue: string;
  readonly rightValue: string;
  readonly left: FactPairSource;
  readonly right: FactPairSource;
  readonly reasonCodes: readonly string[];
  readonly explanation: string;
}

export interface Match {
  readonly field: FactField;
  readonly leftValue: string;
  readonly rightValue: string;
  readonly left: FactPairSource;
  readonly right: FactPairSource;
}

export interface Blocker {
  readonly field: FactField;
  readonly explanation: string;
  readonly involvedDocIds: readonly string[];
}

export interface SoftFlag {
  readonly field: FactField;
  readonly explanation: string;
  readonly involvedDocIds: readonly string[];
}

export interface ReconciliationReport {
  readonly mismatches: readonly Mismatch[];
  readonly matches: readonly Match[];
  /** Criticality-weighted share of compared pairs that matched, 0..1. */
  readonly overallConsistency: number;
  readonly blockers: readonly Blocker[];
  readonly softFlags: readonly SoftFlag[];
}

// ----------------------------------------------------------------------------
// Constants — named thresholds (no magic numbers in logic)
// ----------------------------------------------------------------------------

export const NAME_LEVENSHTEIN_SOFT_THRESHOLD = 2;
/**
 * Max extra-token gap for a token-subset name match to count as the SAME
 * person (a single missing/extra middle name). A larger gap (e.g.
 * 'Juma Kessy' vs 'Juma Hassan Kessy Mwita') is too much unexplained name
 * material to treat as a match — it surfaces as a mismatch instead.
 */
export const NAME_SUBSET_MAX_TOKEN_DELTA = 1;
export const ADDRESS_SIMILARITY_MATCH_THRESHOLD = 0.6;
export const ADDRESS_SIMILARITY_STRICT_BELOW = 0.25;
export const LOW_CONFIDENCE_DOWNGRADE_THRESHOLD = 0.7;
export const DEFAULT_FIELD_CONFIDENCE = 1.0;

/** Tanzania country code (default jurisdiction). */
export const DEFAULT_COUNTRY_CODE = '255';

/** Identity fields where a mismatch is STRICT by default (different person). */
export const STRICT_IDENTITY_FIELDS: readonly FactField[] = [
  'nationalId',
  'tin',
  'dateOfBirth',
];

/** Field criticality 0..1 — weights overallConsistency. */
export const FIELD_CRITICALITY: Readonly<Record<FactField, number>> = {
  primaryName: 1.0,
  dateOfBirth: 1.0,
  nationalId: 1.0,
  tin: 0.9,
  phones: 0.7,
  addresses: 0.6,
  bankAccounts: 0.85,
  amount: 0.8,
};

export const REASON_CODES = {
  EXACT_MATCH: 'EXACT_MATCH',
  NORMALIZED_MATCH: 'NORMALIZED_MATCH',
  LEVENSHTEIN_WITHIN_THRESHOLD: 'LEVENSHTEIN_WITHIN_THRESHOLD',
  NAME_SWAP_DETECTED: 'NAME_SWAP_DETECTED',
  MIDDLE_NAME_DIFFERS: 'MIDDLE_NAME_DIFFERS',
  INITIALS_MATCH: 'INITIALS_MATCH',
  ADDRESS_FUZZY_MATCH: 'ADDRESS_FUZZY_MATCH',
  ADDRESS_REGION_MATCH: 'ADDRESS_REGION_MATCH',
  DATE_TOLERANCE_APPLIED: 'DATE_TOLERANCE_APPLIED',
  LOW_CONFIDENCE_DOWNGRADE: 'LOW_CONFIDENCE_DOWNGRADE',
  COMPLETELY_DIFFERENT: 'COMPLETELY_DIFFERENT',
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];

// ----------------------------------------------------------------------------
// Zod boundary schemas
// ----------------------------------------------------------------------------

/** All property doc types as a tuple for the zod enum. */
const PROPERTY_DOC_TYPES = [
  'nida',
  'tin-certificate',
  'drivers-licence',
  'passport',
  'voter-id',
  'lease-agreement',
  'letting-agent-licence',
  'condition-survey',
  'rent-receipt',
  'bank-statement',
  'mpesa-statement',
  'tenancy-application',
  'business-registration',
  'tax-clearance',
  'other',
] as const;

export const propertyDocTypeSchema = z.enum(PROPERTY_DOC_TYPES);

/**
 * Boundary schema for one extracted field as produced by the
 * `@bossnyumba/document-analysis` extractor pipeline. Confidence is on a
 * 0..100 scale to match that pipeline.
 */
export const extractedFieldSchema = z.object({
  field_name: z.string().min(1),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
  confidence: z.number(),
});

/**
 * Boundary schema for a persisted extraction projected for reconciliation.
 * Validated at the facade before a FactBag is built.
 */
export const extractionForReconciliationSchema = z.object({
  documentId: z.string().min(1),
  docType: propertyDocTypeSchema,
  fields: z.array(extractedFieldSchema),
});

/** Request schema for the reconciliation facade. */
export const reconciliationRequestSchema = z.object({
  /** Two or more extractions to reconcile against each other. */
  extractions: z.array(extractionForReconciliationSchema),
  /** Optional tenant scope for audit logging only (never used to filter). */
  tenantId: z.string().min(1).optional(),
  /** Optional matter / thread id for audit correlation. */
  matterId: z.string().min(1).optional(),
});

export type ReconciliationRequest = z.infer<typeof reconciliationRequestSchema>;

/** The zod-parsed extraction shape (its `value` key is optional post-parse). */
export type ParsedExtraction = z.infer<typeof extractionForReconciliationSchema>;

/** Numeric-input schema reused by the amount matcher boundary. */
export const positiveAmountSchema = z.number().finite().positive();
