/**
 * PI-A · change-tracking · wrapMutation — the universal mutation middleware.
 *
 * A destructive change is one that overwrites a non-null, non-empty existing
 * value with a different value. Filling an empty (undefined / null / '')
 * attribute is NOT considered destructive — the constitutional gate is
 * skipped to avoid friction on the routine "fill in the gap" case.
 */

import {
  ConstitutionDeniedError,
  type ChangeRecord,
  type MutationContext,
  type TrackedMutation,
  type TrackedMutationResult,
  type WrapMutationDeps,
} from './types.js';

function isDestructive(fromValue: unknown, toValue: unknown): boolean {
  if (fromValue === undefined || fromValue === null || fromValue === '') return false;
  // Both non-empty; deep-equal means no real change → not destructive.
  if (fromValue === toValue) return false;
  // For objects/arrays, conservative: treat any change as destructive.
  return JSON.stringify(fromValue) !== JSON.stringify(toValue);
}

/**
 * Wrap a per-attribute mutation. Returns a TrackedMutation that performs:
 *   read pre-state → constitutional gate (if destructive) → set value →
 *   record history → emit ChangeRecord.
 */
export function wrapMutation(deps: WrapMutationDeps): TrackedMutation {
  return async (ctx: MutationContext): Promise<TrackedMutationResult> => {
    const fromValue = await deps.getCurrentValue(ctx.tenantId, ctx.entityId, ctx.attributeKey);
    if (isDestructive(fromValue, ctx.toValue)) {
      const verdict = await deps.enforceConstitution(ctx, fromValue);
      if (!verdict.allowed) {
        throw new ConstitutionDeniedError(verdict);
      }
    }
    await deps.setValue(ctx.tenantId, ctx.entityId, ctx.attributeKey, ctx.toValue);
    const entry = await deps.history.recordChange({
      tenantId: ctx.tenantId,
      entityId: ctx.entityId,
      entityKind: ctx.entityKind,
      attributeKey: ctx.attributeKey,
      fromValue,
      toValue: ctx.toValue,
      actor: ctx.actor,
      reason: ctx.reason,
      source: ctx.source,
      evidence: ctx.evidence,
      observedAt: ctx.observedAt,
    });
    const changeRecord: ChangeRecord = Object.freeze({
      kind: 'change-record',
      tenantId: ctx.tenantId,
      entityId: ctx.entityId,
      entityKind: ctx.entityKind,
      attributeKey: ctx.attributeKey,
      fromValue,
      toValue: ctx.toValue,
      actor: Object.freeze({ ...ctx.actor }),
      reason: ctx.reason,
      source: Object.freeze({ ...ctx.source }),
      evidence: Object.freeze(ctx.evidence.map((e) => Object.freeze({ ...e }))),
      historyEntryId: entry.id,
      recordedAt: entry.recordedAt,
    });
    return Object.freeze({ fromValue, toValue: ctx.toValue, changeRecord });
  };
}

/**
 * Convenience: build an "always allow" constitution gate for tests / for
 * non-destructive paths where the platform short-circuits the gate.
 */
export const ALLOW_ALL_CONSTITUTION: WrapMutationDeps['enforceConstitution'] = async () =>
  Object.freeze({ allowed: true });
