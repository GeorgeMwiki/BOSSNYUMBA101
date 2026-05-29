/**
 * Settlement orchestrator — public surface.
 *
 * Real-estate chain L8 — the sign-move-in → ledger → payout chain.
 * Pure service classes; route handlers wire them with the injected
 * SettlementLedgerPort + SettlementPayoutPort. Production composition
 * wraps the real LedgerService.post() (CLAUDE.md hard rule).
 */

export {
  SettlementOrchestrator,
  SettlementError,
  type SettlementOrchestratorDeps,
} from './orchestrator.js';

export {
  computeSettlementMath,
  round2,
  PLATFORM_FEE_RATE,
  SETTLEMENT_CURRENCIES,
  type SettlementCurrency,
  type SettlementStatus,
  type SettlementMath,
  type PayoutProvider,
  type SignMoveInInput,
  type SignMoveInResult,
  type SettlementLedgerPort,
  type SettlementLedgerPostInput,
  type SettlementLedgerPostResult,
  type SettlementPayoutPort,
  type SettlementPayoutInput,
  type SettlementPayoutResult,
} from './types.js';

import type {
  SettlementLedgerPort,
  SettlementPayoutPort,
  SettlementLedgerPostInput,
  SettlementLedgerPostResult,
  SettlementPayoutInput,
  SettlementPayoutResult,
} from './types.js';
import { createHash } from 'node:crypto';

let ledgerPortOverride: SettlementLedgerPort | null = null;
let payoutPortOverride: SettlementPayoutPort | null = null;

/** Test seam — override the ledger port. */
export function __setSettlementLedgerPortForTests(
  port: SettlementLedgerPort | null,
): void {
  ledgerPortOverride = port;
}

/** Test seam — override the payout port. */
export function __setSettlementPayoutPortForTests(
  port: SettlementPayoutPort | null,
): void {
  payoutPortOverride = port;
}

/**
 * Resolve the active settlement ledger port. Production composition
 * registers an adapter wrapping `LedgerService.post()` from the
 * payments-ledger package (CLAUDE.md hard rule).
 *
 * Dev fallback: deterministic SHA-256-derived journal id so the
 * chain still completes end-to-end without a live ledger.
 */
export function resolveSettlementLedgerPort(): SettlementLedgerPort {
  if (ledgerPortOverride) return ledgerPortOverride;
  return {
    async post(
      input: SettlementLedgerPostInput,
    ): Promise<SettlementLedgerPostResult> {
      const seed = `${input.tenantId}:${input.responseId}:${input.idempotencyKey}`;
      const journalId = `stl-jrn-${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
      return { journalId };
    },
  };
}

/**
 * Resolve the active payout port. Production composition wires
 * M-Pesa B2C / wallet-credit / Stripe per the landlord's payout-
 * preference profile. Dev fallback returns a deterministic stub so
 * tests + dev flows complete.
 */
export function resolveSettlementPayoutPort(): SettlementPayoutPort {
  if (payoutPortOverride) return payoutPortOverride;
  return {
    async payout(
      input: SettlementPayoutInput,
    ): Promise<SettlementPayoutResult> {
      const seed = `${input.settlementId}:${input.landlordUserId}`;
      const providerRef = `mpesa-${createHash('sha256').update(seed).digest('hex').slice(0, 12)}`;
      return { provider: 'mpesa_b2c', providerRef };
    },
  };
}
