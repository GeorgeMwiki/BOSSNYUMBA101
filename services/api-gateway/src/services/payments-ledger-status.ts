/**
 * Mapping helpers between the payments-ledger engine's intent lifecycle and
 * the gateway's local `payment_status` DB enum + the client-facing status
 * contract. Kept separate from the HTTP client so the pure mapping logic is
 * trivially unit-testable.
 */
import type { CreateIntentResponse } from './payments-ledger-client';

/** Engine status string (uppercase). */
export type LedgerStatus = CreateIntentResponse['status'];

/**
 * Gateway DB `payment_status` enum values
 * (packages/database/src/schemas/payment.schema.ts).
 */
export type GatewayPaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

/**
 * Project the engine's intent status onto the gateway's persisted DB enum.
 * SUCCEEDED -> 'completed', REQUIRES_ACTION -> 'processing' (the customer is
 * still acting on the STK prompt). Unknown values fail closed to 'pending'.
 */
export function ledgerStatusToDb(status: LedgerStatus): GatewayPaymentStatus {
  switch (status) {
    case 'SUCCEEDED':
      return 'completed';
    case 'PROCESSING':
    case 'REQUIRES_ACTION':
      return 'processing';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    case 'REFUNDED':
      return 'refunded';
    case 'PARTIALLY_REFUNDED':
      return 'partially_refunded';
    case 'PENDING':
    default:
      return 'pending';
  }
}
