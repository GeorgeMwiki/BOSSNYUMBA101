/**
 * PI-A · confidence — three-tier confidence model.
 *
 *   high   (≥ 0.9) → auto-apply with reversible receipt
 *   medium (0.7 – < 0.9) → emit chat suggestion w/ ApprovalDialog
 *   low    (< 0.7)  → file to evidence_pending for batch triage
 *
 * The tier is a function of:
 *   1. source-kind base rate (the platform's prior on each input channel)
 *   2. cross-source corroboration (more independent sources confirming →
 *      higher confidence; the same source counted once)
 *   3. current-value-conflict penalty (overwriting a non-empty value with
 *      a different value drops confidence; idempotent re-confirms don't)
 *   4. explicit-source-confidence (the source's own Verbalized
 *      Confidence in [0, 1] — M-E's calibration output)
 *   5. jurisdiction-consistency (the proposed value must not violate any
 *      JurisdictionalRule; failures hard-cap confidence to LOW)
 */

import type { ObservationSourceKind } from '../observations/types.js';

export type ConfidenceTier = 'high' | 'medium' | 'low';

export interface ConfidenceScore {
  readonly score: number;
  readonly tier: ConfidenceTier;
  readonly breakdown: ConfidenceBreakdown;
}

export interface ConfidenceBreakdown {
  readonly baseRate: number;
  readonly corroborationBonus: number;
  readonly conflictPenalty: number;
  readonly explicitConfidence: number;
  readonly jurisdictionPenalty: number;
}

export const HIGH_THRESHOLD = 0.9;
export const MEDIUM_THRESHOLD = 0.7;

/**
 * Source-kind base rates. These reflect the platform's prior on how
 * trustworthy each input channel is, before any other evidence is considered.
 *
 *   manual-edit       → 1.00 (the owner is explicitly telling the system)
 *   connector-api     → 0.92 (verified third party with stable contract)
 *   ingest-file       → 0.88 (structured file the owner uploaded)
 *   chat-attachment   → 0.78 (extracted from an attachment — OCR error risk)
 *   chat-text         → 0.65 (free-form text — paraphrase/typo risk)
 *   subagent-research → 0.55 (web research; subject to citation drift)
 */
export const SOURCE_BASE_RATES: Readonly<Record<ObservationSourceKind, number>> = Object.freeze({
  'manual-edit': 1.0,
  'connector-api': 0.92,
  'ingest-file': 0.88,
  'chat-attachment': 0.78,
  'chat-text': 0.65,
  'subagent-research': 0.55,
});

export interface HistoricalObservation {
  readonly source: { readonly kind: ObservationSourceKind; readonly ref: string };
  readonly observedValue: unknown;
}
