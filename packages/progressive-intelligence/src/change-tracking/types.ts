/**
 * PI-A · change-tracking — universal mutation middleware.
 *
 * `wrapMutation(mutation)` takes any function shaped like
 *
 *   async (input) => { … apply mutation to entity store …; return result; }
 *
 * and returns a TrackedMutation that:
 *
 *   1. captures the pre-state (fromValue) before invoking the inner function
 *   2. checks the change against the M-B constitutional gate when the
 *      change is *destructive* (overwriting an existing non-null value or
 *      deleting an entity) — `enforceConstitution(input)` callback
 *   3. invokes the wrapped mutation
 *   4. records the change to history (post-state, source, evidence)
 *   5. emits a ChangeRecord block (K-B Action Receipts) for chat display
 *
 * The wrapper is generic so any entity-store mutation — set, delete,
 * batch-write — can be wrapped without bespoke per-call wiring.
 */

import type { EvidenceRef } from '../observations/types.js';
import type { ChangeActor, ChangeSource, IHistoryStore } from '../history/types.js';

/**
 * A ChangeRecord ag-ui block. Rendered inline in the chat timeline after
 * the wrapped mutation completes. The undoToken is opaque — pass it back
 * to undoChange() to revert (within rollback window).
 */
export interface ChangeRecord {
  readonly kind: 'change-record';
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly fromValue: unknown;
  readonly toValue: unknown;
  readonly actor: ChangeActor;
  readonly reason: string;
  readonly source: ChangeSource;
  readonly evidence: ReadonlyArray<EvidenceRef>;
  readonly historyEntryId: string;
  readonly recordedAt: string;
}

/**
 * Constitutional gate verdict — produced by the caller-supplied
 * `enforceConstitution` callback for destructive changes (M-B verification
 * stack). The wrapper only inspects `allowed`; the verdict body is forwarded
 * back to the caller verbatim on denial so the chat layer can render the
 * full reasoning.
 */
export interface ConstitutionVerdict {
  readonly allowed: boolean;
  readonly principle?: string;
  readonly reasoning?: string;
}

/** Thrown when the constitutional gate denies a destructive change. */
export class ConstitutionDeniedError extends Error {
  public readonly verdict: ConstitutionVerdict;
  public constructor(verdict: ConstitutionVerdict) {
    super(
      `ConstitutionDeniedError: change denied${verdict.principle ? ` by principle "${verdict.principle}"` : ''}`,
    );
    this.name = 'ConstitutionDeniedError';
    this.verdict = verdict;
  }
}

/**
 * Wraps a generic per-attribute mutation. The shape is intentionally narrow
 * — set or clear one attribute on one entity per call. Bulk operations
 * compose multiple wrapped mutations.
 */
export interface MutationContext {
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly toValue: unknown;
  readonly actor: ChangeActor;
  readonly reason: string;
  readonly source: ChangeSource;
  readonly evidence: ReadonlyArray<EvidenceRef>;
  readonly observedAt: string;
}

export interface TrackedMutationResult {
  readonly fromValue: unknown;
  readonly toValue: unknown;
  readonly changeRecord: ChangeRecord;
}

export type TrackedMutation = (ctx: MutationContext) => Promise<TrackedMutationResult>;

export interface WrapMutationDeps {
  readonly getCurrentValue: (
    tenantId: string,
    entityId: string,
    attributeKey: string,
  ) => Promise<unknown | undefined>;
  readonly setValue: (
    tenantId: string,
    entityId: string,
    attributeKey: string,
    value: unknown,
  ) => Promise<void>;
  readonly history: IHistoryStore;
  /**
   * Constitutional gate — returns verdict for destructive changes only.
   * For non-destructive changes (filling an empty attribute), this is NOT
   * called. Production wires K-E's enforceConstitution.
   */
  readonly enforceConstitution: (ctx: MutationContext, fromValue: unknown) => Promise<ConstitutionVerdict>;
}
