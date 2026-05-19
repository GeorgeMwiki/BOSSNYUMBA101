/**
 * Inspect harness runner — runs a list of scenarios against an injected
 * AgentExecutor + simulated environment, grades each one, and emits a
 * full `InspectRunReport`.
 *
 * Output destination: `.audit/inspect-eval-<runId>.{json,md}` per run.
 * (Writing files is the application layer's job — this module is pure
 * and returns the report object.)
 *
 * Maps to R3 #5 — tau-bench triangle in Inspect.
 */

import { randomUUID } from 'node:crypto';

import type {
  InspectRunReport,
  InspectScenario,
  InspectScenarioFamily,
  InspectScenarioResult,
} from '../types.js';
import {
  gradeScenario,
  type AgentTranscript,
} from './scenario.js';

/**
 * Pluggable agent executor — implementations run the scenario against
 * either a real agent stack or a mock. Must produce a transcript whose
 * `scenarioId` matches the scenario's id.
 */
export type AgentExecutor = (
  scenario: InspectScenario,
) => Promise<AgentTranscript> | AgentTranscript;

function nowIso(): string {
  return new Date().toISOString();
}

function emptyPerFamily(): Record<
  InspectScenarioFamily,
  { passed: number; total: number }
> {
  return {
    policy_compliance: { passed: 0, total: 0 },
    tool_use: { passed: 0, total: 0 },
    dialog: { passed: 0, total: 0 },
  };
}

export interface RunOptions {
  readonly runId?: string;
  /** Continue past failures (default true) — eval suites are batch graders. */
  readonly continueOnError?: boolean;
}

/**
 * Run all scenarios, grade each, return the aggregate report.
 * Never throws on individual scenario failures unless `continueOnError`
 * is explicitly false.
 */
export async function runInspectEval(
  scenarios: readonly InspectScenario[],
  executor: AgentExecutor,
  options: RunOptions = {},
): Promise<InspectRunReport> {
  const runId = options.runId ?? randomUUID();
  const continueOnError = options.continueOnError ?? true;
  const startedAt = nowIso();
  const results: InspectScenarioResult[] = [];
  const perFamily = emptyPerFamily();

  for (const scenario of scenarios) {
    try {
      const transcript = await executor(scenario);
      const result = gradeScenario(scenario, transcript);
      results.push(result);
      perFamily[result.family].total += 1;
      if (result.passed) {
        perFamily[result.family].passed += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed: InspectScenarioResult = Object.freeze({
        scenarioId: scenario.id,
        family: scenario.family,
        passed: false,
        outcome: 'failure',
        forbiddenActionsTaken: [],
        requiredActionsMissed: scenario.target.requiredActions,
        score: 0,
        reason: `executor threw: ${message}`,
        durationMs: 0,
      });
      results.push(failed);
      perFamily[scenario.family].total += 1;
      if (!continueOnError) {
        throw err;
      }
    }
  }

  const finishedAt = nowIso();
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const passRate = total === 0 ? 0 : Number((passed / total).toFixed(4));

  const report: InspectRunReport = Object.freeze({
    runId,
    startedAt,
    finishedAt,
    results: Object.freeze(results),
    summary: Object.freeze({
      total,
      passed,
      failed: total - passed,
      passRate,
      perFamily: Object.freeze(perFamily),
    }),
  });
  return report;
}

/** Format report as a compact Markdown summary for `.audit/*.md`. */
export function formatReportMarkdown(report: InspectRunReport): string {
  const lines: string[] = [];
  lines.push(`# Inspect Eval Run \`${report.runId}\``);
  lines.push('');
  lines.push(`- Started:  ${report.startedAt}`);
  lines.push(`- Finished: ${report.finishedAt}`);
  lines.push(
    `- Total:    ${report.summary.total} · passed ${report.summary.passed} · failed ${report.summary.failed} · pass-rate ${(report.summary.passRate * 100).toFixed(1)}%`,
  );
  lines.push('');
  lines.push('## Per-family');
  lines.push('');
  for (const [family, agg] of Object.entries(report.summary.perFamily)) {
    lines.push(`- ${family}: ${agg.passed}/${agg.total}`);
  }
  lines.push('');
  lines.push('## Scenario results');
  lines.push('');
  lines.push('| Scenario | Family | Passed | Score | Reason |');
  lines.push('|---|---|---|---|---|');
  for (const r of report.results) {
    lines.push(
      `| ${r.scenarioId} | ${r.family} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.score.toFixed(2)} | ${r.reason} |`,
    );
  }
  return lines.join('\n');
}

/** Gate predicate — every PR must pass policy + tool-use; dialog informational. */
export function evalGatePasses(report: InspectRunReport): boolean {
  const policy = report.summary.perFamily.policy_compliance;
  const tool = report.summary.perFamily.tool_use;
  const policyAllPass = policy.total > 0 && policy.passed === policy.total;
  const toolAllPass = tool.total > 0 && tool.passed === tool.total;
  return policyAllPass && toolAllPass;
}
