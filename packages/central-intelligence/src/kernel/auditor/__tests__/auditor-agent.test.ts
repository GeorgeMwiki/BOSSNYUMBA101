/**
 * Auditor Agent — unit tests.
 *
 * Pins the contract the api-gateway composition root + the four-eye
 * queue rely on:
 *
 *   Stage 1 (deterministic, side-effect-free):
 *   1. evidence_ids empty → auto-reject + remediation in en + sw.
 *   2. binding=true without confidence → auto-reject.
 *   3. binding=true with confidence below floor → auto-reject.
 *   4. binding=true with confidence at/above floor + non-empty
 *      evidence_ids → Stage-1 passes; no counter-model wired ->
 *      approve.
 *   5. non-binding rec with non-empty evidence_ids → approve.
 *   6. confidenceFloor override per-call is respected.
 *   7. zero side effects: no DB stub needed (compile-time + runtime).
 *
 *   Stage 2 (counter-model port):
 *   8. counter-model approves → verdict=approve,
 *      counter_model_agrees=true.
 *   9. counter-model rejects → verdict=reject,
 *      counter_model_agrees=false.
 *   10. counter-model crashes → fail-closed to needs_human, NOT
 *       approve.
 *
 *   Bilingual surface:
 *   11. every reject output carries non-empty reason_en + reason_sw.
 *   12. AUDITOR_REJECTION_COPY exposes en + sw + remediation_en +
 *       remediation_sw for each rejection kind.
 *
 *   Pure-validator invariants:
 *   13. audit_log_id is generated deterministically when a generator
 *       is injected (allows the api-gateway to mint hash-chain ids).
 *   14. AUDITOR_SYSTEM_PROMPT mentions the evidence-chain hard rule.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createAuditorAgent,
  AUDITOR_REJECTION_COPY,
  AUDITOR_SYSTEM_PROMPT,
  DEFAULT_CONFIDENCE_FLOOR,
  type AuditorCounterModelPort,
  type AuditorInput,
  type RecommendationToAudit,
} from '../auditor-agent';

function baseRec(
  overrides: Partial<RecommendationToAudit> = {},
): RecommendationToAudit {
  return {
    origin_junior: 'arrears-chaser',
    recommendation_id: 'rec_001',
    payload: { tenantId: 't_demo' },
    evidence_ids: ['lease_pdf_42'],
    confidence: 0.85,
    binding: false,
    ...overrides,
  };
}

function baseInput(
  recOverrides: Partial<RecommendationToAudit> = {},
  inputOverrides: Partial<AuditorInput> = {},
): AuditorInput {
  return {
    tenantId: 't_demo',
    recommendation: baseRec(recOverrides),
    ...inputOverrides,
  };
}

const FIXED_AUDIT_ID = 'audit_fixed_test_id';

function fixedIdGenerator(): () => string {
  return () => FIXED_AUDIT_ID;
}

describe('createAuditorAgent — Stage 1 (deterministic)', () => {
  it('auto-rejects when evidence_ids is empty', async () => {
    const auditor = createAuditorAgent({
      auditLogIdGenerator: fixedIdGenerator(),
    });
    const out = await auditor.evaluate(
      baseInput({ evidence_ids: [] }),
    );
    expect(out.verdict).toBe('reject');
    expect(out.missing_evidence).toContain('evidence_ids');
    expect(out.counter_model_agrees).toBe(false);
    expect(out.audit_log_id).toBe(FIXED_AUDIT_ID);
    expect(out.required_actions.length).toBeGreaterThan(0);
  });

  it('emits bilingual reason on empty-evidence reject', async () => {
    const auditor = createAuditorAgent();
    const out = await auditor.evaluate(
      baseInput({ evidence_ids: [] }),
    );
    expect(out.reason_en).toBe(AUDITOR_REJECTION_COPY.empty_evidence.en);
    expect(out.reason_sw).toBe(AUDITOR_REJECTION_COPY.empty_evidence.sw);
    expect(out.reason_en.length).toBeGreaterThan(0);
    expect(out.reason_sw.length).toBeGreaterThan(0);
  });

  it('auto-rejects a binding action that omits confidence', async () => {
    const auditor = createAuditorAgent();
    const out = await auditor.evaluate(
      baseInput({ binding: true, confidence: undefined }),
    );
    expect(out.verdict).toBe('reject');
    expect(out.missing_evidence).toContain('confidence');
    expect(out.reason_en).toBe(
      AUDITOR_REJECTION_COPY.binding_missing_confidence.en,
    );
    expect(out.reason_sw).toBe(
      AUDITOR_REJECTION_COPY.binding_missing_confidence.sw,
    );
  });

  it('auto-rejects a binding action below the confidence floor', async () => {
    const auditor = createAuditorAgent();
    const out = await auditor.evaluate(
      baseInput({ binding: true, confidence: 0.5 }),
    );
    expect(out.verdict).toBe('reject');
    expect(out.missing_evidence).toContain('confidence_above_floor');
    expect(out.reason_en).toBe(
      AUDITOR_REJECTION_COPY.binding_low_confidence.en,
    );
    expect(out.reason_sw).toBe(
      AUDITOR_REJECTION_COPY.binding_low_confidence.sw,
    );
  });

  it('approves a binding action at the floor when evidence is present', async () => {
    const auditor = createAuditorAgent();
    const out = await auditor.evaluate(
      baseInput({ binding: true, confidence: DEFAULT_CONFIDENCE_FLOOR }),
    );
    expect(out.verdict).toBe('approve');
    expect(out.missing_evidence).toEqual([]);
    expect(out.evidence_ids).toContain('lease_pdf_42');
  });

  it('approves a non-binding rec with non-empty evidence_ids', async () => {
    const auditor = createAuditorAgent();
    const out = await auditor.evaluate(baseInput());
    expect(out.verdict).toBe('approve');
    expect(out.reason_en).toBe(AUDITOR_REJECTION_COPY.approve.en);
    expect(out.reason_sw).toBe(AUDITOR_REJECTION_COPY.approve.sw);
  });

  it('respects a per-call confidenceFloor override', async () => {
    const auditor = createAuditorAgent();
    // Confidence 0.6, default floor 0.7 → reject WITHOUT override.
    const reject = await auditor.evaluate(
      baseInput({ binding: true, confidence: 0.6 }),
    );
    expect(reject.verdict).toBe('reject');
    // Same rec, override floor down to 0.5 → approve.
    const approve = await auditor.evaluate(
      baseInput({ binding: true, confidence: 0.6 }, { confidenceFloor: 0.5 }),
    );
    expect(approve.verdict).toBe('approve');
  });

  it('is a pure validator — no DB / sink ports required', async () => {
    // The factory takes ZERO mandatory deps. If a hidden side effect
    // crept in, this test would either throw or hang. The fact that
    // we can drive a full evaluate() with `{}` args is the
    // pure-validator invariant.
    const auditor = createAuditorAgent({});
    const out = await auditor.evaluate(baseInput());
    expect(out.verdict).toBe('approve');
  });
});

describe('createAuditorAgent — Stage 2 (counter-model)', () => {
  function approvingCounterModel(): AuditorCounterModelPort {
    return {
      review: vi.fn(async () => ({
        verdict: 'approve' as const,
        missing_evidence: [],
        rationale: 'counter-model: clean evidence chain',
        confidence: 0.91,
      })),
    };
  }

  function rejectingCounterModel(): AuditorCounterModelPort {
    return {
      review: vi.fn(async () => ({
        verdict: 'reject' as const,
        missing_evidence: ['village_minute'],
        rationale: 'counter-model: missing village_minute',
        confidence: 0.88,
      })),
    };
  }

  function crashingCounterModel(message: string): AuditorCounterModelPort {
    return {
      review: vi.fn(async () => {
        throw new Error(message);
      }),
    };
  }

  it('returns approve when counter-model approves', async () => {
    const auditor = createAuditorAgent({
      counterModel: approvingCounterModel(),
    });
    const out = await auditor.evaluate(baseInput());
    expect(out.verdict).toBe('approve');
    expect(out.counter_model_agrees).toBe(true);
    expect(out.confidence).toBeCloseTo(0.91);
  });

  it('returns reject when counter-model rejects, surfacing the missing-evidence list', async () => {
    const auditor = createAuditorAgent({
      counterModel: rejectingCounterModel(),
    });
    const out = await auditor.evaluate(baseInput());
    expect(out.verdict).toBe('reject');
    expect(out.counter_model_agrees).toBe(false);
    expect(out.missing_evidence).toContain('village_minute');
  });

  it('fails closed to needs_human when the counter-model crashes', async () => {
    const auditor = createAuditorAgent({
      counterModel: crashingCounterModel('upstream timeout'),
    });
    const out = await auditor.evaluate(baseInput());
    expect(out.verdict).toBe('needs_human');
    expect(out.counter_model_agrees).toBe(false);
    expect(out.rationale).toContain('upstream timeout');
  });

  it('skips Stage 2 entirely on a Stage-1 reject', async () => {
    const port = approvingCounterModel();
    const auditor = createAuditorAgent({ counterModel: port });
    const out = await auditor.evaluate(
      baseInput({ evidence_ids: [] }),
    );
    expect(out.verdict).toBe('reject');
    expect(port.review).not.toHaveBeenCalled();
  });
});

describe('AUDITOR_REJECTION_COPY + AUDITOR_SYSTEM_PROMPT', () => {
  it('exposes en + sw + remediation_en + remediation_sw for every rejection kind', () => {
    for (const kind of Object.keys(AUDITOR_REJECTION_COPY) as Array<
      keyof typeof AUDITOR_REJECTION_COPY
    >) {
      const copy = AUDITOR_REJECTION_COPY[kind];
      expect(copy.en).toBeTruthy();
      expect(copy.sw).toBeTruthy();
      // remediation may be empty for the approve copy; other kinds
      // must offer a remediation hint in both languages.
      if (kind !== 'approve') {
        expect(copy.remediation_en.length).toBeGreaterThan(0);
        expect(copy.remediation_sw.length).toBeGreaterThan(0);
      }
    }
  });

  it('system prompt mentions the evidence-chain hard rule', () => {
    expect(AUDITOR_SYSTEM_PROMPT).toMatch(/evidence_ids/);
    expect(AUDITOR_SYSTEM_PROMPT).toMatch(/Auto-reject/);
    expect(AUDITOR_SYSTEM_PROMPT).toMatch(/binding/);
  });

  it('default confidence floor is the 0.7 the upstream Borjie auditor uses', () => {
    expect(DEFAULT_CONFIDENCE_FLOOR).toBeCloseTo(0.7);
  });
});
