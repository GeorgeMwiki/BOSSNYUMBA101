/**
 * PI-A · auto-fill — the actual fill mechanism.
 *
 * Given an ObservationEvent + a computed ConfidenceTier, autoFill chooses
 * between three paths:
 *
 *   high   → write the new value to the entity store, record to history,
 *            emit an Action Receipt block (K-B pattern) with an undo token.
 *   medium → return a SuggestionPending payload that the MD turns into an
 *            in-chat ApprovalDialog block; nothing is written.
 *   low    → enqueue the observation in evidence_pending for batch triage.
 *
 * The function is async (it touches the store + history) but pure with
 * respect to the input — no other side effects.
 */

import type { ObservationEvent, EvidenceRef } from '../observations/types.js';
import type { ConfidenceScore, ConfidenceTier } from '../confidence/types.js';
import type { ChangeActor } from '../history/types.js';

/**
 * Minimal entity-store contract used by auto-fill. Decoupled from J1's
 * larger IEntityStoreService so this package can be tested in isolation.
 * Production wires a J1 adapter that satisfies this surface.
 */
export interface IAutoFillEntityStore {
  getAttribute(
    tenantId: string,
    entityId: string,
    attributeKey: string,
  ): Promise<unknown | undefined>;

  setAttribute(
    tenantId: string,
    entityId: string,
    attributeKey: string,
    value: unknown,
  ): Promise<void>;
}

/** Minimal sink for the evidence-pending queue. Real impl in evidence-pending module. */
export interface IEvidencePendingSink {
  enqueue(observation: ObservationEvent, score: ConfidenceScore): Promise<string>;
}

/**
 * Action Receipt block (K-B pattern). Emitted into chat after every
 * auto-applied change so the owner can undo within the rollback window.
 *
 * `undoToken` is opaque — feed it back to change-tracking.undoChange() to
 * rollback within the rollback window (defaults to 24 hours; jurisdiction-
 * scoped overrides for legal documents).
 */
export interface AutoFillReceipt {
  readonly kind: 'auto-fill-receipt';
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly fromValue: unknown;
  readonly toValue: unknown;
  readonly confidence: ConfidenceScore;
  readonly evidence: ReadonlyArray<EvidenceRef>;
  /** History entry id of the recorded change. */
  readonly historyEntryId: string;
  /** Opaque token for change-tracking.undoChange(). */
  readonly undoToken: string;
  /** ISO-8601. The deadline after which undoChange will reject with rollback-expired. */
  readonly undoableUntil: string;
}

/** Pending suggestion block emitted for medium-tier observations. */
export interface SuggestionPending {
  readonly kind: 'suggestion-pending';
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly currentValue: unknown;
  readonly proposedValue: unknown;
  readonly confidence: ConfidenceScore;
  readonly evidence: ReadonlyArray<EvidenceRef>;
  /** Suggestion id; the MD passes this back when the owner approves/rejects. */
  readonly suggestionId: string;
}

/** Queued reference for low-tier observations. */
export interface EvidencePendingHandle {
  readonly kind: 'evidence-pending-queued';
  readonly tenantId: string;
  readonly evidencePendingId: string;
  readonly attributeKey: string;
  readonly confidence: ConfidenceScore;
}

export type AutoFillOutcome = AutoFillReceipt | SuggestionPending | EvidencePendingHandle;

export interface AutoFillResult {
  readonly tier: ConfidenceTier;
  readonly outcome: AutoFillOutcome;
}

export interface AutoFillInput {
  readonly observation: ObservationEvent;
  readonly currentValue: unknown;
  readonly confidence: ConfidenceScore;
  readonly actor: ChangeActor;
  readonly store: IAutoFillEntityStore;
  readonly evidenceSink: IEvidencePendingSink;
  readonly recordHistory: (toValue: unknown, fromValue: unknown) => Promise<{ id: string }>;
  /** Rollback window in milliseconds. Defaults to 24 hours. */
  readonly rollbackWindowMs?: number;
}
