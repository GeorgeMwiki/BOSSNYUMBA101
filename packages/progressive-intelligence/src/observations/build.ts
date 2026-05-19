/**
 * PI-A · observations · builders — construct ObservationEvents with the same
 * invariants enforced everywhere they are produced (chat, ingest, connector,
 * sub-agent, manual edit).
 *
 * Why a builder instead of a class constructor:
 *  • the input shape is permissive (the call-site has a seed); the output
 *    is strict (frozen ObservationEvent with validated invariants)
 *  • the builder runs the cross-cutting checks (non-empty tenantId,
 *    attributeKey present, evidence non-empty, source.confidence in [0,1])
 *    in one place so every producer pays the cost
 *  • frozen objects are the immutability rule for this codebase
 */

import type {
  EvidenceRef,
  ObservationEvent,
  ObservationSource,
  ObservationSourceKind,
} from './types.js';

const VALID_SOURCE_KINDS: ReadonlySet<ObservationSourceKind> = new Set([
  'chat-text',
  'chat-attachment',
  'ingest-file',
  'connector-api',
  'subagent-research',
  'manual-edit',
]);

export interface BuildObservationInput {
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly observedValue: unknown;
  readonly source: ObservationSource;
  readonly evidence: ReadonlyArray<EvidenceRef>;
}

/** Thrown when an ObservationEvent fails its construction invariants. */
export class InvalidObservationError extends Error {
  public constructor(reason: string) {
    super(`InvalidObservationError: ${reason}`);
    this.name = 'InvalidObservationError';
  }
}

function assertNonEmpty(label: string, value: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidObservationError(`${label} must be a non-empty string`);
  }
}

function assertEvidence(evidence: ReadonlyArray<EvidenceRef>): void {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new InvalidObservationError('evidence must be a non-empty array');
  }
  for (const e of evidence) {
    assertNonEmpty('evidence.identifier', e.identifier);
    if (!/^[0-9a-f]{64}$/.test(e.hash)) {
      throw new InvalidObservationError(
        'evidence.hash must be lower-case hex sha256 (64 chars)',
      );
    }
  }
}

function assertSource(source: ObservationSource): void {
  if (!VALID_SOURCE_KINDS.has(source.kind)) {
    throw new InvalidObservationError(`unknown source kind: ${String(source.kind)}`);
  }
  assertNonEmpty('source.ref', source.ref);
  if (
    typeof source.confidence !== 'number' ||
    !Number.isFinite(source.confidence) ||
    source.confidence < 0 ||
    source.confidence > 1
  ) {
    throw new InvalidObservationError('source.confidence must be a finite number in [0, 1]');
  }
  if (typeof source.observedAt !== 'string' || Number.isNaN(Date.parse(source.observedAt))) {
    throw new InvalidObservationError('source.observedAt must be ISO-8601 parseable');
  }
}

/**
 * Validate and freeze an ObservationEvent.
 *
 * @throws InvalidObservationError when any invariant is violated.
 */
export function buildObservation(input: BuildObservationInput): ObservationEvent {
  assertNonEmpty('tenantId', input.tenantId);
  assertNonEmpty('entityId', input.entityId);
  assertNonEmpty('entityKind', input.entityKind);
  assertNonEmpty('attributeKey', input.attributeKey);
  assertSource(input.source);
  assertEvidence(input.evidence);
  return Object.freeze({
    tenantId: input.tenantId,
    entityId: input.entityId,
    entityKind: input.entityKind,
    attributeKey: input.attributeKey,
    observedValue: input.observedValue,
    source: Object.freeze({ ...input.source }),
    evidence: Object.freeze(input.evidence.map((e) => Object.freeze({ ...e }))),
  });
}
