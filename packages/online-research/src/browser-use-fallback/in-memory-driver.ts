/**
 * In-memory Browser-Use driver — used for tests + dev. Returns
 * deterministic extracted data keyed by task description keywords.
 * Production wraps the open-source `browser-use` package driven by
 * Haiku 4.5.
 */

import type { BrowserUseDriverPort } from '../ports/index.js';
import type { BrowserTask, BrowserTaskResult } from '../types/index.js';

export interface InMemoryBrowserScript {
  /** Keyword the task description must contain. */
  readonly matches: ReadonlyArray<string>;
  /** Result to return on match. */
  readonly result: Pick<
    BrowserTaskResult,
    'extracted' | 'screenshotPaths' | 'stepsUsed' | 'costUsd'
  >;
  /** Optional artificial latency in ms. */
  readonly latencyMs?: number;
}

export interface InMemoryBrowserDriverConfig {
  readonly scripts: ReadonlyArray<InMemoryBrowserScript>;
  /** Default cost when no script matches. */
  readonly defaultCostUsd?: number;
  /** Clock for timing. */
  readonly clock: { readonly nowMs: () => number };
}

export function createInMemoryBrowserDriver(
  config: InMemoryBrowserDriverConfig,
): BrowserUseDriverPort {
  return {
    runTask: async (task: BrowserTask): Promise<BrowserTaskResult> => {
      const startMs = config.clock.nowMs();
      const lower = task.description.toLowerCase();
      const script = config.scripts.find((s) =>
        s.matches.some((kw) => lower.includes(kw.toLowerCase())),
      );

      if (script === undefined) {
        return Object.freeze({
          taskId: task.id,
          status: 'ok',
          extracted: [],
          screenshotPaths: [],
          stepsUsed: 1,
          elapsedMs: config.clock.nowMs() - startMs,
          costUsd: config.defaultCostUsd ?? 0.01,
        });
      }

      if (script.latencyMs !== undefined && script.latencyMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, script.latencyMs);
        });
      }

      return Object.freeze({
        taskId: task.id,
        status: 'ok',
        extracted: Object.freeze([...script.result.extracted]),
        screenshotPaths: Object.freeze([...script.result.screenshotPaths]),
        stepsUsed: script.result.stepsUsed,
        elapsedMs: config.clock.nowMs() - startMs,
        costUsd: script.result.costUsd,
      });
    },
  };
}
