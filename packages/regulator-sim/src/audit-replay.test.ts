/**
 * Audit-replay invariant tests: clean pass, the date window, and each of the
 * seven findings, plus multi-finding accumulation in one pass.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWED_REASON_CODES,
  replayAudit,
  summarizeAudit,
  type AuditReplayInput,
  type DecisionRecord,
} from './index.js';

const NOW = '2026-06-03T12:00:00.000Z';

function goodRecord(over: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    decisionId: 'dec-1',
    domain: 'rent',
    decidedAt: '2026-06-02T09:00:00.000Z',
    outcome: 'approve',
    cotTrace: 'cot-hash-abc',
    reasonCodes: ['RENT_RECONCILED'],
    reasonNotesEn: 'Rent reconciled against the ledger.',
    reasonNotesSw: 'Kodi imelinganishwa na leja.',
    modelId: 'mwikila-rent-v3',
    modelCardVersion: '3.1',
    modelCardCurrentAt: '2026-05-20T00:00:00.000Z',
    fairnessTpDelta: 0.02,
    fairnessFpDelta: 0.01,
    crossOrgAction: false,
    approverIds: ['officer-a'],
    ...over,
  };
}

const baseInput = (records: ReadonlyArray<DecisionRecord>): AuditReplayInput => ({
  fromIso: '2026-06-01T00:00:00.000Z',
  toIso: '2026-06-03T00:00:00.000Z',
  records,
  fairnessTolerance: 0.1,
  registeredModelIds: ['mwikila-rent-v3'],
  allowedReasonCodes: [...DEFAULT_ALLOWED_REASON_CODES],
  modelCardMaxAgeDays: 90,
});

describe('replayAudit — clean pass', () => {
  it('passes a fully compliant in-window record', () => {
    const res = replayAudit(baseInput([goodRecord()]), NOW);
    expect(res.passed).toBe(true);
    expect(res.recordsReplayed).toBe(1);
    expect(res.findings).toHaveLength(0);
    expect(summarizeAudit(res)).toMatch(/PASS/);
  });

  it('ignores records outside the date window', () => {
    const out = goodRecord({
      decisionId: 'dec-old',
      decidedAt: '2025-01-01T00:00:00.000Z',
    });
    const res = replayAudit(baseInput([out]), NOW);
    expect(res.recordsReplayed).toBe(0);
    expect(res.passed).toBe(true);
  });
});

describe('replayAudit — findings', () => {
  it('flags a missing chain-of-thought trace as critical', () => {
    const res = replayAudit(baseInput([goodRecord({ cotTrace: '  ' })]), NOW);
    expect(res.passed).toBe(false);
    expect(res.findings[0]?.code).toBe('missing_cot');
    expect(res.findings[0]?.severity).toBe('critical');
  });

  it('flags missing Swahili notes (bilingual requirement)', () => {
    const res = replayAudit(baseInput([goodRecord({ reasonNotesSw: '' })]), NOW);
    expect(res.findings.some((f) => f.code === 'missing_bilingual_notes')).toBe(true);
  });

  it('flags an unregistered model', () => {
    const res = replayAudit(baseInput([goodRecord({ modelId: 'rogue-model' })]), NOW);
    expect(res.findings.some((f) => f.code === 'unknown_model')).toBe(true);
  });

  it('flags a stale model card', () => {
    const res = replayAudit(
      baseInput([goodRecord({ modelCardCurrentAt: '2026-01-01T00:00:00.000Z' })]),
      NOW,
    );
    expect(res.findings.some((f) => f.code === 'stale_model_card')).toBe(true);
  });

  it('flags a disallowed reason code', () => {
    const res = replayAudit(
      baseInput([goodRecord({ reasonCodes: ['MADE_UP_CODE'] })]),
      NOW,
    );
    expect(res.findings.some((f) => f.code === 'disallowed_reason_code')).toBe(true);
  });

  it('flags a cross-org action without two distinct approvers', () => {
    const res = replayAudit(
      baseInput([
        goodRecord({ crossOrgAction: true, approverIds: ['officer-a', 'officer-a'] }),
      ]),
      NOW,
    );
    expect(res.findings.some((f) => f.code === 'missing_four_eye')).toBe(true);
  });

  it('passes a cross-org action with two distinct approvers', () => {
    const res = replayAudit(
      baseInput([
        goodRecord({ crossOrgAction: true, approverIds: ['officer-a', 'officer-b'] }),
      ]),
      NOW,
    );
    expect(res.passed).toBe(true);
  });

  it('flags a fairness breach beyond tolerance', () => {
    const res = replayAudit(baseInput([goodRecord({ fairnessTpDelta: 0.25 })]), NOW);
    expect(res.findings.some((f) => f.code === 'fairness_breach')).toBe(true);
  });

  it('accumulates multiple findings in one pass without throwing', () => {
    const res = replayAudit(
      baseInput([
        goodRecord({
          cotTrace: '',
          reasonNotesSw: '',
          modelId: 'rogue',
          fairnessFpDelta: 0.9,
        }),
      ]),
      NOW,
    );
    expect(res.findings.length).toBeGreaterThanOrEqual(4);
    expect(summarizeAudit(res)).toMatch(/FAIL/);
  });
});
