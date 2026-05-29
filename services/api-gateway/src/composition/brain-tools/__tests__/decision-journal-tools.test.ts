/**
 * Decision-journal brain tools — handler integrity tests.
 *
 * Verifies the six read-only journal tools (recent / explain / search /
 * replay / what_did_i_decide / success_rate) compile against the
 * BossNyumba multi-currency outcome shape (observedValue +
 * observedCurrency), require composition-time wiring via
 * configureDecisionJournalTools, and refuse before wiring.
 *
 * The handlers themselves exercise drizzle `sql` against an in-memory
 * fake. We assert request shape + result mapping, not raw SQL strings.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DECISION_JOURNAL_TOOLS,
  __resetDecisionJournalToolsForTests,
  configureDecisionJournalTools,
  decisionsRecentTool,
  decisionsSuccessRateTool,
} from '../decision-journal-tools.js';

const baseCtx = {
  tenantId: 'tnt-test',
  actorId: 'usr-test',
  personaSlug: 'T1_owner_strategist',
};

interface FakeDbCall {
  readonly response: unknown;
}

function makeFakeDb(responses: ReadonlyArray<FakeDbCall>) {
  let i = 0;
  const calls: unknown[] = [];
  return {
    db: {
      async execute(q: unknown): Promise<unknown> {
        calls.push(q);
        const r = responses[i++];
        return r ? r.response : { rows: [] };
      },
    },
    calls,
  };
}

afterEach(() => {
  __resetDecisionJournalToolsForTests();
});

describe('DECISION_JOURNAL_TOOLS — catalog shape', () => {
  it('exports exactly 6 tools', () => {
    expect(DECISION_JOURNAL_TOOLS.length).toBe(6);
  });

  it('every tool is LOW stakes + isWrite=false', () => {
    for (const tool of DECISION_JOURNAL_TOOLS) {
      expect(tool.stakes).toBe('LOW');
      expect(tool.isWrite).toBe(false);
      expect(tool.requiresPolicyRuleLiteral).toBe(false);
    }
  });

  it('every tool is owner + admin only', () => {
    for (const tool of DECISION_JOURNAL_TOOLS) {
      expect(tool.personaSlugs).toEqual([
        'T1_owner_strategist',
        'T2_admin_strategist',
      ]);
    }
  });
});

describe('configureDecisionJournalTools wiring', () => {
  it('refuses with explicit error before configuration', async () => {
    await expect(
      decisionsRecentTool.handler({ limit: 5 }, baseCtx),
    ).rejects.toThrow(/was not called at composition time/);
  });

  it('accepts the fake db after configure', async () => {
    const { db } = makeFakeDb([{ response: { rows: [] } }]);
    configureDecisionJournalTools({ db });
    const out = await decisionsRecentTool.handler({ limit: 3 }, baseCtx);
    expect(out.decisions).toEqual([]);
  });
});

describe('decisionsRecentTool — row mapping', () => {
  beforeEach(() => {
    __resetDecisionJournalToolsForTests();
  });

  it('maps a single row into the camelCase decision shape', async () => {
    const { db } = makeFakeDb([
      {
        response: {
          rows: [
            {
              id: 'dec-1',
              decided_by_kind: 'owner',
              decided_by_actor_id: 'usr-owner',
              decision_subject: 'rent.increase.propose',
              decision_subject_entity_kind: 'lease',
              decision_subject_entity_id: 'lease-1',
              rationale: 'Market drift +6%',
              confidence: '0.72',
              decided_at: '2026-05-29T08:00:00Z',
              scope_ids: ['scope-1'],
              status: 'committed',
            },
          ],
        },
      },
    ]);
    configureDecisionJournalTools({ db });
    const out = await decisionsRecentTool.handler({}, baseCtx);
    expect(out.decisions.length).toBe(1);
    const d = out.decisions[0]!;
    expect(d.id).toBe('dec-1');
    expect(d.decidedByKind).toBe('owner');
    expect(d.decisionSubject).toBe('rent.increase.propose');
    expect(d.decisionSubjectEntityKind).toBe('lease');
    expect(d.confidence).toBe(0.72);
    expect(d.scopeIds).toEqual(['scope-1']);
  });

  it('returns empty list when rows are empty', async () => {
    const { db } = makeFakeDb([{ response: { rows: [] } }]);
    configureDecisionJournalTools({ db });
    const out = await decisionsRecentTool.handler({ limit: 5 }, baseCtx);
    expect(out.decisions).toEqual([]);
  });
});

describe('decisionsSuccessRateTool — aggregation', () => {
  beforeEach(() => {
    __resetDecisionJournalToolsForTests();
  });

  it('computes success_rate = good / total to 3 decimal places', async () => {
    const { db } = makeFakeDb([
      {
        response: {
          rows: [
            { grade: 'good', n: 7 },
            { grade: 'neutral', n: 2 },
            { grade: 'bad', n: 1 },
          ],
        },
      },
    ]);
    configureDecisionJournalTools({ db });
    const out = await decisionsSuccessRateTool.handler({}, baseCtx);
    expect(out.totalGraded).toBe(10);
    expect(out.good).toBe(7);
    expect(out.neutral).toBe(2);
    expect(out.bad).toBe(1);
    expect(out.successRate).toBe(0.7);
  });

  it('returns 0 success_rate when no outcomes graded', async () => {
    const { db } = makeFakeDb([{ response: { rows: [] } }]);
    configureDecisionJournalTools({ db });
    const out = await decisionsSuccessRateTool.handler({}, baseCtx);
    expect(out.totalGraded).toBe(0);
    expect(out.successRate).toBe(0);
  });
});

describe('output schema validation', () => {
  it('explain output includes multi-currency observedValue + observedCurrency', () => {
    // Probe the descriptor's output schema — the explain tool's outcome
    // shape MUST carry observedCurrency (BossNyumba multi-currency
    // retailoring of Borjie's single-TZS observedValueTzs).
    const explain = DECISION_JOURNAL_TOOLS.find(
      (t) => t.id === 'decisions.explain',
    );
    expect(explain).toBeDefined();
    const result = explain!.outputSchema.safeParse({
      id: 'dec-1',
      decisionSubject: 'rent.increase.propose',
      decidedByKind: 'owner',
      decidedByActorId: 'usr-1',
      decidedValue: { increasePct: 7 },
      alternativesConsidered: [],
      rationale: 'Market drift +6%',
      confidence: 0.72,
      decidedAt: '2026-05-29T08:00:00Z',
      status: 'committed',
      outcome: {
        grade: 'good',
        summary: 'Tenant accepted',
        observedValue: 50000,
        observedCurrency: 'KES',
        learnings: 'Comp data was tight',
        recordedBy: 'reconciler',
        observedAt: '2026-06-29T08:00:00Z',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('input schema validation', () => {
  it('rejects bad UUID in explain', () => {
    const explain = DECISION_JOURNAL_TOOLS.find(
      (t) => t.id === 'decisions.explain',
    );
    const result = explain!.inputSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects search query < 2 chars', () => {
    const search = DECISION_JOURNAL_TOOLS.find(
      (t) => t.id === 'decisions.search',
    );
    const result = search!.inputSchema.safeParse({ query: 'a' });
    expect(result.success).toBe(false);
  });
});
