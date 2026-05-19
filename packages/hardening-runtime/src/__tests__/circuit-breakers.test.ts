/**
 * Circuit-breaker tests — 6 runaway scenarios + tripped-event verification.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_CIRCUIT_BREAKER_CAPS,
  mergeCaps,
  withCircuitBreaker,
  type StepResult,
} from '../circuit-breakers/index.js';
import type { CircuitBreakerTrippedEvent } from '../types.js';

describe('DEFAULT_CIRCUIT_BREAKER_CAPS', () => {
  it('matches L3 #3 defaults: 30 steps · $5 · 120s · 100 tools', () => {
    expect(DEFAULT_CIRCUIT_BREAKER_CAPS.maxSteps).toBe(30);
    expect(DEFAULT_CIRCUIT_BREAKER_CAPS.maxCostUsdCents).toBe(500);
    expect(DEFAULT_CIRCUIT_BREAKER_CAPS.maxWallTimeMs).toBe(120_000);
    expect(DEFAULT_CIRCUIT_BREAKER_CAPS.maxToolCalls).toBe(100);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_CIRCUIT_BREAKER_CAPS)).toBe(true);
  });
});

describe('mergeCaps', () => {
  it('returns defaults when override is undefined', () => {
    expect(mergeCaps()).toEqual(DEFAULT_CIRCUIT_BREAKER_CAPS);
  });

  it('overrides only the specified fields', () => {
    const merged = mergeCaps({ maxSteps: 5 });
    expect(merged.maxSteps).toBe(5);
    expect(merged.maxCostUsdCents).toBe(500);
    expect(merged.maxToolCalls).toBe(100);
  });

  it('returns a frozen object', () => {
    const merged = mergeCaps({ maxCostUsdCents: 100 });
    expect(Object.isFrozen(merged)).toBe(true);
  });
});

describe('withCircuitBreaker — clean completion', () => {
  it('returns ok on a step that finishes in one iteration', async () => {
    const result = await withCircuitBreaker<string>(
      async () => ({ done: true, value: 'finished', costDeltaUsdCents: 10 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('finished');
      expect(result.counters.steps).toBe(1);
      expect(result.counters.costUsdCents).toBe(10);
    }
  });

  it('runs a multi-step loop to completion', async () => {
    let i = 0;
    const result = await withCircuitBreaker<number>(async () => {
      i += 1;
      if (i >= 5) {
        return { done: true, value: i, costDeltaUsdCents: 5 };
      }
      return { done: false, costDeltaUsdCents: 5 };
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(5);
      expect(result.counters.steps).toBe(5);
      expect(result.counters.costUsdCents).toBe(25);
    }
  });
});

describe('withCircuitBreaker — runaway scenarios (6)', () => {
  it('1) trips on max-steps with a never-done step driver', async () => {
    const result = await withCircuitBreaker<void>(
      async () => ({ done: false }),
      { caps: { maxSteps: 3 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.trippedCap).toBe('max-steps');
      expect(result.counters.steps).toBeGreaterThan(3);
    }
  });

  it('2) trips on max-cost when cost-delta accumulates past cap', async () => {
    const result = await withCircuitBreaker<void>(
      async () => ({ done: false, costDeltaUsdCents: 200 }),
      { caps: { maxCostUsdCents: 500 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.trippedCap).toBe('max-cost');
    }
  });

  it('3) trips on max-tool-calls', async () => {
    const result = await withCircuitBreaker<void>(
      async () => ({ done: false, toolCallsDelta: 50 }),
      { caps: { maxToolCalls: 100 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.trippedCap).toBe('max-tool-calls');
    }
  });

  it('4) trips on max-wall-time', async () => {
    let nowVal = 1000;
    const fakeNow = (): number => {
      const t = nowVal;
      nowVal += 100; // each clock read advances time
      return t;
    };
    const result = await withCircuitBreaker<void>(
      async () => ({ done: false }),
      { caps: { maxWallTimeMs: 500, maxSteps: 10000 }, now: fakeNow },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.trippedCap).toBe('max-wall-time');
    }
  });

  it('5) trips on last-step cost overage (post-step check)', async () => {
    let i = 0;
    const result = await withCircuitBreaker<string>(
      async () => {
        i += 1;
        if (i === 3) {
          // This step pushes us over the cost cap.
          return { done: true, value: 'finished', costDeltaUsdCents: 600 };
        }
        return { done: false, costDeltaUsdCents: 1 };
      },
      { caps: { maxCostUsdCents: 500 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.trippedCap).toBe('max-cost');
    }
  });

  it('6) safety-max protects against a buggy never-returning step driver', async () => {
    // Pathological: never returns done AND step driver doesn't increment.
    // Should trip on max-steps via the safety iteration cap.
    const result = await withCircuitBreaker<void>(
      async () => ({ done: false }),
      { caps: { maxSteps: 2 } },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.trippedCap).toBe('max-steps');
    }
  });
});

describe('withCircuitBreaker — tripped event', () => {
  it('emits onTripped with full event payload', async () => {
    const events: CircuitBreakerTrippedEvent[] = [];
    await withCircuitBreaker<void>(
      async () => ({ done: false, costDeltaUsdCents: 1000 }),
      {
        caps: { maxCostUsdCents: 500 },
        tenantId: 'tenant-1',
        subMd: 'arrears-triage',
        onTripped: (e) => events.push(e),
      },
    );
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e).toBeDefined();
    if (e) {
      expect(e.type).toBe('circuit-breaker-tripped');
      expect(e.trippedCap).toBe('max-cost');
      expect(e.tenantId).toBe('tenant-1');
      expect(e.subMd).toBe('arrears-triage');
      expect(e.severity).toBe('high');
      expect(e.counters.costUsdCents).toBeGreaterThan(0);
      expect(Object.isFrozen(e)).toBe(true);
    }
  });

  it('does NOT emit on clean completion', async () => {
    const handler = vi.fn();
    await withCircuitBreaker<string>(
      async () => ({ done: true, value: 'ok' }),
      { onTripped: handler },
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('swallows errors thrown by onTripped handler', async () => {
    // Even if the telemetry handler throws, the circuit-breaker must
    // still return a result (never throw).
    const result = await withCircuitBreaker<void>(
      async () => ({ done: false, costDeltaUsdCents: 1000 }),
      {
        caps: { maxCostUsdCents: 100 },
        onTripped: () => {
          throw new Error('telemetry exploded');
        },
      },
    );
    expect(result.ok).toBe(false);
  });
});
