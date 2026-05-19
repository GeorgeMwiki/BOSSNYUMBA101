import { describe, expect, it } from 'vitest';

import {
  ALL_SCENARIOS,
  DIALOG_SCENARIOS,
  POLICY_COMPLIANCE_SCENARIOS,
  TOOL_USE_SCENARIOS,
  gradeScenario,
  parseScenario,
  type AgentTranscript,
} from '../inspect-harness/index.js';

function txt(scenarioId: string, actions: AgentTranscript['actions'], finalState: AgentTranscript['finalState']): AgentTranscript {
  return {
    scenarioId,
    actions,
    finalState,
    durationMs: 100,
  };
}

describe('Inspect scenario suite — tau-bench triangle', () => {
  it('bundles exactly 10 policy-compliance scenarios', () => {
    expect(POLICY_COMPLIANCE_SCENARIOS).toHaveLength(10);
  });

  it('bundles exactly 10 tool-use scenarios', () => {
    expect(TOOL_USE_SCENARIOS).toHaveLength(10);
  });

  it('bundles exactly 10 dialog scenarios', () => {
    expect(DIALOG_SCENARIOS).toHaveLength(10);
  });

  it('ALL_SCENARIOS = 30 total', () => {
    expect(ALL_SCENARIOS).toHaveLength(30);
  });

  it('every scenario validates against schema', () => {
    for (const s of ALL_SCENARIOS) {
      expect(() => parseScenario(s)).not.toThrow();
    }
  });

  it('every scenario id is unique', () => {
    const ids = new Set(ALL_SCENARIOS.map((s) => s.id));
    expect(ids.size).toBe(ALL_SCENARIOS.length);
  });

  it('grades a passing scenario as success', () => {
    const scenario = POLICY_COMPLIANCE_SCENARIOS[0]!;
    const transcript = txt(
      scenario.id,
      [{ tool: 'request_approval', args: {}, resultOk: true }],
      { tenantId: 'tenant-001', approvalGranted: false },
    );
    const result = gradeScenario(scenario, transcript);
    expect(result.passed).toBe(true);
    expect(result.outcome).toBe('success');
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it('grades a forbidden-action failure', () => {
    const scenario = POLICY_COMPLIANCE_SCENARIOS[0]!;
    const transcript = txt(
      scenario.id,
      [
        { tool: 'waive_rent', args: {}, resultOk: true }, // forbidden
        { tool: 'request_approval', args: {}, resultOk: true },
      ],
      { tenantId: 'tenant-001', approvalGranted: false },
    );
    const result = gradeScenario(scenario, transcript);
    expect(result.passed).toBe(false);
    expect(result.forbiddenActionsTaken).toContain('waive_rent');
    expect(result.reason).toContain('forbidden');
  });

  it('grades a missing-required-action partial', () => {
    const scenario = POLICY_COMPLIANCE_SCENARIOS[0]!;
    const transcript = txt(
      scenario.id,
      [], // no actions at all
      { tenantId: 'tenant-001', approvalGranted: false },
    );
    const result = gradeScenario(scenario, transcript);
    expect(result.passed).toBe(false);
    expect(result.requiredActionsMissed).toContain('request_approval');
  });

  it('throws on scenarioId mismatch', () => {
    const scenario = POLICY_COMPLIANCE_SCENARIOS[0]!;
    const transcript = txt('different-id', [], {});
    expect(() => gradeScenario(scenario, transcript)).toThrow();
  });

  it('parseScenario rejects invalid input', () => {
    expect(() => parseScenario({ id: '' })).toThrow();
  });

  it('every policy scenario lists at least one required or forbidden action', () => {
    for (const s of POLICY_COMPLIANCE_SCENARIOS) {
      expect(
        s.target.forbiddenActions.length + s.target.requiredActions.length,
      ).toBeGreaterThan(0);
    }
  });

  it('every tool-use scenario lists at least one tool in manifest', () => {
    for (const s of TOOL_USE_SCENARIOS) {
      expect(s.input.toolManifest.length).toBeGreaterThan(0);
    }
  });

  it('every dialog scenario has at least one user message', () => {
    for (const s of DIALOG_SCENARIOS) {
      expect(s.input.userMessages.length).toBeGreaterThan(0);
    }
  });
});
