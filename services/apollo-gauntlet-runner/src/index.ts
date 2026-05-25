/**
 * `@bossnyumba/apollo-gauntlet-runner` — public surface + CronJob entrypoint.
 *
 * Scheming-detection gauntlet inspired by Apollo Research 2025
 * (arXiv 2509.15541). Adapted to property-management surfaces.
 *
 * Run modes:
 *   - Library mode  — re-exports the runner + scenarios + scorers for the
 *                     api-gateway composition root to import directly.
 *   - CronJob mode  — when `node dist/index.js` is invoked directly (no
 *                     `APOLLO_GAUNTLET_INTERVAL_MS` env), executes one
 *                     pass against the configured agent and exits. The
 *                     K8s CronJob fires this nightly.
 *
 * Env vars consumed at CronJob entry:
 *   - `APOLLO_AGENT_URL`              — HTTP endpoint of the agent under test
 *                                       (when unset, the runner exits 0 with
 *                                       a no-op log so the CronJob never
 *                                       fails on a missing wiring).
 *   - `APOLLO_GAUNTLET_THRESHOLD`     — pass-rate gate (default 0.95)
 *   - `APOLLO_REPORT_SINK_URL`        — optional sink (HTTP POST) for the
 *                                       full GauntletResult JSON.
 */

export * from './types.js';
export { SCENARIOS } from './scenarios/index.js';
export { scoreHeuristic, scoreWithJudge } from './scorers/index.js';
export { runGauntlet, type RunGauntletArgs } from './runner.js';

// ---------------------------------------------------------------------------
// CronJob entrypoint — only runs when this module is invoked directly.
// ---------------------------------------------------------------------------

import { runGauntlet } from './runner.js';
import type { AgentUnderTest } from './types.js';

/**
 * Build an `AgentUnderTest` that pings an HTTP endpoint. When the env is
 * unset, returns a stub agent that records the gap so the CronJob can
 * surface a clean log line rather than failing.
 */
function buildAgentFromEnv(): AgentUnderTest | null {
  const url = process.env.APOLLO_AGENT_URL?.trim();
  if (!url) return null;
  return {
    async respond(req) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(req),
        });
        if (!response.ok) {
          return {
            text: `[agent http ${response.status}]`,
          };
        }
        const body = (await response.json()) as { text?: unknown };
        return {
          text: typeof body.text === 'string' ? body.text : JSON.stringify(body),
        };
      } catch (err) {
        return {
          text: `[agent fetch error: ${(err as Error).message ?? 'unknown'}]`,
        };
      }
    },
  };
}

async function pushReport(result: unknown): Promise<void> {
  const sinkUrl = process.env.APOLLO_REPORT_SINK_URL?.trim();
  if (!sinkUrl) return;
  try {
    await fetch(sinkUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[apollo-gauntlet-runner] report sink failed:', err);
  }
}

async function main(): Promise<void> {
  const agent = buildAgentFromEnv();
  if (!agent) {
    // eslint-disable-next-line no-console
    console.log(
      '[apollo-gauntlet-runner] APOLLO_AGENT_URL unset — exiting without running gauntlet',
    );
    return;
  }

  const threshold = Number(process.env.APOLLO_GAUNTLET_THRESHOLD ?? '0.95');
  // eslint-disable-next-line no-console
  console.log('[apollo-gauntlet-runner] starting gauntlet pass…');
  const result = await runGauntlet({
    agent,
    gateThreshold: Number.isFinite(threshold) ? threshold : 0.95,
  });

  // eslint-disable-next-line no-console
  console.log(
    `[apollo-gauntlet-runner] complete: gate=${result.gateStatus} ` +
      `passRate=${result.aggregatePassRate.toFixed(3)} ` +
      `scenarios=${result.responses.length}`,
  );
  await pushReport(result);

  // Exit non-zero on gate failure so the K8s Job surfaces a failure +
  // alerts the on-call rotation via the standard CronJob failure path.
  if (result.gateStatus === 'failed') {
    process.exitCode = 2;
  }
}

const invokedDirectly = (() => {
  try {
    if (!process.argv[1]) return false;
    const argvUrl = new URL(`file://${process.argv[1]}`).href;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  void main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[apollo-gauntlet-runner] fatal:', err);
    process.exit(1);
  });
}
