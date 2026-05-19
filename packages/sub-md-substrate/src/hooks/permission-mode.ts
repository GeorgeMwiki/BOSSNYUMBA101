/**
 * Permission-mode hook — maps the four Claude-Code-style modes onto a
 * "may this primitive emit a side effect?" decision.
 *
 *   dry-run     → never; status = 'dry-run'
 *   propose     → emit a draft; status = 'draft'
 *   act-on-yes  → emit a draft + ask owner; status = 'awaiting-owner'
 *   auto        → may emit a sealed entry; status = 'sealed'
 *                 (subject to autonomy-cap below)
 */

import type {
  LedgerStatus,
  PermissionMode,
  PrimitiveContext,
} from '../types.js';

export interface PermissionDecision {
  readonly allowSideEffect: boolean;
  readonly ledgerStatus: LedgerStatus;
  readonly reason: string;
}

export function decidePermission(
  ctx: PrimitiveContext,
): PermissionDecision {
  return decideFromMode(ctx.mode);
}

export function decideFromMode(mode: PermissionMode): PermissionDecision {
  switch (mode) {
    case 'dry-run':
      return {
        allowSideEffect: false,
        ledgerStatus: 'dry-run',
        reason: 'dry-run mode forbids side effects',
      };
    case 'propose':
      return {
        allowSideEffect: false,
        ledgerStatus: 'draft',
        reason: 'propose mode emits a draft only',
      };
    case 'act-on-yes':
      return {
        allowSideEffect: false,
        ledgerStatus: 'awaiting-owner',
        reason: 'act-on-yes mode awaits owner confirmation',
      };
    case 'auto':
      return {
        allowSideEffect: true,
        ledgerStatus: 'sealed',
        reason: 'auto mode acts immediately (cap-gated)',
      };
    default: {
      const _exhaustive: never = mode;
      void _exhaustive;
      return {
        allowSideEffect: false,
        ledgerStatus: 'rejected',
        reason: `unknown permission mode`,
      };
    }
  }
}
