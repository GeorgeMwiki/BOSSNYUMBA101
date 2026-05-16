/**
 * Stage 09 — Weekly prompt recompile (DSPy GEPA-style).
 *
 * B4 Phase B — Progressive Intelligence.
 *
 * Runs ONCE PER WEEK, on Sundays (UTC), from the orchestrator. Picks
 * up the `prompt-patch` decisions emitted by stage 04 over the past
 * week, runs GEPA Pareto-improvement against the frozen golden set
 * and the new-trace eval suite, and promotes new prompts only when:
 *
 *   1. The new prompt scores ≥ the base prompt on the golden set
 *      (golden set is FROZEN — no regressions allowed).
 *   2. The new prompt scores STRICTLY > the base prompt on the new
 *      trace suite.
 *
 * The DSPy GEPA engine lives in `@bossnyumba/central-intelligence`
 * (`kernel/prompt-evolution/gepa-optimizer.ts`); this stage is a thin
 * port wrapper so the worker has no compile-time dependency on the
 * optimiser package.
 *
 * Why a separate stage instead of running every night?
 * Per the architecture doc, weekly cadence is what DSPy GEPA was
 * tuned against; running it nightly produces noisy mutations and
 * wastes spend. The orchestrator's `weekday()` guard short-circuits
 * on non-Sunday ticks.
 */

import type { StageLogger } from './types.js';

export interface WeeklyPromptCompileResult {
  readonly promptsCompiled: number;
  readonly promotedCount: number;
}

export interface WeeklyPromptCompileArgs {
  readonly logger: StageLogger;
  readonly compile: () => Promise<WeeklyPromptCompileResult>;
}

export async function runWeeklyPromptCompileStage(
  args: WeeklyPromptCompileArgs,
): Promise<WeeklyPromptCompileResult> {
  try {
    const result = await args.compile();
    args.logger.info(
      {
        stage: '09-weekly-prompt-compile',
        promptsCompiled: result.promptsCompiled,
        promotedCount: result.promotedCount,
      },
      'weekly prompt-compile complete',
    );
    return result;
  } catch (error) {
    args.logger.warn(
      {
        stage: '09-weekly-prompt-compile',
        err: error instanceof Error ? error.message : String(error),
      },
      'weekly prompt-compile failed',
    );
    return { promptsCompiled: 0, promotedCount: 0 };
  }
}
