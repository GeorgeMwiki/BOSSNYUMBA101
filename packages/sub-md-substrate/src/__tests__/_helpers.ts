/**
 * Test helpers — context factory + assertion helpers used across the
 * primitive + vertical-pack tests.
 */

import { DEFAULT_AUTONOMY_CAP } from '../types.js';
import type { AutonomyCap, PermissionMode, PrimitiveContext } from '../types.js';
import { createLedgerRecorder, type LedgerRecorder } from '../util/ledger-recorder.js';

export interface MakeCtxArgs {
  readonly tenantId?: string;
  readonly nowMs?: number;
  readonly mode?: PermissionMode;
  readonly autonomyCap?: AutonomyCap;
  readonly correlationId?: string;
  readonly ledger?: LedgerRecorder;
  readonly scopeIds?: ReadonlyArray<string>;
  readonly ownerId?: string;
}

export interface MakeCtxResult {
  readonly ctx: PrimitiveContext;
  readonly recorder: LedgerRecorder;
}

export function makeCtx(args: MakeCtxArgs = {}): MakeCtxResult {
  const recorder = args.ledger ?? createLedgerRecorder();
  const ctx: PrimitiveContext = Object.freeze({
    scope: Object.freeze({
      tenantId: args.tenantId ?? 'tenant-1',
      ...(args.ownerId !== undefined ? { ownerId: args.ownerId } : {}),
      ...(args.scopeIds !== undefined ? { scopeIds: Object.freeze([...args.scopeIds]) } : {}),
    }),
    nowMs: args.nowMs ?? 1_700_000_000_000,
    correlationId: args.correlationId ?? 'corr-1',
    mode: args.mode ?? 'propose',
    autonomyCap: args.autonomyCap ?? DEFAULT_AUTONOMY_CAP,
    ledger: recorder,
  });
  return { ctx, recorder };
}
