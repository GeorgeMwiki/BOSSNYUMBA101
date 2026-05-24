/**
 * Climate Impact X mock feed tests — determinism, schema, clean iterators.
 */

import { describe, expect, it } from 'vitest';
import { createMockCixFeed, CIX_PUBLIC_SITE_URL } from '../cix/client.js';

describe('createMockCixFeed — spot stream', () => {
  it('exposes the documented public site URL constant', () => {
    expect(CIX_PUBLIC_SITE_URL).toBe('https://www.climateimpactx.com');
  });

  it('yields the requested number of ticks', async () => {
    const feed = createMockCixFeed({ tickCount: 4 });
    const ticks = [];
    for await (const t of feed.streamSpotPrices()) {
      ticks.push(t);
    }
    expect(ticks).toHaveLength(4);
  });

  it('is deterministic given the same seed', async () => {
    const a: number[] = [];
    const b: number[] = [];
    for await (const t of createMockCixFeed({ seed: 42, tickCount: 3 }).streamSpotPrices()) a.push(t.bid);
    for await (const t of createMockCixFeed({ seed: 42, tickCount: 3 }).streamSpotPrices()) b.push(t.bid);
    expect(a).toEqual(b);
  });

  it('differs across distinct seeds', async () => {
    const a: number[] = [];
    const b: number[] = [];
    for await (const t of createMockCixFeed({ seed: 1, tickCount: 5 }).streamSpotPrices()) a.push(t.bid);
    for await (const t of createMockCixFeed({ seed: 2, tickCount: 5 }).streamSpotPrices()) b.push(t.bid);
    expect(a).not.toEqual(b);
  });

  it('always has bid < ask (spread is positive)', async () => {
    const feed = createMockCixFeed({ tickCount: 8 });
    for await (const t of feed.streamSpotPrices()) {
      expect(t.bid).toBeLessThan(t.ask);
    }
  });

  it('cycles through the configured symbol list', async () => {
    const feed = createMockCixFeed({
      tickCount: 6,
      symbols: ['SYM-A', 'SYM-B'],
    });
    const seen = new Set<string>();
    for await (const t of feed.streamSpotPrices()) {
      seen.add(t.symbol);
    }
    expect(seen).toEqual(new Set(['SYM-A', 'SYM-B']));
  });

  it('breaking out of the loop cleanly stops the stream', async () => {
    const feed = createMockCixFeed({ tickCount: 100 });
    let count = 0;
    for await (const _ of feed.streamSpotPrices()) {
      count++;
      if (count >= 2) break;
    }
    expect(count).toBe(2);
  });

  it('emits monotonic ISO timestamps', async () => {
    const feed = createMockCixFeed({ tickCount: 5 });
    let prevMs = -Infinity;
    for await (const t of feed.streamSpotPrices()) {
      const ms = new Date(t.ts).getTime();
      expect(ms).toBeGreaterThan(prevMs);
      prevMs = ms;
    }
  });
});

describe('createMockCixFeed — forward curve', () => {
  it('returns six tenors with strictly-increasing prices (contango)', async () => {
    const feed = createMockCixFeed();
    const curve = await feed.getForwardCurve('CIX-NBS-2024');
    expect(curve).toHaveLength(6);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.price).toBeGreaterThan(curve[i - 1]!.price);
    }
  });

  it('different symbols imply different price levels', async () => {
    const feed = createMockCixFeed();
    const nbs = await feed.getForwardCurve('CIX-NBS-2024');
    const ccs = await feed.getForwardCurve('CIX-CCS-2025');
    expect(ccs[0]!.price).toBeGreaterThan(nbs[0]!.price * 10);
  });
});

describe('createMockCixFeed — requestQuote', () => {
  it('rejects qty ≤ 0', async () => {
    const feed = createMockCixFeed();
    await expect(feed.requestQuote({ projectId: 'X', vintage: 2024, qty: 0 })).rejects.toThrow(/qty/);
    await expect(feed.requestQuote({ projectId: 'X', vintage: 2024, qty: -1 })).rejects.toThrow(/qty/);
  });

  it('larger orders earn a volume discount', async () => {
    const feed = createMockCixFeed();
    const small = await feed.requestQuote({ projectId: '1234', vintage: 2024, qty: 100 });
    const big = await feed.requestQuote({ projectId: '1234', vintage: 2024, qty: 10_000 });
    expect(big.priceUsdPerTonne).toBeLessThanOrEqual(small.priceUsdPerTonne);
  });

  it('older vintages trade at a discount', async () => {
    const feed = createMockCixFeed();
    const newer = await feed.requestQuote({ projectId: '1234', vintage: 2026, qty: 100 });
    const older = await feed.requestQuote({ projectId: '1234', vintage: 2020, qty: 100 });
    expect(older.priceUsdPerTonne).toBeLessThan(newer.priceUsdPerTonne);
  });

  it('quote validUntil is in the future relative to mock clock', async () => {
    const now = new Date('2026-05-24T12:00:00Z');
    const feed = createMockCixFeed({ now: () => now });
    const q = await feed.requestQuote({ projectId: '1234', vintage: 2024, qty: 100 });
    expect(new Date(q.validUntil).getTime()).toBeGreaterThan(now.getTime());
  });
});
