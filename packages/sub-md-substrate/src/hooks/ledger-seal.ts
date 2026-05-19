/**
 * Ledger-seal helper — wraps the LedgerSealPort with the substrate's
 * defaults: deterministic input/output hashing, status derived from the
 * permission-mode hook, side-effect count clamped to the cap.
 */

import type {
  LedgerEntry,
  LedgerStatus,
  PrimitiveContext,
  PrimitiveKind,
  PrimitiveResult,
} from '../types.js';
import { fingerprint } from '../util/hash.js';

export interface SealArgs<TOutput> {
  readonly ctx: PrimitiveContext;
  readonly primitiveName: string;
  readonly primitiveKind: PrimitiveKind;
  readonly input: unknown;
  readonly output: TOutput;
  readonly summary: string;
  readonly status: LedgerStatus;
  readonly sideEffectCount: number;
}

export async function sealLedgerEntry<TOutput>(
  args: SealArgs<TOutput>,
): Promise<PrimitiveResult<TOutput>> {
  const entry: LedgerEntry = Object.freeze({
    correlationId: args.ctx.correlationId,
    tenantId: args.ctx.scope.tenantId,
    primitiveName: args.primitiveName,
    primitiveKind: args.primitiveKind,
    emittedAtMs: args.ctx.nowMs,
    mode: args.ctx.mode,
    status: args.status,
    summary: args.summary,
    inputHash: fingerprint(args.input),
    outputHash: fingerprint(args.output),
    sideEffectCount: args.sideEffectCount,
    autonomyCapApplied: args.ctx.autonomyCap,
  });
  const sealed = await args.ctx.ledger.seal(entry);
  return Object.freeze({
    output: args.output,
    ledgerEntry: entry,
    sealedId: sealed.sealedId,
  });
}
