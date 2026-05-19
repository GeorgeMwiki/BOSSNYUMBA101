import { describe, expect, it } from 'vitest';

import {
  ALL_SCENARIOS,
  POLICY_COMPLIANCE_SCENARIOS,
  TOOL_USE_SCENARIOS,
  evalGatePasses,
  formatReportMarkdown,
  runInspectEval,
  type AgentExecutor,
  type AgentTranscript,
} from '../inspect-harness/index.js';
import type { InspectScenario } from '../types.js';

function perfectExecutor(scenario: InspectScenario): AgentTranscript {
  // Run every required action; avoid every forbidden action; match expected state.
  return {
    scenarioId: scenario.id,
    actions: scenario.target.requiredActions.map((tool) => ({
      tool,
      args: {},
      resultOk: true,
    })),
    finalState: scenario.target.expectedFinalState ?? {},
    durationMs: 50,
  };
}

function reckless(scenario: InspectScenario): AgentTranscript {
  return {
    scenarioId: scenario.id,
    actions: [
      ...scenario.target.forbiddenActions.map((tool) => ({
        tool,
        args: {},
        resultOk: true,
      })),
      ...scenario.target.requiredActions.map((tool) => ({
        tool,
        args: {},
        resultOk: true,
      })),
    ],
    finalState: scenario.target.expectedFinalState ?? {},
    durationMs: 50,
  };
}

describe('Inspect runner — execution-graded eval', () => {
  it('runs all 30 scenarios and emits a complete report', async () => {
    const report = await runInspectEval(ALL_SCENARIOS, perfectExecutor);
    expect(report.summary.total).toBe(30);
    expect(report.summary.passed).toBe(30);
    expect(report.summary.passRate).toBe(1);
  });

  it('captures per-family aggregates', async () => {
    const report = await runInspectEval(ALL_SCENARIOS, perfectExecutor);
    expect(report.summary.perFamily.policy_compliance.total).toBe(10);
    expect(report.summary.perFamily.tool_use.total).toBe(10);
    expect(report.summary.perFamily.dialog.total).toBe(10);
  });

  it('reckless executor fails policy scenarios', async () => {
    const report = await runInspectEval(POLICY_COMPLIANCE_SCENARIOS, reckless);
    expect(report.summary.failed).toBeGreaterThan(0);
  });

  it('formatReportMarkdown returns a Markdown table', async () => {
    const report = await runInspectEval(POLICY_COMPLIANCE_SCENARIOS, perfectExecutor);
    const md = formatReportMarkdown(report);
    expect(md).toContain('# Inspect Eval Run');
    expect(md).toContain('| Scenario |');
    expect(md).toContain('## Per-family');
  });

  it('evalGatePasses returns true when policy + tool-use both clean', async () => {
    const report = await runInspectEval(
      [...POLICY_COMPLIANCE_SCENARIOS, ...TOOL_USE_SCENARIOS],
      perfectExecutor,
    );
    expect(evalGatePasses(report)).toBe(true);
  });

  it('evalGatePasses returns false when any policy fails', async () => {
    const report = await runInspectEval(
      POLICY_COMPLIANCE_SCENARIOS,
      reckless,
    );
    expect(evalGatePasses(report)).toBe(false);
  });

  it('continueOnError default true — executor throw is captured as failure', async () => {
    const throwing: AgentExecutor = () => {
      throw new Error('boom');
    };
    const report = await runInspectEval(
      POLICY_COMPLIANCE_SCENARIOS.slice(0, 1),
      throwing,
    );
    expect(report.summary.failed).toBe(1);
    expect(report.results[0]?.reason).toContain('boom');
  });

  it('continueOnError false — propagates executor throw', async () => {
    const throwing: AgentExecutor = () => {
      throw new Error('boom');
    };
    await expect(
      runInspectEval(POLICY_COMPLIANCE_SCENARIOS.slice(0, 1), throwing, {
        continueOnError: false,
      }),
    ).rejects.toThrow(/boom/);
  });
});
