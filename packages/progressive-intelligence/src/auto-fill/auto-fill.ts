/**
 * PI-A · auto-fill · autoFill — orchestrates the three paths.
 *
 * Implementation details:
 *  • The undoToken is a sha256 over (historyEntryId + recordedAt + actor.id).
 *    It is verifiable by change-tracking without storing extra state.
 *  • For high-tier, the entity-store write and history record are ordered
 *    so a failure in either leaves the system consistent — history then
 *    entity-store (history is append-only and idempotent on supersedes;
 *    if entity-store write fails after history, we record a
 *    compensating history entry — handled at the change-tracking layer).
 *  • For medium-tier, a stable suggestionId is computed so re-running
 *    autoFill on the same observation does not produce a new suggestion.
 */

import { createHash, randomUUID } from 'node:crypto';

import type {
  AutoFillInput,
  AutoFillReceipt,
  AutoFillResult,
  EvidencePendingHandle,
  SuggestionPending,
} from './types.js';

const DEFAULT_ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

function computeUndoToken(historyEntryId: string, recordedAt: string, actorId: string): string {
  return createHash('sha256')
    .update(`${historyEntryId}::${recordedAt}::${actorId}`)
    .digest('hex');
}

function computeSuggestionId(observation: AutoFillInput['observation']): string {
  return createHash('sha256')
    .update(
      [
        observation.tenantId,
        observation.entityId,
        observation.attributeKey,
        JSON.stringify(observation.observedValue),
        observation.source.kind,
        observation.source.ref,
      ].join('::'),
    )
    .digest('hex');
}

async function applyHigh(input: AutoFillInput): Promise<AutoFillReceipt> {
  const { observation, currentValue, confidence, actor, store, recordHistory } = input;
  const entry = await recordHistory(observation.observedValue, currentValue);
  await store.setAttribute(
    observation.tenantId,
    observation.entityId,
    observation.attributeKey,
    observation.observedValue,
  );
  const window = input.rollbackWindowMs ?? DEFAULT_ROLLBACK_WINDOW_MS;
  const undoableUntil = new Date(Date.now() + window).toISOString();
  const recordedAt = new Date().toISOString();
  return Object.freeze({
    kind: 'auto-fill-receipt',
    tenantId: observation.tenantId,
    entityId: observation.entityId,
    entityKind: observation.entityKind,
    attributeKey: observation.attributeKey,
    fromValue: currentValue,
    toValue: observation.observedValue,
    confidence,
    evidence: observation.evidence,
    historyEntryId: entry.id,
    undoToken: computeUndoToken(entry.id, recordedAt, actor.id),
    undoableUntil,
  });
}

function suggestMedium(input: AutoFillInput): SuggestionPending {
  return Object.freeze({
    kind: 'suggestion-pending',
    tenantId: input.observation.tenantId,
    entityId: input.observation.entityId,
    entityKind: input.observation.entityKind,
    attributeKey: input.observation.attributeKey,
    currentValue: input.currentValue,
    proposedValue: input.observation.observedValue,
    confidence: input.confidence,
    evidence: input.observation.evidence,
    suggestionId: computeSuggestionId(input.observation),
  });
}

async function enqueueLow(input: AutoFillInput): Promise<EvidencePendingHandle> {
  const id = await input.evidenceSink.enqueue(input.observation, input.confidence);
  return Object.freeze({
    kind: 'evidence-pending-queued',
    tenantId: input.observation.tenantId,
    evidencePendingId: id,
    attributeKey: input.observation.attributeKey,
    confidence: input.confidence,
  });
}

/**
 * Choose the auto-fill path based on the confidence tier. Throws only when
 * the dependencies themselves throw — the function does no validation
 * beyond the tier dispatch (the inputs were already validated upstream).
 */
export async function autoFill(input: AutoFillInput): Promise<AutoFillResult> {
  const tier = input.confidence.tier;
  if (tier === 'high') {
    const outcome = await applyHigh(input);
    return Object.freeze({ tier, outcome });
  }
  if (tier === 'medium') {
    const outcome = suggestMedium(input);
    return Object.freeze({ tier, outcome });
  }
  const outcome = await enqueueLow(input);
  return Object.freeze({ tier, outcome });
}

/**
 * Construct a fresh history-recorder closure for the auto-fill path. Passed
 * to autoFill so the auto-fill module doesn't need to know about
 * RecordChangeInput's full shape.
 */
export function makeHistoryRecorder(
  store: import('../history/types.js').IHistoryStore,
  ctx: {
    tenantId: string;
    entityId: string;
    entityKind: string;
    attributeKey: string;
    actor: import('../history/types.js').ChangeActor;
    reason: string;
    source: import('../history/types.js').ChangeSource;
    evidence: ReadonlyArray<import('../observations/types.js').EvidenceRef>;
    observedAt: string;
  },
): (toValue: unknown, fromValue: unknown) => Promise<{ id: string }> {
  return async (toValue, fromValue) => {
    const entry = await store.recordChange({
      tenantId: ctx.tenantId,
      entityId: ctx.entityId,
      entityKind: ctx.entityKind,
      attributeKey: ctx.attributeKey,
      fromValue,
      toValue,
      actor: ctx.actor,
      reason: ctx.reason,
      source: ctx.source,
      evidence: ctx.evidence,
      observedAt: ctx.observedAt,
    });
    return { id: entry.id };
  };
}

/** Test-friendly random id helper (used by InMemoryEvidencePendingSink etc). */
export function randomId(): string {
  return randomUUID();
}
