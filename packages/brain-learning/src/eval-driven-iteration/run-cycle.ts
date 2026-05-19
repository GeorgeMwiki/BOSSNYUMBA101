/**
 * Eval-driven iteration cycle (§7 R-LEARNING).
 *
 * Triggered weekly. Drives improvement via K-D Inspect:
 *   1. Run all Inspect scenarios for the current model version
 *   2. Compare this-week pass-rate vs 4-week-rolling per scenario
 *   3. Regression alert when current drops > 5pp on any scenario
 *   4. Auto-flag failed scenarios as candidate DPO pairs
 *   5. Push candidate pairs into the preference-pair-builder queue
 */

import type {
  EvalCycleResult,
  EvalFailedScenario,
  PreferencePair,
} from '../types.js';
import {
  checkRegression,
  failedScenarioToPair,
} from './regression-alert.js';

/**
 * Port for K-D Inspect harness.
 */
export interface InspectHarnessPort {
  /**
   * Run all scenarios for this cycle. Returns one EvalScenarioRun per
   * scenario.
   */
  runAllScenarios(args: { cycleId: string }): Promise<ReadonlyArray<EvalScenarioRun>>;
  /**
   * Look up the rolling-4-week pass-rate across all scenarios.
   */
  getRollingPassRate(args: { weeks: number }): Promise<number>;
  /**
   * Resolve the human-curated prompt text for a failed scenario.
   */
  resolveScenarioPrompt(scenarioId: string): Promise<string>;
}

export interface EvalScenarioRun {
  readonly scenarioId: string;
  readonly passed: boolean;
  readonly expectedAction: string;
  readonly actualAction: string;
  readonly traceId: string;
}

/**
 * Port for pushing candidate pairs back into preference-pair-builder.
 */
export interface PreferencePairSink {
  enqueuePairs(pairs: ReadonlyArray<PreferencePair>): Promise<void>;
}

export interface EvalCyclePorts {
  readonly inspect: InspectHarnessPort;
  readonly pairSink: PreferencePairSink;
  readonly clock: () => Date;
  readonly cycleIdFactory: () => string;
}

/**
 * Public entrypoint.
 */
export async function runEvalCycle(
  ports: EvalCyclePorts,
  args: { tenantId: string },
): Promise<EvalCycleResult> {
  const cycleId = ports.cycleIdFactory();
  const now = ports.clock();

  const runs = await ports.inspect.runAllScenarios({ cycleId });
  const passed = runs.filter((r) => r.passed).length;
  const currentPassRate = runs.length === 0 ? 1 : passed / runs.length;
  const rollingPassRate = await ports.inspect.getRollingPassRate({ weeks: 4 });

  const failed: EvalFailedScenario[] = runs
    .filter((r) => !r.passed)
    .map((r) =>
      Object.freeze({
        scenarioId: r.scenarioId,
        expectedAction: r.expectedAction,
        actualAction: r.actualAction,
        traceId: r.traceId,
      }),
    );

  // Auto-generate DPO pairs for each failed scenario.
  const pairs: PreferencePair[] = [];
  for (const scenario of failed) {
    const prompt = await ports.inspect.resolveScenarioPrompt(
      scenario.scenarioId,
    );
    pairs.push(
      failedScenarioToPair({
        tenantId: args.tenantId,
        scenario,
        scenarioPrompt: prompt,
        generatedAt: now.toISOString(),
      }),
    );
  }
  if (pairs.length > 0) {
    await ports.pairSink.enqueuePairs(Object.freeze(pairs));
  }

  return Object.freeze({
    cycleId,
    scenariosRun: runs.length,
    currentPassRate,
    rollingPassRate,
    regressionAlert: checkRegression({ currentPassRate, rollingPassRate }),
    failedScenarios: Object.freeze(failed),
    evaluatedAt: now.toISOString(),
  });
}
