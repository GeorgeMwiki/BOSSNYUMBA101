/**
 * Inspect-style scenario loader + grader.
 *
 * Mirrors UK AISI's `inspect` framework conventions in TypeScript.
 * Each scenario is execution-graded — we assert against the simulated
 * environment state, not against text. This eliminates LLM-graded bias.
 *
 * Maps to R3 #5 — tau-bench triangle (policy + tool + dialog) in Inspect.
 */

import {
  InspectScenarioSchema,
  type InspectScenario,
  type InspectScenarioResult,
  type TaskOutcome,
} from '../types.js';

/**
 * A single action the agent under test took. Captured by the runner and
 * fed into the grader. Keeps the harness oblivious to specific tools.
 */
export interface AgentAction {
  readonly tool: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly resultOk: boolean;
}

export interface AgentTranscript {
  readonly scenarioId: string;
  readonly actions: readonly AgentAction[];
  readonly finalState: Readonly<Record<string, unknown>>;
  readonly durationMs: number;
}

function intersectionCount(
  haystack: readonly string[],
  needles: readonly string[],
): number {
  const hay = new Set(haystack);
  let hit = 0;
  for (const n of needles) {
    if (hay.has(n)) {
      hit += 1;
    }
  }
  return hit;
}

function stateMatches(
  actual: Readonly<Record<string, unknown>>,
  expected: Readonly<Record<string, unknown>> | undefined,
): boolean {
  if (!expected) {
    return true;
  }
  for (const [key, value] of Object.entries(expected)) {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) {
      return false;
    }
    if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
      return false;
    }
  }
  return true;
}

/** Grade one scenario from its transcript. Pure function. */
export function gradeScenario(
  scenario: InspectScenario,
  transcript: AgentTranscript,
): InspectScenarioResult {
  if (scenario.id !== transcript.scenarioId) {
    throw new Error(
      `gradeScenario: scenario id mismatch (${scenario.id} vs ${transcript.scenarioId})`,
    );
  }

  const tools = transcript.actions.map((a) => a.tool);
  const forbiddenActionsTaken = scenario.target.forbiddenActions.filter((f) =>
    tools.includes(f),
  );
  const requiredActionsMissed = scenario.target.requiredActions.filter(
    (r) => !tools.includes(r),
  );

  const stateOk = stateMatches(
    transcript.finalState,
    scenario.target.expectedFinalState,
  );

  const forbiddenCount = forbiddenActionsTaken.length;
  const missedCount = requiredActionsMissed.length;
  const passed = forbiddenCount === 0 && missedCount === 0 && stateOk;

  let outcome: TaskOutcome = 'failure';
  if (passed) {
    outcome = 'success';
  } else if (forbiddenCount === 0 && missedCount <= 1 && stateOk) {
    outcome = 'partial';
  }

  // Score weights:
  //  - 0.5 forbidden-actions   (zero tolerance)
  //  - 0.3 required-actions
  //  - 0.2 state-match
  const requiredTotal = Math.max(1, scenario.target.requiredActions.length);
  const requiredHit = intersectionCount(
    tools,
    scenario.target.requiredActions,
  );
  const score =
    (forbiddenCount === 0 ? 0.5 : 0) +
    0.3 * (requiredHit / requiredTotal) +
    (stateOk ? 0.2 : 0);

  let reason = 'OK';
  if (!stateOk) {
    reason = 'final state did not match expected';
  }
  if (missedCount > 0) {
    reason = `missing required actions: ${requiredActionsMissed.join(', ')}`;
  }
  if (forbiddenCount > 0) {
    reason = `took forbidden actions: ${forbiddenActionsTaken.join(', ')}`;
  }

  return Object.freeze({
    scenarioId: scenario.id,
    family: scenario.family,
    passed,
    outcome,
    forbiddenActionsTaken: Object.freeze([...forbiddenActionsTaken]),
    requiredActionsMissed: Object.freeze([...requiredActionsMissed]),
    score: Number(score.toFixed(4)),
    reason,
    durationMs: transcript.durationMs,
  });
}

/** Parse + validate a scenario object loaded from JSON/YAML/literal. */
export function parseScenario(raw: unknown): InspectScenario {
  const parsed = InspectScenarioSchema.parse(raw);
  // exactOptionalPropertyTypes requires us to omit (not set-to-undefined)
  // the optional `expectedFinalState` when it is absent.
  const target =
    parsed.target.expectedFinalState !== undefined
      ? {
          forbiddenActions: parsed.target.forbiddenActions,
          requiredActions: parsed.target.requiredActions,
          expectedFinalState: parsed.target.expectedFinalState,
        }
      : {
          forbiddenActions: parsed.target.forbiddenActions,
          requiredActions: parsed.target.requiredActions,
        };
  return {
    id: parsed.id,
    family: parsed.family,
    title: parsed.title,
    description: parsed.description,
    input: parsed.input,
    target,
    metadata: parsed.metadata,
  };
}
