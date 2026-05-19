/**
 * Clock port — abstract time source for deterministic tests.
 */

export interface Clock {
  now(): Date;
  /** Monotonic millis for measuring latencies. */
  monotonicMs(): number;
}

export const systemClock: Clock = Object.freeze({
  now(): Date {
    return new Date();
  },
  monotonicMs(): number {
    return performance.now();
  },
});

/** Test helper — frozen clock starting at a fixed instant. */
export function fixedClock(start: Date): Clock {
  const startMs = start.getTime();
  let elapsed = 0;
  return {
    now(): Date {
      return new Date(startMs + elapsed);
    },
    monotonicMs(): number {
      return elapsed;
    },
  };
}

/** Test helper — clock that auto-advances by `stepMs` on each `monotonicMs` call. */
export function tickingClock(startMs: number, stepMs: number): Clock {
  let current = startMs;
  return {
    now(): Date {
      const out = new Date(current);
      current += stepMs;
      return out;
    },
    monotonicMs(): number {
      const out = current;
      current += stepMs;
      return out;
    },
  };
}
