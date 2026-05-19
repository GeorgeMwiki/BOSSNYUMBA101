import { describe, expect, it } from 'vitest';

import {
  ALL_FIXTURES,
  buildObservation,
  InvalidObservationError,
  type ObservationSourceKind,
} from '../observations/index.js';

const VALID_SEED = {
  tenantId: 't1',
  entityId: 'e1',
  entityKind: 'employee',
  attributeKey: 'phone',
  observedValue: '+254700000000',
  source: { kind: 'chat-text' as ObservationSourceKind, ref: 'msg_1', confidence: 0.8, observedAt: '2026-05-19T00:00:00Z' },
  evidence: [{ kind: 'chat-message' as const, identifier: 'msg_1', hash: 'a'.repeat(64) }],
};

describe('observations · buildObservation', () => {
  it('freezes a valid observation', () => {
    const obs = buildObservation(VALID_SEED);
    expect(Object.isFrozen(obs)).toBe(true);
    expect(Object.isFrozen(obs.source)).toBe(true);
    expect(Object.isFrozen(obs.evidence)).toBe(true);
    expect(obs.attributeKey).toBe('phone');
  });

  it('rejects empty tenantId', () => {
    expect(() => buildObservation({ ...VALID_SEED, tenantId: '' })).toThrow(InvalidObservationError);
  });

  it('rejects empty attributeKey', () => {
    expect(() => buildObservation({ ...VALID_SEED, attributeKey: '   ' })).toThrow(InvalidObservationError);
  });

  it('rejects unknown source kind', () => {
    const bad = { ...VALID_SEED, source: { ...VALID_SEED.source, kind: 'mystery' as ObservationSourceKind } };
    expect(() => buildObservation(bad)).toThrow(InvalidObservationError);
  });

  it('rejects source.confidence outside [0,1]', () => {
    const bad = { ...VALID_SEED, source: { ...VALID_SEED.source, confidence: 1.5 } };
    expect(() => buildObservation(bad)).toThrow(InvalidObservationError);
    const bad2 = { ...VALID_SEED, source: { ...VALID_SEED.source, confidence: -0.1 } };
    expect(() => buildObservation(bad2)).toThrow(InvalidObservationError);
  });

  it('rejects non-ISO observedAt', () => {
    const bad = { ...VALID_SEED, source: { ...VALID_SEED.source, observedAt: 'yesterday' } };
    expect(() => buildObservation(bad)).toThrow(InvalidObservationError);
  });

  it('rejects empty evidence list', () => {
    expect(() => buildObservation({ ...VALID_SEED, evidence: [] })).toThrow(InvalidObservationError);
  });

  it('rejects malformed evidence hash', () => {
    const bad = { ...VALID_SEED, evidence: [{ kind: 'chat-message' as const, identifier: 'msg_1', hash: 'not-a-hash' }] };
    expect(() => buildObservation(bad)).toThrow(InvalidObservationError);
  });
});

describe('observations · fixtures', () => {
  it('provides 12 fixtures across 6 source kinds', () => {
    expect(ALL_FIXTURES).toHaveLength(12);
    const kinds = new Set(ALL_FIXTURES.map((o) => o.source.kind));
    expect(kinds.size).toBe(6);
  });

  it('all fixtures are frozen and carry evidence', () => {
    for (const obs of ALL_FIXTURES) {
      expect(Object.isFrozen(obs)).toBe(true);
      expect(obs.evidence.length).toBeGreaterThan(0);
    }
  });

  it('every kind has at least 2 fixtures', () => {
    const counts = new Map<string, number>();
    for (const obs of ALL_FIXTURES) {
      counts.set(obs.source.kind, (counts.get(obs.source.kind) ?? 0) + 1);
    }
    for (const [, n] of counts) expect(n).toBeGreaterThanOrEqual(2);
  });
});
