/**
 * executeRollback — undo button handler.
 *
 * Flow:
 *
 *   1. Fetch the Receipt by id.
 *   2. Verify the receipt is `applied` (not already rolled-back).
 *   3. Verify the supplied `rollbackToken` matches.
 *   4. Verify the rollback window hasn't expired.
 *   5. Fetch the `RollbackPayload` from the sovereign ledger.
 *   6. Replay the inverse via `InverseExecutorPort`.
 *   7. On success: mark the receipt rolled-back + append a rollback
 *      event to the ledger.
 *
 * Returns a discriminated result describing what happened.
 */

import type {
  InverseExecutorPort,
  InverseResult,
  ReceiptEntity,
  ReceiptStorePort,
  SovereignLedgerPort,
} from './types.js';

export interface ExecuteRollbackDeps {
  readonly receipts: ReceiptStorePort;
  readonly ledger: SovereignLedgerPort;
  readonly inverseExecutor: InverseExecutorPort;
  readonly now?: () => Date;
}

export interface ExecuteRollbackInput {
  readonly actionId: string;
  readonly receiptId: string;
  readonly rollbackToken: string;
  readonly rolledBackBy: string; // userId
}

export type ExecuteRollbackResult =
  | {
      readonly kind: 'ok';
      readonly receipt: ReceiptEntity;
    }
  | {
      readonly kind: 'receipt-not-found';
    }
  | {
      readonly kind: 'receipt-action-mismatch';
      readonly receipt: ReceiptEntity;
    }
  | {
      readonly kind: 'already-rolled-back';
      readonly receipt: ReceiptEntity;
    }
  | {
      readonly kind: 'token-mismatch';
      readonly receipt: ReceiptEntity;
    }
  | {
      readonly kind: 'window-expired';
      readonly receipt: ReceiptEntity;
    }
  | {
      readonly kind: 'terminal-state';
      readonly receipt: ReceiptEntity;
    }
  | {
      readonly kind: 'payload-missing';
      readonly receipt: ReceiptEntity;
    }
  | {
      readonly kind: 'inverse-failed';
      readonly receipt: ReceiptEntity;
      readonly reason: string;
    };

export async function executeRollback(
  input: ExecuteRollbackInput,
  deps: ExecuteRollbackDeps,
): Promise<ExecuteRollbackResult> {
  const now = (deps.now ?? (() => new Date()))();

  const receipt = await deps.receipts.getReceipt(input.receiptId);
  if (!receipt) return { kind: 'receipt-not-found' };

  if (receipt.actionId !== input.actionId) {
    return { kind: 'receipt-action-mismatch', receipt };
  }
  if (receipt.status === 'rolled-back') {
    return { kind: 'already-rolled-back', receipt };
  }
  if (receipt.rollbackWindowMinutes === 0 || receipt.rollbackToken === null) {
    return { kind: 'terminal-state', receipt };
  }
  if (receipt.rollbackToken !== input.rollbackToken) {
    return { kind: 'token-mismatch', receipt };
  }

  const windowMs = receipt.rollbackWindowMinutes * 60_000;
  const executedAtMs = Date.parse(receipt.executedAt);
  if (Number.isNaN(executedAtMs)) {
    // Should be unreachable — emitReceipt writes ISO-8601 — but treat
    // as expired rather than throwing.
    return { kind: 'window-expired', receipt };
  }
  if (now.getTime() - executedAtMs > windowMs) {
    return { kind: 'window-expired', receipt };
  }

  const payload = await deps.ledger.fetchRollbackPayload(receipt.actionId);
  if (!payload) {
    return { kind: 'payload-missing', receipt };
  }
  if (payload.rollbackToken !== input.rollbackToken) {
    return { kind: 'token-mismatch', receipt };
  }

  const inverseRes: InverseResult = await deps.inverseExecutor.execute(payload.inverse);
  if (!inverseRes.ok) {
    return { kind: 'inverse-failed', receipt, reason: inverseRes.reason };
  }

  const updated = await deps.receipts.markRolledBack(
    receipt.id,
    input.rolledBackBy,
    now.toISOString(),
  );
  await deps.ledger.appendRollbackEvent({
    actionId: receipt.actionId,
    rolledBackBy: input.rolledBackBy,
    rolledBackAt: now.toISOString(),
    receiptId: receipt.id,
  });

  return { kind: 'ok', receipt: updated };
}
