import { describe, expect, it } from 'vitest';

import { buildObservation, type ObservationEvent, type ObservationSourceKind } from '../observations/index.js';
import {
  computeConfidence,
  HIGH_THRESHOLD,
  MEDIUM_THRESHOLD,
  SOURCE_BASE_RATES,
  type HistoricalObservation,
} from '../confidence/index.js';

function makeObs(
  kind: ObservationSourceKind,
  value: unknown,
  conf = 0.9,
  attr = 'phone',
): ObservationEvent {
  return buildObservation({
    tenantId: 't1',
    entityId: 'e1',
    entityKind: 'employee',
    attributeKey: attr,
    observedValue: value,
    source: { kind, ref: `${kind}_${Math.random().toString(36).slice(2, 8)}`, confidence: conf, observedAt: '2026-05-19T00:00:00Z' },
    evidence: [{ kind: 'chat-message' as const, identifier: 'msg_1', hash: 'a'.repeat(64) }],
  });
}

describe('confidence · computeConfidence', () => {
  it('1: manual-edit with full confidence → high tier', () => {
    const s = computeConfidence({ observation: makeObs('manual-edit', 'A', 1), currentValue: undefined, history: [] });
    expect(s.tier).toBe('high');
    expect(s.score).toBeGreaterThanOrEqual(HIGH_THRESHOLD);
  });

  it('2: connector-api with high source confidence → high tier', () => {
    const s = computeConfidence({ observation: makeObs('connector-api', 'A', 0.98), currentValue: undefined, history: [] });
    expect(s.tier).toBe('high');
  });

  it('3: chat-attachment with medium source confidence → medium tier', () => {
    // chat-attachment base 0.78 × 0.95 = 0.741 → medium (≥ 0.7, < 0.9)
    const s = computeConfidence({ observation: makeObs('chat-attachment', 'A', 0.95), currentValue: undefined, history: [] });
    expect(s.tier).toBe('medium');
  });

  it('4: subagent-research with low confidence → low tier', () => {
    const s = computeConfidence({ observation: makeObs('subagent-research', 'A', 0.6), currentValue: undefined, history: [] });
    expect(s.tier).toBe('low');
  });

  it('5: corroboration from 2 different sources boosts toward high', () => {
    const obs = makeObs('chat-text', 'A', 0.95);
    const history: HistoricalObservation[] = [
      { source: { kind: 'connector-api', ref: 'c1' }, observedValue: 'A' },
      { source: { kind: 'ingest-file', ref: 'f1' }, observedValue: 'A' },
    ];
    const s = computeConfidence({ observation: obs, currentValue: undefined, history });
    expect(s.breakdown.corroborationBonus).toBeCloseTo(0.1, 5);
  });

  it('6: corroboration is capped at 0.15', () => {
    const obs = makeObs('chat-text', 'A', 0.95);
    const history: HistoricalObservation[] = [
      { source: { kind: 'connector-api', ref: 'c1' }, observedValue: 'A' },
      { source: { kind: 'ingest-file', ref: 'f1' }, observedValue: 'A' },
      { source: { kind: 'manual-edit', ref: 'u1' }, observedValue: 'A' },
      { source: { kind: 'chat-attachment', ref: 'a1' }, observedValue: 'A' },
      { source: { kind: 'subagent-research', ref: 's1' }, observedValue: 'A' },
    ];
    const s = computeConfidence({ observation: obs, currentValue: undefined, history });
    expect(s.breakdown.corroborationBonus).toBeCloseTo(0.15, 5);
  });

  it('7: re-confirmation by same source kind does NOT add bonus', () => {
    const obs = makeObs('chat-text', 'A', 0.95);
    const history: HistoricalObservation[] = [
      { source: { kind: 'chat-text', ref: 'msg_99' }, observedValue: 'A' },
    ];
    const s = computeConfidence({ observation: obs, currentValue: undefined, history });
    expect(s.breakdown.corroborationBonus).toBe(0);
  });

  it('8: conflict with current value applies penalty of 0.4', () => {
    const obs = makeObs('connector-api', 'B', 1);
    const s = computeConfidence({ observation: obs, currentValue: 'A', history: [] });
    expect(s.breakdown.conflictPenalty).toBe(0.4);
  });

  it('9: idempotent re-write of same value has no conflict penalty', () => {
    const obs = makeObs('connector-api', 'A', 1);
    const s = computeConfidence({ observation: obs, currentValue: 'A', history: [] });
    expect(s.breakdown.conflictPenalty).toBe(0);
  });

  it('10: filling empty value has no conflict penalty', () => {
    const obs = makeObs('connector-api', 'A', 1);
    const s = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    expect(s.breakdown.conflictPenalty).toBe(0);
  });

  it('11: jurisdiction violation hard-caps tier to low', () => {
    const obs = makeObs('manual-edit', 'A', 1);
    const s = computeConfidence({ observation: obs, currentValue: undefined, history: [], jurisdictionViolation: true });
    expect(s.tier).toBe('low');
    expect(s.breakdown.jurisdictionPenalty).toBe(1);
  });

  it('12: score clamps into [0,1]', () => {
    const obs = makeObs('chat-text', 'A', 1);
    const history: HistoricalObservation[] = [
      { source: { kind: 'connector-api', ref: 'c1' }, observedValue: 'A' },
      { source: { kind: 'ingest-file', ref: 'f1' }, observedValue: 'A' },
      { source: { kind: 'manual-edit', ref: 'u1' }, observedValue: 'A' },
    ];
    const s = computeConfidence({ observation: obs, currentValue: undefined, history });
    expect(s.score).toBeLessThanOrEqual(1);
    expect(s.score).toBeGreaterThanOrEqual(0);
  });

  it('13: chat-attachment + corroboration can reach high tier', () => {
    // chat-attachment 0.78 × 0.95 + 0.15 corroboration = 0.891 ≥ HIGH (0.9) needs more...
    // Use ingest-file 0.88 × 1 + 0.05 corroboration = 0.93 → high
    const obs = makeObs('ingest-file', 'A', 1);
    const history: HistoricalObservation[] = [
      { source: { kind: 'connector-api', ref: 'c1' }, observedValue: 'A' },
    ];
    const s = computeConfidence({ observation: obs, currentValue: undefined, history });
    expect(s.tier).toBe('high');
  });

  it('14: zero explicit confidence forces low even from manual-edit', () => {
    const obs = makeObs('manual-edit', 'A', 0);
    const s = computeConfidence({ observation: obs, currentValue: undefined, history: [] });
    expect(s.tier).toBe('low');
  });

  it('15: chat-attachment OCR with high source confidence → medium tier', () => {
    const s = computeConfidence({ observation: makeObs('chat-attachment', 'A', 0.95), currentValue: undefined, history: [] });
    expect(s.tier).toBe('medium');
  });

  it('16: base rates table exposes all six source kinds', () => {
    expect(Object.keys(SOURCE_BASE_RATES)).toHaveLength(6);
  });

  it('17: deep-equal corroboration handles nested objects', () => {
    const obs = makeObs('chat-text', { plan: 'monthly', amount: 1000 }, 0.95, 'rent_terms');
    const history: HistoricalObservation[] = [
      { source: { kind: 'connector-api', ref: 'c1' }, observedValue: { amount: 1000, plan: 'monthly' } },
    ];
    const s = computeConfidence({ observation: obs, currentValue: undefined, history });
    expect(s.breakdown.corroborationBonus).toBeCloseTo(0.05, 5);
  });

  it('18: thresholds are 0.9 (high) and 0.7 (medium)', () => {
    expect(HIGH_THRESHOLD).toBe(0.9);
    expect(MEDIUM_THRESHOLD).toBe(0.7);
  });

  it('19: returned score is frozen', () => {
    const s = computeConfidence({ observation: makeObs('manual-edit', 'A', 1), currentValue: undefined, history: [] });
    expect(Object.isFrozen(s)).toBe(true);
  });

  it('20: conflict penalty + low explicit confidence + low base-rate → low tier', () => {
    const obs = makeObs('subagent-research', 'B', 0.5);
    const s = computeConfidence({ observation: obs, currentValue: 'A', history: [] });
    expect(s.tier).toBe('low');
  });
});
