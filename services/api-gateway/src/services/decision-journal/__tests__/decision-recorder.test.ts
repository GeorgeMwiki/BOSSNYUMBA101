/**
 * Decision Recorder — unit tests with an in-memory DB double.
 */

import { describe, expect, it } from 'vitest';

import { createDecisionRecorder } from '../recorder.js';
import { DecisionRecorderError } from '../types.js';

interface FakeQuery {
  readonly queryChunks?: ReadonlyArray<unknown>;
}

/**
 * Walk a drizzle `sql` template object back into a flat raw string for
 * test routing. The object has `queryChunks` (StringChunk or Param)
 * entries; we recurse and stringify each.
 */
function flattenSql(q: unknown): string {
  if (q === null || q === undefined) return '';
  if (typeof q === 'string') return q;
  if (typeof q !== 'object') return String(q);
  const obj = q as { queryChunks?: ReadonlyArray<unknown>; value?: unknown };
  if (Array.isArray(obj.queryChunks)) {
    return obj.queryChunks.map(flattenSql).join(' ');
  }
  if ('value' in obj) return flattenSql(obj.value);
  return JSON.stringify(obj);
}

function fakeDb() {
  const decisions: Array<Record<string, unknown>> = [];
  const outcomes: Array<Record<string, unknown>> = [];
  const links: Array<Record<string, unknown>> = [];
  let decisionCounter = 0;

  return {
    decisions,
    outcomes,
    links,
    async execute(query: unknown) {
      const text = flattenSql(query);
      if (text.includes('FROM decisions') && text.includes('SELECT entry_hash')) {
        const last = decisions[decisions.length - 1];
        return last ? [{ entry_hash: last.entry_hash }] : [];
      }
      if (text.includes('FROM decision_outcomes') && text.includes('SELECT entry_hash')) {
        const last = outcomes[outcomes.length - 1];
        return last ? [{ entry_hash: last.entry_hash }] : [];
      }
      if (text.includes('FROM decision_links') && text.includes('SELECT entry_hash')) {
        const last = links[links.length - 1];
        return last ? [{ entry_hash: last.entry_hash }] : [];
      }
      if (text.includes('SELECT 1 FROM decisions')) {
        return decisions.length > 0 ? [{ '?column?': 1 }] : [];
      }
      if (text.includes('INSERT INTO decisions')) {
        decisionCounter += 1;
        const id = `00000000-0000-0000-0000-${String(decisionCounter).padStart(12, '0')}`;
        decisions.push({ id, entry_hash: `hash-${decisionCounter}` });
        return [{ id }];
      }
      if (text.includes('INSERT INTO decision_outcomes')) {
        const id = `00000001-0000-0000-0000-${String(outcomes.length + 1).padStart(12, '0')}`;
        outcomes.push({ id, entry_hash: `oh-${outcomes.length + 1}` });
        return [{ id }];
      }
      if (text.includes('INSERT INTO decision_links')) {
        links.push({ entry_hash: `lh-${links.length + 1}` });
        return [];
      }
      return [];
    },
  };
}

describe('createDecisionRecorder', () => {
  it('records a rent-increase decision and returns the chained row', async () => {
    const db = fakeDb();
    const recorder = createDecisionRecorder({ db, now: () => new Date('2026-05-29T00:00:00Z') });

    const recorded = await recorder.recordDecision({
      tenantId: 't_1',
      decidedByKind: 'owner',
      decidedByActorId: 'owner_1',
      decisionSubject: 'Rent increase Apr 2027: 5% or 7%',
      decisionSubjectEntityKind: 'lease',
      decisionSubjectEntityId: 'l_42',
      decidedValue: { choice: 'increase_5pct' },
      alternativesConsidered: [
        { option: { choice: 'increase_7pct' }, whyNot: 'tenant churn risk' },
      ],
      rationale: '5% matches local-market median while keeping the tenant',
      confidence: 0.78,
      scopeIds: ['nyumba_palace', 'unit_4b'],
    });

    expect(recorded.id).toMatch(/^00000000-0000-0000-0000-/);
    expect(recorded.entryHash.length).toBeGreaterThan(0);
    expect(recorded.prevHash).toBeNull();
    expect(recorded.decisionSubjectEntityKind).toBe('lease');
    expect(recorded.scopeIds).toEqual(['nyumba_palace', 'unit_4b']);
  });

  it('refuses invalid_input on short rationale', async () => {
    const db = fakeDb();
    const recorder = createDecisionRecorder({ db });

    await expect(
      recorder.recordDecision({
        tenantId: 't_1',
        decidedByKind: 'owner',
        decidedByActorId: 'owner_1',
        decisionSubject: 'subj',
        decidedValue: {},
        rationale: 'x',
      }),
    ).rejects.toBeInstanceOf(DecisionRecorderError);
  });

  it('records an outcome with currency tracked', async () => {
    const db = fakeDb();
    const recorder = createDecisionRecorder({ db });

    const decision = await recorder.recordDecision({
      tenantId: 't_1',
      decidedByKind: 'brain',
      decidedByActorId: 'brain_1',
      decisionSubject: 'Send maintenance crew to unit 4b',
      decidedValue: { contractorId: 'c_42' },
      rationale: 'fastest SLA and lowest quote',
    });

    const outcome = await recorder.recordOutcome({
      tenantId: 't_1',
      decisionId: decision.id,
      outcomeSummary: 'Crew finished within SLA, owner satisfied.',
      observedValue: 45000,
      observedCurrency: 'KES',
      retrospectiveGrade: 'good',
      recordedBy: 'reconciler',
    });

    expect(outcome.observedValue).toBe(45000);
    expect(outcome.observedCurrency).toBe('KES');
    expect(outcome.retrospectiveGrade).toBe('good');
  });

  it('rejects outcome for unknown decision', async () => {
    const db = fakeDb();
    const recorder = createDecisionRecorder({ db });

    await expect(
      recorder.recordOutcome({
        tenantId: 't_1',
        decisionId: '11111111-1111-1111-1111-111111111111',
        outcomeSummary: 'unknown',
        retrospectiveGrade: 'good',
        recordedBy: 'reconciler',
      }),
    ).rejects.toBeInstanceOf(DecisionRecorderError);
  });

  it('rejects ISO currency that is not 3-letter A-Z', async () => {
    const db = fakeDb();
    const recorder = createDecisionRecorder({ db });

    const decision = await recorder.recordDecision({
      tenantId: 't_1',
      decidedByKind: 'brain',
      decidedByActorId: 'brain_1',
      decisionSubject: 'currency check',
      decidedValue: {},
      rationale: 'currency-check rationale',
    });

    await expect(
      recorder.recordOutcome({
        tenantId: 't_1',
        decisionId: decision.id,
        outcomeSummary: 'currency-check',
        observedValue: 100,
        observedCurrency: 'usd',
        retrospectiveGrade: 'good',
        recordedBy: 'reconciler',
      }),
    ).rejects.toBeInstanceOf(DecisionRecorderError);
  });

  it('records a link between two decisions', async () => {
    const db = fakeDb();
    const recorder = createDecisionRecorder({ db });

    const a = await recorder.recordDecision({
      tenantId: 't_1',
      decidedByKind: 'owner',
      decidedByActorId: 'owner_1',
      decisionSubject: 'subject A',
      decidedValue: {},
      rationale: 'rationale A',
    });
    const b = await recorder.recordDecision({
      tenantId: 't_1',
      decidedByKind: 'owner',
      decidedByActorId: 'owner_1',
      decisionSubject: 'subject B',
      decidedValue: {},
      rationale: 'rationale B',
    });

    const link = await recorder.recordLink({
      tenantId: 't_1',
      sourceDecisionId: a.id,
      targetDecisionId: b.id,
      relationship: 'supersedes',
      note: 'B supersedes A',
    });

    expect(link.relationship).toBe('supersedes');
    expect(link.entryHash.length).toBeGreaterThan(0);
  });

  it('rejects a self-loop link', async () => {
    const db = fakeDb();
    const recorder = createDecisionRecorder({ db });

    await expect(
      recorder.recordLink({
        tenantId: 't_1',
        sourceDecisionId: '11111111-1111-1111-1111-111111111111',
        targetDecisionId: '11111111-1111-1111-1111-111111111111',
        relationship: 'supersedes',
      }),
    ).rejects.toBeInstanceOf(DecisionRecorderError);
  });
});
