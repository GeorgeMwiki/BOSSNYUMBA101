/**
 * PI-A · evidence-pending — low-confidence-observation triage queue.
 *
 * Low-confidence observations don't write to the entity store and don't
 * surface a suggestion in chat. Instead they file into the
 * `evidence_pending` entity for the owner to review at their leisure.
 *
 *   list()        — render in chat via K-G renderTabInChat({ entity_type: 'evidence_pending' })
 *   approve(id)   — promote the queued observation to a real apply (writes
 *                   via the supplied auto-fill path, with history + receipt)
 *   reject(id)    — remove from the queue; recorded with a reason
 *   requestMore(id) — flag the row as awaiting fresh evidence
 *   addCorroboration(id, obs) — when a NEW observation confirms a queued
 *                   one, the queue auto-promotes once 3 independent sources
 *                   have confirmed (auto-promote rule)
 *
 * The auto-promote rule is the "platform getting smarter over time" loop:
 * three independent sources confirming a low-confidence observation are
 * collectively as good as a single high-confidence source. The promotion
 * goes through autoFill so the owner still gets the receipt.
 */

import type { ConfidenceScore } from '../confidence/types.js';
import type { ObservationEvent, ObservationSourceKind } from '../observations/types.js';

export type EvidencePendingStatus = 'open' | 'approved' | 'rejected' | 'awaiting_evidence' | 'auto_promoted';

export interface EvidencePendingRow {
  readonly id: string;
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly proposedValue: unknown;
  readonly observation: ObservationEvent;
  readonly confidence: ConfidenceScore;
  /** Source kinds that have independently confirmed this proposedValue (set; current observation included). */
  readonly corroboratingSourceKinds: ReadonlySet<ObservationSourceKind>;
  readonly status: EvidencePendingStatus;
  readonly enqueuedAt: string;
  readonly resolvedAt?: string;
  readonly resolutionReason?: string;
}

/** Threshold for auto-promote: 3 independent source kinds confirming. */
export const AUTO_PROMOTE_SOURCE_KIND_THRESHOLD = 3;
