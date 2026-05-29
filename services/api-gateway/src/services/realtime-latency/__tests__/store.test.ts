/**
 * Realtime latency store — smoke + tenant isolation tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  recordLatency,
  getStats,
  __resetLatencyStoreForTests,
} from '../store.js';

describe('realtime-latency/store', () => {
  beforeEach(() => {
    __resetLatencyStoreForTests();
  });

  afterEach(() => {
    __resetLatencyStoreForTests();
  });

  it('returns empty stats for an unknown tenant', () => {
    const s = getStats('tenant-a');
    expect(s.count).toBe(0);
    expect(s.p50).toBe(0);
  });

  it('records a single sample and reports it via stats', () => {
    recordLatency('tenant-a', 120);
    const s = getStats('tenant-a');
    expect(s.count).toBe(1);
    expect(s.min).toBe(120);
    expect(s.max).toBe(120);
    expect(s.avg).toBe(120);
  });

  it('does not leak samples between tenants', () => {
    recordLatency('tenant-a', 100);
    recordLatency('tenant-a', 200);
    recordLatency('tenant-b', 999);

    expect(getStats('tenant-a').count).toBe(2);
    expect(getStats('tenant-b').count).toBe(1);
    expect(getStats('tenant-b').max).toBe(999);
    expect(getStats('tenant-a').max).toBe(200);
  });

  it('rejects out-of-range latency values', () => {
    recordLatency('tenant-a', -5);
    recordLatency('tenant-a', 60_001);
    recordLatency('tenant-a', NaN);
    recordLatency('tenant-a', 50);
    const s = getStats('tenant-a');
    expect(s.count).toBe(1);
    expect(s.min).toBe(50);
  });

  it('computes percentiles in order', () => {
    for (let i = 1; i <= 100; i++) recordLatency('tenant-a', i);
    const s = getStats('tenant-a');
    expect(s.count).toBe(100);
    expect(s.p50).toBeGreaterThanOrEqual(50);
    expect(s.p95).toBeGreaterThanOrEqual(95);
    expect(s.p99).toBeGreaterThanOrEqual(99);
  });
});
