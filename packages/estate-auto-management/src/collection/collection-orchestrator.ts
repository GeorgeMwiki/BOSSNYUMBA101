/**
 * Rent-collection orchestrator.
 *
 * Generates the canonical M-Pesa STK Push retry plan (4 attempts:
 * t+0, t+4h, t+1d, t+3d) plus extension hooks for other channels.
 *
 * Pure: emits the planned attempts as `CollectionAttempt[]`.
 * Actual `charge()` calls happen via injected `PaymentPort` in the
 * RPA bot-orchestrator, not here.
 */

import type { CollectionAttempt, RentDue, CollectionChannel } from '../types.js';

export interface RetryPolicy {
  readonly attempts: ReadonlyArray<{
    readonly offsetMinutes: number;
    readonly channel: CollectionChannel;
  }>;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: [
    { offsetMinutes: 0, channel: 'mpesa-stk-push' },
    { offsetMinutes: 60 * 4, channel: 'mpesa-stk-push' },
    { offsetMinutes: 60 * 24, channel: 'mpesa-stk-push' },
    { offsetMinutes: 60 * 24 * 3, channel: 'whatsapp-payment' },
  ],
};

export function planAttempts(
  due: RentDue,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): CollectionAttempt[] {
  if (due.amount <= 0) {
    return [];
  }
  return policy.attempts.map((a, idx) => ({
    tenantId: due.tenantId,
    leaseId: due.leaseId,
    attemptNumber: idx + 1,
    channel: a.channel,
    offsetMinutes: a.offsetMinutes,
    amount: due.amount,
    reason:
      idx === 0
        ? `initial collection on due date for ${due.currency} ${due.amount}`
        : `retry ${idx + 1} after ${humanise(a.offsetMinutes)}`,
  }));
}

function humanise(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 60 * 24) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 60 / 24)}d`;
}
