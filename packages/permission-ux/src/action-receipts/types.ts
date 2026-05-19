/**
 * action-receipts — type vocabulary.
 *
 * Every AI-initiated mutation emits a Receipt entity that records what
 * changed, when, by whom, and (when rollback-enabled) a token that
 * authorises replay of the inverse operation.
 *
 * Receipts have two state transitions:
 *
 *   - `pending` -> never observed in practice (we record receipts
 *     atomically with the mutation).
 *   - `applied` -> the canonical state after a successful tool call.
 *   - `rolled-back` -> set after `executeRollback(...)` succeeds.
 *
 * Receipts for terminal-state actions (send-SMS, charge-card) carry
 * `rollbackWindowMinutes: 0` and are NOT undoable. The UI still shows
 * them — the rollback button is just disabled with a tooltip.
 */

import type { RiskTier } from '../types.js';

export type ReceiptStatus = 'applied' | 'rolled-back';

/**
 * Brief summary of the action's args, redacted as needed by the
 * caller. Stored verbatim in the receipt.
 */
export interface ReceiptArgsSummary {
  /** Human-readable single-line summary (e.g. "send SMS to 14 tenants"). */
  readonly headline: string;
  /** Structured key fields (e.g. `tenantCount: 14`, `totalKes: 42000`). */
  readonly fields: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Reference to an entity affected by the action. The substrate doesn't
 * care what's at the end of the ref — it's an opaque pointer the UI
 * resolves later.
 */
export interface AffectedEntityRef {
  readonly entityType: string;
  readonly entityId: string;
  readonly label?: string;
}

/**
 * Canonical Receipt entity. Persisted in the J1 entity-store under
 * `type: 'receipt'`. The id is also written to the sovereign-action
 * ledger row that recorded the underlying mutation, so the two can
 * be joined.
 */
export interface ReceiptEntity {
  readonly id: string;
  readonly type: 'receipt';
  readonly actionId: string;
  readonly toolName: string;
  readonly tier: RiskTier;
  readonly tenantId: string;
  readonly executedBy: string; // userId
  readonly executedAt: string; // ISO-8601
  readonly status: ReceiptStatus;
  readonly argsSummary: ReceiptArgsSummary;
  readonly affectedEntities: ReadonlyArray<AffectedEntityRef>;
  /** Citations or related references (e.g. lease URI, invoice number). */
  readonly references: ReadonlyArray<string>;
  /**
   * Set when the receipt is rollback-enabled. The token is opaque to
   * the UI but is required by `executeRollback`. If `null`, the
   * action is terminal-state and not undoable.
   */
  readonly rollbackToken: string | null;
  /**
   * Window during which `executeRollback` is honoured. `0` means
   * "never" (terminal-state). The default for soft-state is 5
   * minutes (300_000ms).
   */
  readonly rollbackWindowMinutes: number;
  /** Set after a successful rollback. */
  readonly rolledBackAt?: string;
  readonly rolledBackBy?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Ports
// ─────────────────────────────────────────────────────────────────────

export interface ReceiptStorePort {
  putReceipt(receipt: NewReceiptInput): Promise<ReceiptEntity>;
  /** Fetch by id, returns null on miss. */
  getReceipt(id: string): Promise<ReceiptEntity | null>;
  /** Mark a receipt as rolled-back. Returns the updated entity. */
  markRolledBack(
    id: string,
    rolledBackBy: string,
    rolledBackAt: string,
  ): Promise<ReceiptEntity>;
}

export interface NewReceiptInput {
  readonly actionId: string;
  readonly toolName: string;
  readonly tier: RiskTier;
  readonly tenantId: string;
  readonly executedBy: string;
  readonly argsSummary: ReceiptArgsSummary;
  readonly affectedEntities: ReadonlyArray<AffectedEntityRef>;
  readonly references: ReadonlyArray<string>;
  readonly rollbackToken: string | null;
  readonly rollbackWindowMinutes: number;
}

/**
 * Sovereign-ledger row carrying the inverse-operation payload. The
 * substrate only needs to read this; the kernel writes it when the
 * tool runs.
 */
export interface RollbackPayload {
  readonly actionId: string;
  readonly rollbackToken: string;
  readonly inverse: {
    readonly kind: string;
    readonly args: Readonly<Record<string, unknown>>;
  };
}

export interface SovereignLedgerPort {
  /** Fetch the rollback payload for an action. */
  fetchRollbackPayload(actionId: string): Promise<RollbackPayload | null>;
  /** Append a row noting the rollback. */
  appendRollbackEvent(input: RollbackLedgerEvent): Promise<void>;
}

export interface RollbackLedgerEvent {
  readonly actionId: string;
  readonly rolledBackBy: string;
  readonly rolledBackAt: string;
  readonly receiptId: string;
}

/**
 * Inverse-operation executor — the kernel's tool-executor with a
 * narrowed surface. Given the inverse kind + args, it runs the
 * compensating operation and returns success/failure.
 */
export interface InverseExecutorPort {
  execute(inverse: RollbackPayload['inverse']): Promise<InverseResult>;
}

export type InverseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };
