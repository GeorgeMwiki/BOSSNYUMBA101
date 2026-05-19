/**
 * eval-driven-iteration tests.
 *
 * Covers regression detection (5pp threshold), failed-scenario → DPO
 * conversion, and full cycle integration.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  runEvalCycle,
  checkRegression,
  failedScenarioToPair,
  REGRESSION_ALERT_THRESHOLD_PP,
  type EvalCyclePorts,
  type InspectHarnessPort,
  type EvalScenarioRun,
  type PreferencePairSink,
} from '../eval-driven-iteration/index.js';
import type { PreferencePair } from '../types.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLOCK_AT = new Date('2026-05-19T08:00:00Z');

function mkInspect(opts: {
  runs?: EvalScenarioRun[];
  rolling?: number;
  promptResolver?: (scenarioId: string) => string;
}): InspectHarnessPort {
  return {
    runAllScenarios: vi.fn(async () => opts.runs ?? []),
    getRollingPassRate: vi.fn(async () => opts.rolling ?? 0.9),
    resolveScenarioPrompt: vi.fn(async (id) =>
      opts.promptResolver ? opts.promptResolver(id) : `prompt for ${id}`,
    ),
  };
}

function mkSink(): PreferencePairSink & { __pairs: PreferencePair[] } {
  const pairs: PreferencePair[] = [];
  return {
    __pairs: pairs,
    enqueuePairs: async (input) => {
      for (const p of input) pairs.push(p);
    },
  };
}

function mkPorts(opts?: {
  inspect?: InspectHarnessPort;
  sink?: ReturnType<typeof mkSink>;
}): EvalCyclePorts & { __sink: ReturnType<typeof mkSink> } {
  const sink = opts?.sink ?? mkSink();
  return {
    inspect: opts?.inspect ?? mkInspect({}),
    pairSink: sink,
    clock: () => CLOCK_AT,
    cycleIdFactory: () => 'cycle-test',
    __sink: sink,
  };
}

// ──────────────── regression alert ────────────────────────────────

describe('checkRegression', () => {
  it('drop > 5pp → alert', () => {
    expect(
      checkRegression({ currentPassRate: 0.84, rollingPassRate: 0.9 }),
    ).toBe(true);
  });

  it('drop just under 5pp → no alert (boundary, FP-safe)', () => {
    // 0.95 - 0.901 = 0.049 < 0.05 → no alert
    expect(
      checkRegression({ currentPassRate: 0.901, rollingPassRate: 0.95 }),
    ).toBe(false);
  });

  it('drop just over 5pp → alert', () => {
    // 0.95 - 0.89 = 0.06 > 0.05 → alert
    expect(
      checkRegression({ currentPassRate: 0.89, rollingPassRate: 0.95 }),
    ).toBe(true);
  });

  it('improvement → no alert', () => {
    expect(
      checkRegression({ currentPassRate: 0.95, rollingPassRate: 0.9 }),
    ).toBe(false);
  });

  it('REGRESSION_ALERT_THRESHOLD_PP is 5pp (0.05)', () => {
    expect(REGRESSION_ALERT_THRESHOLD_PP).toBe(0.05);
  });
});

// ──────────────── failed scenario → DPO pair ──────────────────────

describe('failedScenarioToPair', () => {
  it('builds a DPO pair with high chosen quality', () => {
    const pair = failedScenarioToPair({
      tenantId: TENANT,
      scenario: {
        scenarioId: 'sc-1',
        expectedAction: 'reply politely',
        actualAction: 'rage-quit',
        traceId: 'trace-1',
      },
      scenarioPrompt: 'angry tenant message',
      generatedAt: CLOCK_AT.toISOString(),
    });
    expect(pair.algo).toBe('dpo');
    expect(pair.chosen).toBe('reply politely');
    expect(pair.rejected).toBe('rage-quit');
    expect(pair.chosenQuality).toBeGreaterThanOrEqual(0.9);
  });
});

// ──────────────── full cycle ──────────────────────────────────────

describe('runEvalCycle', () => {
  it('reports pass-rate and no regression on healthy week', async () => {
    const ports = mkPorts({
      inspect: mkInspect({
        runs: [
          mkRun('s1', true),
          mkRun('s2', true),
          mkRun('s3', false),
        ],
        rolling: 0.7,
      }),
    });
    const result = await runEvalCycle(ports, { tenantId: TENANT });
    expect(result.scenariosRun).toBe(3);
    expect(result.currentPassRate).toBeCloseTo(2 / 3, 3);
    expect(result.rollingPassRate).toBe(0.7);
    expect(result.regressionAlert).toBe(false);
  });

  it('5pp regression triggers alert', async () => {
    const ports = mkPorts({
      inspect: mkInspect({
        runs: [mkRun('s1', false), mkRun('s2', false), mkRun('s3', false), mkRun('s4', true)],
        rolling: 0.95,
      }),
    });
    const result = await runEvalCycle(ports, { tenantId: TENANT });
    expect(result.currentPassRate).toBe(0.25);
    expect(result.regressionAlert).toBe(true);
  });

  it('failed scenarios → candidate DPO pairs in sink', async () => {
    const ports = mkPorts({
      inspect: mkInspect({
        runs: [
          mkRun('s1', true),
          mkRun('s2', false, {
            expectedAction: 'foo',
            actualAction: 'bar',
          }),
          mkRun('s3', false, {
            expectedAction: 'baz',
            actualAction: 'qux',
          }),
        ],
        rolling: 0.9,
      }),
    });
    const result = await runEvalCycle(ports, { tenantId: TENANT });
    expect(result.failedScenarios.length).toBe(2);
    expect(ports.__sink.__pairs.length).toBe(2);
    expect(ports.__sink.__pairs[0].chosen).toBe('foo');
    expect(ports.__sink.__pairs[0].rejected).toBe('bar');
    expect(ports.__sink.__pairs[1].chosen).toBe('baz');
  });

  it('no failures → no pairs enqueued', async () => {
    const ports = mkPorts({
      inspect: mkInspect({
        runs: [mkRun('s1', true), mkRun('s2', true)],
        rolling: 0.9,
      }),
    });
    await runEvalCycle(ports, { tenantId: TENANT });
    expect(ports.__sink.__pairs.length).toBe(0);
  });

  it('empty scenarios → currentPassRate=1 (defensive default)', async () => {
    const ports = mkPorts({
      inspect: mkInspect({ runs: [], rolling: 0.9 }),
    });
    const result = await runEvalCycle(ports, { tenantId: TENANT });
    expect(result.currentPassRate).toBe(1);
    expect(result.regressionAlert).toBe(false);
  });
});

function mkRun(
  scenarioId: string,
  passed: boolean,
  overrides?: Partial<EvalScenarioRun>,
): EvalScenarioRun {
  return {
    scenarioId,
    passed,
    expectedAction: 'expected',
    actualAction: passed ? 'expected' : 'actual',
    traceId: `trace-${scenarioId}`,
    ...overrides,
  };
}
