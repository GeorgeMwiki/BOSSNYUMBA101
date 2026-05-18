/**
 * report.ts — render a markdown report from PMS-bench-1 run summaries.
 *
 * Format:
 *   - aggregate pass^k by scenario
 *   - per-task pass/fail line with mean composite
 *   - footnote explaining methodology
 */

import type { TaskRunSummary } from './run-bench.js';

export function renderReport(summaries: ReadonlyArray<TaskRunSummary>): string {
  const byScenario = new Map<string, TaskRunSummary[]>();
  for (const s of summaries) {
    const list = byScenario.get(s.scenario) ?? [];
    list.push(s);
    byScenario.set(s.scenario, list);
  }

  const lines: string[] = [];
  lines.push('# PMS-bench-1 Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Aggregate pass^k by scenario');
  lines.push('');
  lines.push('| Scenario | Tasks | Passed | Pass rate |');
  lines.push('|----------|-------|--------|-----------|');
  for (const [scenario, list] of byScenario) {
    const passed = list.filter((s) => s.passK).length;
    const rate = ((passed / list.length) * 100).toFixed(1);
    lines.push(`| ${scenario} | ${list.length} | ${passed} | ${rate}% |`);
  }
  const totalPassed = summaries.filter((s) => s.passK).length;
  const totalRate = ((totalPassed / Math.max(1, summaries.length)) * 100).toFixed(1);
  lines.push(`| **TOTAL** | **${summaries.length}** | **${totalPassed}** | **${totalRate}%** |`);
  lines.push('');

  lines.push('## Per-task results');
  lines.push('');
  for (const [scenario, list] of byScenario) {
    lines.push(`### ${scenario}`);
    lines.push('');
    lines.push('| Task | Passes / Runs | Mean composite | Verdict |');
    lines.push('|------|---------------|----------------|---------|');
    for (const s of list) {
      const mean =
        s.runs.reduce((sum, r) => sum + r.composite, 0) / Math.max(1, s.runs.length);
      const verdict = s.passK ? 'PASS' : 'FAIL';
      lines.push(
        `| ${s.taskId} | ${s.passCount}/${s.totalRuns} | ${mean.toFixed(3)} | ${verdict} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Methodology');
  lines.push('');
  lines.push('- Each task runs `k` times against the sub-MD (default `k=5`).');
  lines.push('- Each run is scored by 4 scorers (action-correctness, escalation-correctness, communication-quality, cost-efficiency).');
  lines.push('- A run is a `pass` iff the weighted composite score `>= 0.80`.');
  lines.push('- A task passes (`pass^k`) iff `>= ceil(k * 0.6)` runs pass.');
  lines.push('');
  lines.push('## Phase E.4 note');
  lines.push('');
  lines.push('The Phase E.4 driver runs a *stub* sub-MD that returns empty observations.');
  lines.push('All tasks fail by design. Phase E.5 wires the real sub-MD adapter.');
  return lines.join('\n');
}
