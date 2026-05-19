/**
 * emitReceipt — called by the kernel after every mutation tool call.
 *
 * Atomic-from-the-substrate's-perspective: persists the Receipt
 * entity via the store port. Wiring guarantees this fires AFTER the
 * tool's mutation has been written (so a crash between mutation and
 * receipt loses no business data — only the user-visible card).
 *
 * `rollbackWindowMinutes` defaults to 5 (soft-state) but can be set
 * to 0 by the caller for terminal-state actions (send-SMS, charge,
 * tribunal-notice).
 */

import type {
  NewReceiptInput,
  ReceiptEntity,
  ReceiptStorePort,
} from './types.js';

export const DEFAULT_ROLLBACK_WINDOW_MIN = 5;

export interface EmitReceiptDeps {
  readonly store: ReceiptStorePort;
}

export async function emitReceipt(
  input: NewReceiptInput,
  deps: EmitReceiptDeps,
): Promise<ReceiptEntity> {
  if (input.rollbackWindowMinutes < 0) {
    throw new Error('emitReceipt: rollbackWindowMinutes must be >= 0');
  }
  // Defensive: terminal-state actions must not carry a rollback token.
  if (input.rollbackWindowMinutes === 0 && input.rollbackToken !== null) {
    throw new Error(
      'emitReceipt: terminal-state action (rollbackWindowMinutes=0) must have rollbackToken=null',
    );
  }
  // Rollback-enabled actions must carry a token.
  if (input.rollbackWindowMinutes > 0 && input.rollbackToken === null) {
    throw new Error(
      `emitReceipt: rollback-enabled action (window=${input.rollbackWindowMinutes}) must have a rollbackToken`,
    );
  }
  return deps.store.putReceipt(input);
}

/**
 * Convenience for the terminal-state case — the caller doesn't have
 * to remember to pass `rollbackWindowMinutes: 0` explicitly.
 */
export async function emitTerminalReceipt(
  input: Omit<NewReceiptInput, 'rollbackToken' | 'rollbackWindowMinutes'>,
  deps: EmitReceiptDeps,
): Promise<ReceiptEntity> {
  return emitReceipt(
    { ...input, rollbackToken: null, rollbackWindowMinutes: 0 },
    deps,
  );
}
