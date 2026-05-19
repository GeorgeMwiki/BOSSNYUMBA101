/**
 * action-receipts — public surface.
 */

export type {
  ReceiptEntity,
  ReceiptStatus,
  ReceiptArgsSummary,
  AffectedEntityRef,
  ReceiptStorePort,
  NewReceiptInput,
  RollbackPayload,
  RollbackLedgerEvent,
  SovereignLedgerPort,
  InverseExecutorPort,
  InverseResult,
} from './types.js';

export {
  emitReceipt,
  emitTerminalReceipt,
  DEFAULT_ROLLBACK_WINDOW_MIN,
  type EmitReceiptDeps,
} from './emit-receipt.js';

export {
  executeRollback,
  type ExecuteRollbackDeps,
  type ExecuteRollbackInput,
  type ExecuteRollbackResult,
} from './execute-rollback.js';

export {
  InMemoryReceiptStore,
  InMemorySovereignLedger,
  type InMemoryReceiptStoreOptions,
} from './in-memory-store.js';

export { renderReceiptCard, type RenderReceiptCardOptions } from './render.js';
export {
  ReceiptCardPartSchema,
  ReceiptCardArgsSummarySchema,
  ReceiptCardAffectedEntitySchema,
  type ReceiptCardPart,
} from './receipt-card.js';
