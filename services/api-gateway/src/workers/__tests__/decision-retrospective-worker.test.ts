/**
 * Decision retrospective worker — tick logic tests.
 *
 * Verifies grade mapping, learnings text (multi-currency), soft-grade
 * fallback for unpredicted decisions, and tick orchestration with a
 * fake recorder.
 */

import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import {
  createDecisionRetrospectiveWorker,
  gradeFromReconciliation,
  buildLearningsText,
  softGradeForUnpredictedDecision,
} from '../decision-retrospective-worker.js';
import type { DecisionRecorder } from '../../services/decision-journal/index.js';

const SILENT_LOGGER = pino({ level: 'silent' });

describe('gradeFromReconciliation', () => {
  it('matched maps to good', () => {
    expect(gradeFromReconciliation('matched', 0.1, 100)).toBe('good');
  });

  it('divergent + high drift maps to bad', () => {
    expect(gradeFromReconciliation('divergent', 0.6, 100)).toBe('bad');
  });

  it('divergent + negative observed maps to bad', () => {
    expect(gradeFromReconciliation('divergent', 0.2, -50)).toBe('bad');
  });

  it('divergent + benign drift maps to neutral', () => {
    expect(gradeFromReconciliation('divergent', 0.2, 100)).toBe('neutral');
  });

  it('null status maps to undetermined', () => {
    expect(gradeFromReconciliation(null, null, null)).toBe('undetermined');
  });
});

describe('buildLearningsText — multi-currency', () => {
  it('formats observed value with KES', () => {
    const out = buildLearningsText(
      'rent.increase.propose',
      'good',
      0.1,
      50_000,
      'KES',
      null,
    );
    expect(out).toContain('KES 50,000');
  });

  it('formats observed value with USD when bad', () => {
    const out = buildLearningsText(
      'capex.expense',
      'bad',
      0.6,
      -10_000,
      'USD',
      null,
    );
    expect(out).toContain('USD 10,000');
    expect(out).toContain('cost');
  });

  it('defaults to TZS when currency null', () => {
    const out = buildLearningsText(
      'lease.renewal.draft',
      'neutral',
      0.2,
      100,
      null,
      null,
    );
    expect(out).toContain('TZS 100');
  });
});

describe('softGradeForUnpredictedDecision', () => {
  it('returns undetermined', () => {
    expect(softGradeForUnpredictedDecision()).toBe('undetermined');
  });
});

describe('createDecisionRetrospectiveWorker.tickOnce', () => {
  function makeDb(rows: Array<Record<string, unknown>>) {
    const calls: unknown[] = [];
    return {
      calls,
      async execute(q: unknown) {
        calls.push(q);
        // First SELECT returns the pending rows; transaction-control +
        // tenant-context SQL returns empty.
        if (calls.length === 1) return { rows };
        return { rows: [] };
      },
    };
  }

  function makeRecorder(): {
    recorder: DecisionRecorder;
    outcomes: unknown[];
  } {
    const outcomes: unknown[] = [];
    const recorder: DecisionRecorder = {
      async recordDecision() {
        throw new Error('not used');
      },
      async recordOutcome(input) {
        outcomes.push(input);
        return Object.freeze({
          id: 'out-1',
          tenantId: input.tenantId,
          decisionId: input.decisionId,
          outcomeSummary: input.outcomeSummary,
          observedValue: input.observedValue ?? null,
          observedCurrency: input.observedCurrency ?? 'TZS',
          observedAt: input.observedAt ?? '2026-05-29T00:00:00Z',
          retrospectiveGrade: input.retrospectiveGrade,
          learnings: input.learnings ?? null,
          recordedBy: input.recordedBy,
          entryHash: 'h',
          prevHash: null,
        });
      },
      async recordLink() {
        throw new Error('not used');
      },
    };
    return { recorder, outcomes };
  }

  it('grades pending decisions and recorder is called once per row', async () => {
    const db = makeDb([
      {
        id: '11111111-1111-1111-1111-111111111111',
        tenant_id: 'tnt-1',
        decision_subject: 'rent.increase.propose',
        related_prediction_id: 'pred-1',
        decided_at: '2026-04-29T00:00:00Z',
        reconciliation_status: 'matched',
        drift_score: '0.10',
        observed_value: '50000',
        observed_currency: 'KES',
        observed_outcome_summary: 'Tenant accepted increase.',
      },
    ]);
    const { recorder, outcomes } = makeRecorder();
    const worker = createDecisionRetrospectiveWorker({
      db,
      logger: SILENT_LOGGER,
      recorder,
      enabled: false,
    });
    const result = await worker.tickOnce();
    expect(result.considered).toBe(1);
    expect(result.graded).toBe(1);
    expect(outcomes.length).toBe(1);
    const out = outcomes[0] as Record<string, unknown>;
    expect(out['retrospectiveGrade']).toBe('good');
    expect(out['observedCurrency']).toBe('KES');
  });

  it('skips rows with empty id/tenantId', async () => {
    const db = makeDb([
      {
        id: '',
        tenant_id: '',
        decision_subject: 'x',
        related_prediction_id: null,
        decided_at: '2026-04-29T00:00:00Z',
        reconciliation_status: null,
        drift_score: null,
        observed_value: null,
        observed_currency: null,
        observed_outcome_summary: null,
      },
    ]);
    const { recorder, outcomes } = makeRecorder();
    const worker = createDecisionRetrospectiveWorker({
      db,
      logger: SILENT_LOGGER,
      recorder,
      enabled: false,
    });
    const result = await worker.tickOnce();
    expect(result.considered).toBe(1);
    expect(result.skipped).toBe(1);
    expect(outcomes.length).toBe(0);
  });

  it('marks failed when recorder throws', async () => {
    const db = makeDb([
      {
        id: '22222222-2222-2222-2222-222222222222',
        tenant_id: 'tnt-1',
        decision_subject: 'x',
        related_prediction_id: 'pred-2',
        decided_at: '2026-04-29T00:00:00Z',
        reconciliation_status: 'matched',
        drift_score: '0.10',
        observed_value: '100',
        observed_currency: 'TZS',
        observed_outcome_summary: null,
      },
    ]);
    const recorder: DecisionRecorder = {
      async recordDecision() {
        throw new Error('not used');
      },
      async recordOutcome() {
        throw new Error('boom');
      },
      async recordLink() {
        throw new Error('not used');
      },
    };
    const worker = createDecisionRetrospectiveWorker({
      db,
      logger: SILENT_LOGGER,
      recorder,
      enabled: false,
    });
    const result = await worker.tickOnce();
    expect(result.failed).toBe(1);
  });
});

describe('start/stop lifecycle', () => {
  it('does not arm when enabled=false', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const worker = createDecisionRetrospectiveWorker({
      db: { async execute() { return { rows: [] }; } },
      logger: SILENT_LOGGER,
      recorder: {
        async recordDecision() {
          throw new Error('not used');
        },
        async recordOutcome() {
          throw new Error('not used');
        },
        async recordLink() {
          throw new Error('not used');
        },
      },
      enabled: false,
    });
    worker.start();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    worker.stop();
    setIntervalSpy.mockRestore();
  });
});
