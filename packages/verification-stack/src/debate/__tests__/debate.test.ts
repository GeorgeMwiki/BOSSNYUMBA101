/**
 * Multi-Agent Debate regression tests — 6 fixtures:
 *   3 should-debate-and-converge
 *   3 should-debate-and-flag-disagreement
 */

import { describe, expect, it } from 'vitest';
import { runDebate, debateRequired, DEBATE_REQUIRED_ACTIONS } from '../debate.js';
import { heuristicPersona } from '../persona-port.js';
import { fixedClock } from '../../ports/clock.js';
import type { ActionClass } from '../../types.js';

interface DebateFixture {
  readonly name: string;
  readonly actionClass: ActionClass;
  readonly description: string;
  readonly context: Record<string, unknown>;
  readonly expectDecision: 'unanimous' | 'majority' | 'split' | 'no-consensus';
  readonly expectRecommendation: 'proceed' | 'block' | 'modify' | 'escalate';
}

const fixtures: ReadonlyArray<DebateFixture> = [
  // ─── 3 converge fixtures ──────────────────────────────────────────
  {
    name: 'eviction with proper statutory notice + high recovery → majority proceed (Empathy still pushes modify)',
    actionClass: 'eviction',
    description: 'Eviction of T-1001 after full 14-day notice; 4 months arrears.',
    context: {
      no_statutory_notice: false,
      hardship_request_open: false,
      recovery_probability: 0.85,
      operational_burden: 'low',
    },
    expectDecision: 'majority',
    expectRecommendation: 'proceed',
  },
  {
    name: 'eviction without notice → split (Legal+Financial block; Empathy modify; PM escalate)',
    actionClass: 'eviction',
    description: 'Eviction of T-1002 with no statutory notice.',
    context: {
      no_statutory_notice: true,
      hardship_request_open: false,
      recovery_probability: 0.3,
      operational_burden: 'low',
    },
    expectDecision: 'split',
    expectRecommendation: 'escalate',
  },
  {
    name: 'kra-filing routine + low burden → majority proceed',
    actionClass: 'kra-filing',
    description: 'KRA monthly rental income filing for tenant T-1004.',
    context: {
      no_statutory_notice: false,
      hardship_request_open: false,
      recovery_probability: 0.9,
      operational_burden: 'low',
    },
    expectDecision: 'majority',
    expectRecommendation: 'proceed',
  },

  // ─── 3 flag-disagreement fixtures ─────────────────────────────────
  {
    name: 'lease-termination with hardship → no-consensus / escalate (1:1:1:1)',
    actionClass: 'lease-termination',
    description: 'Terminate lease for T-1005; tenant has hardship deferral pending.',
    context: {
      no_statutory_notice: false,
      hardship_request_open: true,
      recovery_probability: 0.55,
      operational_burden: 'med',
    },
    expectDecision: 'no-consensus',
    expectRecommendation: 'escalate',
  },
  {
    name: 'large-disbursement marginal recovery + high burden → majority modify',
    actionClass: 'large-disbursement',
    description: 'Disburse TZS 800,000 to vendor for property repair.',
    context: {
      no_statutory_notice: false,
      hardship_request_open: false,
      recovery_probability: 0.45,
      operational_burden: 'high',
    },
    expectDecision: 'majority',
    expectRecommendation: 'modify',
  },
  {
    name: 'public-review with hardship + no notice → split (block 2/4) / escalate',
    actionClass: 'public-review',
    description: 'Publicly respond to negative review; tenant has pending hardship.',
    context: {
      no_statutory_notice: true,
      hardship_request_open: true,
      recovery_probability: 0.5,
      operational_burden: 'med',
    },
    expectDecision: 'split',
    expectRecommendation: 'escalate',
  },
];

describe('runDebate — 6 fixtures (3 converge + 3 flag-disagreement)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, async () => {
      const result = await runDebate(
        {
          actionClass: fixture.actionClass,
          actionDescription: fixture.description,
          context: fixture.context,
        },
        {
          persona: heuristicPersona(),
          clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
          rounds: 2,
        },
      );
      expect(result.rounds).toBe(2);
      // 4 personas × 2 rounds = 8 positions
      expect(result.positions).toHaveLength(8);
      expect(result.decision).toBe(fixture.expectDecision);
      expect(result.recommendation).toBe(fixture.expectRecommendation);
    });
  }
});

describe('runDebate — gating behaviour', () => {
  it('returns DEBATE_REQUIRED_ACTIONS set', () => {
    expect(DEBATE_REQUIRED_ACTIONS).toContain('eviction');
    expect(DEBATE_REQUIRED_ACTIONS).toContain('large-disbursement');
    expect(DEBATE_REQUIRED_ACTIONS).toContain('kra-filing');
    expect(DEBATE_REQUIRED_ACTIONS).toContain('lease-termination');
    expect(DEBATE_REQUIRED_ACTIONS).toContain('public-review');
  });

  it('debateRequired returns true only for the 5 destructive classes', () => {
    expect(debateRequired('eviction')).toBe(true);
    expect(debateRequired('large-disbursement')).toBe(true);
    expect(debateRequired('rent-reminder')).toBe(false);
    expect(debateRequired('complaint-response')).toBe(false);
    expect(debateRequired('other')).toBe(false);
  });

  it('serial mode also produces 8 positions', async () => {
    const result = await runDebate(
      {
        actionClass: 'eviction',
        actionDescription: 'test',
        context: {
          no_statutory_notice: false,
          hardship_request_open: false,
          recovery_probability: 0.85,
          operational_burden: 'low',
        },
      },
      {
        persona: heuristicPersona(),
        rounds: 2,
        parallel: false,
      },
    );
    expect(result.positions).toHaveLength(8);
  });
});
