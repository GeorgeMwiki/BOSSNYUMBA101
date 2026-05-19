/**
 * classifyAction — 20 scenario fixtures plus cache + auto-allow tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { classifyAction, verdictToAction } from '../classifier.js';
import { InMemoryVerdictCache } from '../in-memory-cache.js';
import {
  ALL_FIXTURES,
  SAFE_FIXTURES,
  BORDERLINE_FIXTURES,
  UNSAFE_FIXTURES,
} from './fixtures.js';
import type {
  ClassifierInput,
  ClassifierPort,
  ClassifierVerdict,
} from '../types.js';

function mkPort(verdicts: Map<string, ClassifierVerdict>): ClassifierPort {
  return {
    async classify(input: ClassifierInput): Promise<ClassifierVerdict> {
      const v = verdicts.get(input.toolName);
      if (!v) throw new Error(`no fixture for ${input.toolName}`);
      return v;
    },
  };
}

describe('classifyAction — 20 fixtures', () => {
  for (const fixture of ALL_FIXTURES) {
    it(`returns ${fixture.expected.verdict} for: ${fixture.name}`, async () => {
      const verdicts = new Map<string, ClassifierVerdict>();
      verdicts.set(fixture.input.toolName, fixture.expected);

      const port = mkPort(verdicts);
      const cache = new InMemoryVerdictCache();
      const result = await classifyAction(fixture.input, {
        port,
        cache,
      });

      // Short-circuit for read-tier overrides the port output. The
      // safe fixture set deliberately includes a mix of tiers — we
      // still expect 'safe' for the read-only ones (via short-circuit),
      // and the port's verdict otherwise.
      if (fixture.input.tier === 'read') {
        expect(result.verdict).toBe('safe');
      } else {
        expect(result.verdict).toBe(fixture.expected.verdict);
      }
    });
  }

  it('all 10 SAFE fixtures resolve to verdict=safe', async () => {
    const verdicts = new Map<string, ClassifierVerdict>(
      SAFE_FIXTURES.map((f) => [f.input.toolName, f.expected]),
    );
    const port = mkPort(verdicts);
    const cache = new InMemoryVerdictCache();
    for (const f of SAFE_FIXTURES) {
      const r = await classifyAction(f.input, { port, cache });
      expect(r.verdict).toBe('safe');
    }
  });

  it('all 5 BORDERLINE fixtures resolve to verdict=borderline', async () => {
    const verdicts = new Map<string, ClassifierVerdict>(
      BORDERLINE_FIXTURES.map((f) => [f.input.toolName, f.expected]),
    );
    const port = mkPort(verdicts);
    const cache = new InMemoryVerdictCache();
    for (const f of BORDERLINE_FIXTURES) {
      const r = await classifyAction(f.input, { port, cache });
      expect(r.verdict).toBe('borderline');
    }
  });

  it('all 5 UNSAFE fixtures resolve to verdict=unsafe', async () => {
    const verdicts = new Map<string, ClassifierVerdict>(
      UNSAFE_FIXTURES.map((f) => [f.input.toolName, f.expected]),
    );
    const port = mkPort(verdicts);
    const cache = new InMemoryVerdictCache();
    for (const f of UNSAFE_FIXTURES) {
      const r = await classifyAction(f.input, { port, cache });
      expect(r.verdict).toBe('unsafe');
    }
  });
});

describe('classifyAction — caching', () => {
  it('caches non-unsafe verdicts and reuses them on the second call', async () => {
    const fixture = BORDERLINE_FIXTURES[0]!;
    const verdicts = new Map<string, ClassifierVerdict>([
      [fixture.input.toolName, fixture.expected],
    ]);
    const port = mkPort(verdicts);
    const classifySpy = vi.spyOn(port, 'classify');
    const cache = new InMemoryVerdictCache();

    await classifyAction(fixture.input, { port, cache });
    await classifyAction(fixture.input, { port, cache });
    await classifyAction(fixture.input, { port, cache });

    expect(classifySpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache unsafe verdicts (re-classifies every call)', async () => {
    const fixture = UNSAFE_FIXTURES[0]!;
    const verdicts = new Map<string, ClassifierVerdict>([
      [fixture.input.toolName, fixture.expected],
    ]);
    const port = mkPort(verdicts);
    const classifySpy = vi.spyOn(port, 'classify');
    const cache = new InMemoryVerdictCache();

    await classifyAction(fixture.input, { port, cache });
    await classifyAction(fixture.input, { port, cache });

    expect(classifySpy).toHaveBeenCalledTimes(2);
  });

  it('short-circuits read-tier without calling the port', async () => {
    const fixture = SAFE_FIXTURES.find((f) => f.input.tier === 'read')!;
    const port = mkPort(new Map());
    const classifySpy = vi.spyOn(port, 'classify');
    const cache = new InMemoryVerdictCache();

    const result = await classifyAction(fixture.input, { port, cache });
    expect(result.verdict).toBe('safe');
    expect(classifySpy).not.toHaveBeenCalled();
  });

  it('respects the cacheTtlMs option', async () => {
    let now = 1000;
    const fixture = SAFE_FIXTURES.find((f) => f.input.tier === 'mutate')!;
    const verdicts = new Map<string, ClassifierVerdict>([
      [fixture.input.toolName, fixture.expected],
    ]);
    const port = mkPort(verdicts);
    const spy = vi.spyOn(port, 'classify');
    const cache = new InMemoryVerdictCache({ now: () => now });

    await classifyAction(fixture.input, { port, cache, cacheTtlMs: 500 });
    now = 1300;
    await classifyAction(fixture.input, { port, cache, cacheTtlMs: 500 });
    expect(spy).toHaveBeenCalledTimes(1);
    now = 1600;
    await classifyAction(fixture.input, { port, cache, cacheTtlMs: 500 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('fires onMiss / onHit hooks', async () => {
    const fixture = SAFE_FIXTURES.find((f) => f.input.tier === 'mutate')!;
    const verdicts = new Map<string, ClassifierVerdict>([
      [fixture.input.toolName, fixture.expected],
    ]);
    const port = mkPort(verdicts);
    const cache = new InMemoryVerdictCache();
    const onMiss = vi.fn();
    const onHit = vi.fn();

    await classifyAction(fixture.input, { port, cache, onMiss, onHit });
    await classifyAction(fixture.input, { port, cache, onMiss, onHit });

    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onHit).toHaveBeenCalledTimes(1);
  });
});

describe('verdictToAction', () => {
  it('maps safe -> auto-execute', () => {
    expect(
      verdictToAction({ verdict: 'safe', reason: '', recommendPlanMode: false }),
    ).toBe('auto-execute');
  });
  it('maps borderline -> ask-owner', () => {
    expect(
      verdictToAction({
        verdict: 'borderline',
        reason: '',
        recommendPlanMode: false,
      }),
    ).toBe('ask-owner');
  });
  it('maps unsafe -> deny-and-escalate', () => {
    expect(
      verdictToAction({
        verdict: 'unsafe',
        reason: '',
        recommendPlanMode: false,
      }),
    ).toBe('deny-and-escalate');
  });
});
