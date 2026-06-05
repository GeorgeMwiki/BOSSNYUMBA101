/**
 * Housing-cooperative settlement service — public surface.
 *
 * Pure settlement math + a money seam. The route handler
 * (`routes/cooperatives/cooperatives.hono.ts`) wires the SQL I/O and
 * calls these helpers; the distribute path threads the
 * `CooperativeLedgerPort` so every payout posts via LedgerService.post()
 * (CLAUDE.md hard rule) or honest-degrades when no port is wired.
 *
 * Everything here is referentially transparent and synchronous except
 * the ledger seam — which makes the settlement math trivially testable
 * without a database.
 */

import {
  round2,
  COOPERATIVE_CURRENCIES,
  type CooperativeCurrency,
  type CooperativePoolInput,
  type CooperativePoolMath,
  type MemberShareInput,
  type MemberShareLine,
  type CooperativeLedgerPort,
} from './types.js';

export {
  round2,
  COOPERATIVE_CURRENCIES,
  type CooperativeCurrency,
  type CooperativePeriodStatus,
  type CooperativePoolInput,
  type CooperativePoolMath,
  type MemberShareInput,
  type MemberShareLine,
  type CooperativeLedgerPort,
  type CooperativeLedgerPostInput,
  type CooperativeLedgerPostResult,
} from './types.js';

/** Domain error — carries a stable code the route maps to an HTTP status. */
export class CooperativeSettlementError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CooperativeSettlementError';
    this.code = code;
  }
}

/** True when `code` is a 3-letter ISO-4217 the period CHECK accepts. */
export function isSupportedCurrency(
  code: string,
): code is CooperativeCurrency {
  return (COOPERATIVE_CURRENCIES as ReadonlyArray<string>).includes(code);
}

function assertNonNegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new CooperativeSettlementError(
      'INVALID_POOL',
      `${label} must be a non-negative finite number`,
    );
  }
}

/**
 * Net a cooperative's collected pool down to its distributable amount.
 *
 *   collected         = service_charge + sinking_fund + rent_share
 *   net_distributable = max(0, collected − operating_expenses)
 *
 * Pure + deterministic. Negative inputs are rejected; the result never
 * goes below zero (a deficit period distributes nothing).
 */
export function computeNetDistributable(
  input: CooperativePoolInput,
): CooperativePoolMath {
  assertNonNegative('serviceChargeCollected', input.serviceChargeCollected);
  assertNonNegative('sinkingFundCollected', input.sinkingFundCollected);
  assertNonNegative('rentShareCollected', input.rentShareCollected);
  assertNonNegative('operatingExpenses', input.operatingExpenses);

  const collected = round2(
    input.serviceChargeCollected +
      input.sinkingFundCollected +
      input.rentShareCollected,
  );
  const netDistributable = round2(
    Math.max(0, collected - input.operatingExpenses),
  );
  return { collected, netDistributable };
}

/**
 * Split a net-distributable pool into per-member-household share lines.
 *
 * `share_pct` values must each be 0..100 and sum to ≤ 100 (a cooperative
 * may retain a remainder in reserve, but can never over-allocate). Each
 * member amount is `round2(net * pct / 100)`. Returns one line per input
 * member, preserving order.
 */
export function computeMemberShares(
  netDistributable: number,
  members: ReadonlyArray<MemberShareInput>,
): ReadonlyArray<MemberShareLine> {
  if (!Number.isFinite(netDistributable) || netDistributable < 0) {
    throw new CooperativeSettlementError(
      'INVALID_POOL',
      'netDistributable must be a non-negative finite number',
    );
  }
  if (members.length === 0) {
    throw new CooperativeSettlementError(
      'NO_MEMBERS',
      'at least one member share is required',
    );
  }

  const seen = new Set<string>();
  let totalPct = 0;
  for (const m of members) {
    if (m.sharePct < 0 || m.sharePct > 100) {
      throw new CooperativeSettlementError(
        'INVALID_SHARE',
        `share_pct ${m.sharePct} out of range [0, 100]`,
      );
    }
    if (seen.has(m.memberHouseholdPartyId)) {
      throw new CooperativeSettlementError(
        'DUPLICATE_MEMBER',
        `member ${m.memberHouseholdPartyId} appears more than once`,
      );
    }
    seen.add(m.memberHouseholdPartyId);
    totalPct += m.sharePct;
  }
  // Allow a hair of float drift; the schema CHECK is the hard backstop.
  if (totalPct > 100.0001) {
    throw new CooperativeSettlementError(
      'SHARE_OVERFLOW',
      `sum of share_pct (${round2(totalPct)}) exceeds 100`,
    );
  }

  return members.map((m) => ({
    memberHouseholdPartyId: m.memberHouseholdPartyId,
    sharePct: m.sharePct,
    amount: round2((m.sharePct / 100) * netDistributable),
  }));
}

/**
 * Money-path guard. Distribute posts through `LedgerService.post()` via
 * the port; when no port is wired we MUST refuse rather than fake a
 * payout (CLAUDE.md hard rule). Returns the port when present; throws a
 * `LEDGER_NOT_WIRED` error the route maps to 501 otherwise.
 */
export function assertLedgerWired(
  port: CooperativeLedgerPort | null | undefined,
): CooperativeLedgerPort {
  if (!port) {
    throw new CooperativeSettlementError(
      'LEDGER_NOT_WIRED',
      'cooperative distribution requires a LedgerService.post() port; ' +
        'refusing to mark distributions paid without a real ledger movement',
    );
  }
  return port;
}
