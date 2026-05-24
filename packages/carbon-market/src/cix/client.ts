/**
 * Climate Impact X (CIX) spot / forward feed client.
 *
 * CIX is Singapore's voluntary-carbon exchange — https://www.climateimpactx.com
 * As of 2026-05 they have not published a stable, machine-readable public
 * market-data API. We model the *contract* the trading desk needs today
 * and ship a deterministic `MockCixFeed` implementation; a production
 * adapter can be added once CIX publishes their feed and slot in
 * behind the same `CixFeed` interface.
 *
 * The mock is pseudo-random but deterministic when seeded so consumer
 * tests are stable.
 */

import type {
  ForwardPoint,
  Quote,
  QuoteRequest,
  SpotPrice,
} from '../types.js';

/** Currently published CIX market URL — keep here so we have one place to swap when the live API ships. */
export const CIX_PUBLIC_SITE_URL = 'https://www.climateimpactx.com';

export interface CixFeed {
  /**
   * Stream of mid-market spot updates. Caller breaks the loop with
   * `for await ... of` and `break`. Closing the iterable releases any
   * internal timers.
   */
  streamSpotPrices(): AsyncIterable<SpotPrice>;
  getForwardCurve(symbol: string): Promise<ReadonlyArray<ForwardPoint>>;
  requestQuote(req: QuoteRequest): Promise<Quote>;
}

export interface MockCixFeedOptions {
  /** Seed for the deterministic pseudo-random walk. */
  readonly seed?: number;
  /** Number of spot ticks to emit before closing the stream. */
  readonly tickCount?: number;
  /** Symbols to rotate through on the spot stream. */
  readonly symbols?: ReadonlyArray<string>;
  /** Override the wall clock for stable test timestamps. */
  readonly now?: () => Date;
}

const DEFAULT_SYMBOLS: ReadonlyArray<string> = [
  'CIX-NBS-2024',     // Nature-based, vintage 2024
  'CIX-REN-2024',     // Renewables, vintage 2024
  'CIX-CCS-2025',     // Tech-based removals (DAC/biochar)
];

const DEFAULT_FORWARD_TENORS: ReadonlyArray<string> = [
  'M+1', 'M+3', 'M+6', 'Dec-26', 'Dec-27', 'Dec-30',
];

/**
 * Deterministic mock implementation of `CixFeed`. Stable for tests:
 * same seed -> same byte-for-byte output.
 */
export function createMockCixFeed(options: MockCixFeedOptions = {}): CixFeed {
  const seed = options.seed ?? 1;
  const tickCount = options.tickCount ?? 5;
  const symbols = options.symbols ?? DEFAULT_SYMBOLS;
  const now = options.now ?? (() => new Date('2026-05-24T12:00:00Z'));

  return {
    streamSpotPrices() {
      return spotStream(symbols, tickCount, seed, now);
    },
    async getForwardCurve(symbol) {
      const base = baseSpotFor(symbol);
      return DEFAULT_FORWARD_TENORS.map((tenor, idx) => ({
        tenor,
        price: round2(base * (1 + 0.015 * (idx + 1))),
      }));
    },
    async requestQuote(req) {
      if (!Number.isFinite(req.qty) || req.qty <= 0) {
        throw new RangeError('cix: quote qty must be > 0');
      }
      const base = baseSpotForProject(req.projectId, req.vintage);
      // Volume discount: 1bp per tonne up to 100bps (1%).
      const discountBp = Math.min(100, Math.floor(req.qty / 100));
      const priceUsdPerTonne = round2(base * (1 - discountBp / 10_000));
      const ts = now();
      const validUntil = new Date(ts.getTime() + 5 * 60_000).toISOString();
      return {
        projectId: req.projectId,
        vintage: req.vintage,
        qty: req.qty,
        priceUsdPerTonne,
        validUntil,
        counterparty: 'CIX-DEALER-01',
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Internals — deterministic PRNG and stream helpers
// ─────────────────────────────────────────────────────────────────────

async function* spotStream(
  symbols: ReadonlyArray<string>,
  tickCount: number,
  seed: number,
  now: () => Date,
): AsyncGenerator<SpotPrice, void, void> {
  const rng = makeRng(seed);
  const t0 = now().getTime();
  for (let i = 0; i < tickCount; i++) {
    const symbol = symbols[i % symbols.length] ?? symbols[0]!;
    const mid = baseSpotFor(symbol) * (1 + (rng() - 0.5) * 0.02);
    const halfSpread = mid * 0.0025;                       // 25 bps spread
    yield {
      symbol,
      bid: round2(mid - halfSpread),
      ask: round2(mid + halfSpread),
      ts: new Date(t0 + i * 1_000).toISOString(),
    };
  }
}

/** Mulberry32 PRNG — deterministic, fast, plenty good for fixtures. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function baseSpotFor(symbol: string): number {
  // Map a symbol to a plausible mid-2026 USD/tCO2e price.
  if (symbol.includes('NBS')) return 6.5;
  if (symbol.includes('REN')) return 3.2;
  if (symbol.includes('CCS')) return 180.0;
  if (symbol.includes('EUA')) return 84.0;
  return 8.0;
}

function baseSpotForProject(projectId: string, vintage: number): number {
  // Older vintages trade at a discount; project-id hash adds dispersion.
  const idHash = [...projectId].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const base = 6.5 + (idHash % 7);
  const vintageHaircut = Math.max(0, 2026 - vintage) * 0.15;
  return Math.max(0.5, base - vintageHaircut);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
