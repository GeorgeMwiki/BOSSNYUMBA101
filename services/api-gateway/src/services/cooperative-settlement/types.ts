/**
 * Housing-cooperative settlement — service types + settlement math.
 *
 * A housing cooperative aggregates a property's collected pool over a
 * period — service-charge + sinking-fund + rent-share — nets out
 * operating expenses, and distributes the remaining net-distributable
 * pool to its member households / owners by share.
 *
 * Settlement math (currency-neutral — CLAUDE.md hard rule "never
 * hard-code KES / TZS / UGX / NGN"):
 *
 *   collected         = service_charge + sinking_fund + rent_share
 *   net_distributable = max(0, collected − operating_expenses)
 *   member_amount     = round2(net_distributable * share_pct / 100)
 *
 * Money path (CLAUDE.md hard rule): the distribute step posts through
 * `LedgerService.post()` via the `CooperativeLedgerPort` seam — NEVER a
 * direct ledger write. Production composition wraps the real
 * LedgerService.post(); when no port is wired the route honest-degrades
 * (returns a 501-style "ledger not wired" outcome) rather than faking a
 * money movement.
 *
 * Ported from Borjie's mining cooperative-settlement service and
 * retargeted mining → real estate.
 */

/** Settlement-period lifecycle (mirrors the schema CHECK + enum). */
export type CooperativePeriodStatus =
  | 'draft'
  | 'calculated'
  | 'approved'
  | 'distributed'
  | 'contested';

/** Currencies the period CHECK accepts (3-letter ISO-4217). */
export const COOPERATIVE_CURRENCIES = [
  'TZS',
  'USD',
  'KES',
  'UGX',
  'NGN',
  'EUR',
  'ZAR',
  'GBP',
  'AUD',
] as const;
export type CooperativeCurrency = (typeof COOPERATIVE_CURRENCIES)[number];

/** Round to two decimals — amounts are numeric(18,2). Half-up. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The collected-pool inputs that net down to a distributable amount. */
export interface CooperativePoolInput {
  readonly serviceChargeCollected: number;
  readonly sinkingFundCollected: number;
  readonly rentShareCollected: number;
  readonly operatingExpenses: number;
}

export interface CooperativePoolMath {
  readonly collected: number;
  readonly netDistributable: number;
}

/** One member-household share line within a period. */
export interface MemberShareInput {
  readonly memberHouseholdPartyId: string;
  /** Percentage of the net-distributable pool (0..100). */
  readonly sharePct: number;
}

export interface MemberShareLine {
  readonly memberHouseholdPartyId: string;
  readonly sharePct: number;
  readonly amount: number;
}

// ── Ledger seam (money path) ──────────────────────────────────────────

export interface CooperativeLedgerPostInput {
  readonly tenantId: string;
  readonly periodId: string;
  readonly memberHouseholdPartyId: string;
  readonly amount: number;
  readonly currencyCode: string;
  /** Idempotency key — one stable handle per distribution row. */
  readonly idempotencyKey: string;
}

export interface CooperativeLedgerPostResult {
  /** Post-ledger handle (journal id) from LedgerService.post(). */
  readonly paymentRef: string;
}

/**
 * Money seam. The route's distribute handler calls this per member
 * distribution. Production composition wraps the real
 * `LedgerService.post()`. Absence ⇒ honest-degrade (the route refuses to
 * fake a payout) — see `assertLedgerWired`.
 */
export interface CooperativeLedgerPort {
  post(
    input: CooperativeLedgerPostInput,
  ): Promise<CooperativeLedgerPostResult>;
}
