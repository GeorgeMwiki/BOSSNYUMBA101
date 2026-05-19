import { describe, expect, it } from 'vitest';

import {
  heuristicSynthesizer,
  isDueForSynthesis,
  synthesizeReflection,
  type J1ReflectionStore,
} from '../memory/reflection-synth.js';
import type { CoreBlock, KGEdge, ReflectionSynthesis } from '../types.js';

function makeStore(): J1ReflectionStore & { peek(): readonly ReflectionSynthesis[] } {
  const items: ReflectionSynthesis[] = [];
  return {
    put(r) {
      items.push(r);
    },
    listForSubject(t, id) {
      return items.filter((i) => i.subjectType === t && i.subjectId === id);
    },
    peek() {
      return items;
    },
  };
}

function coreBlock(id: string, text: string): CoreBlock {
  return {
    id,
    kind: 'project',
    text,
    tokens: Math.ceil(text.length / 4),
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  };
}

function edge(
  id: string,
  subjectId: string,
  predicate: string,
  objectId: string,
): KGEdge {
  return {
    id,
    subjectId,
    predicate,
    objectId,
    properties: {},
    validFrom: '2026-05-01T00:00:00Z',
    validTo: null,
    invalidatedAt: null,
    invalidationReason: null,
    createdAt: '2026-05-01T00:00:00Z',
  };
}

describe('ReflectionSynth — Generative-Agents periodic reflection', () => {
  it('isDueForSynthesis is true when last run is null', () => {
    expect(isDueForSynthesis(null)).toBe(true);
  });

  it('isDueForSynthesis is false when last run is recent', () => {
    expect(
      isDueForSynthesis(
        new Date(Date.now() - 60_000).toISOString(),
        new Date().toISOString(),
        24,
      ),
    ).toBe(false);
  });

  it('isDueForSynthesis is true after 25 hours', () => {
    expect(
      isDueForSynthesis(
        new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString(),
        24,
      ),
    ).toBe(true);
  });

  it('synthesizeReflection persists a reflection to the store', async () => {
    const store = makeStore();
    const reflection = await synthesizeReflection(
      { synthesizer: heuristicSynthesizer, store },
      {
        subjectType: 'tenant',
        subjectId: 't-001',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-05-01T00:00:00Z',
        coreBlocks: [coreBlock('c1', 'observation A')],
        recentFacts: [
          edge('e1', 't-001', 'paid_late', 'lease-1'),
          edge('e2', 't-001', 'requested_repair', 'unit-1'),
        ],
      },
    );
    expect(reflection.summary).toContain('t-001');
    expect(reflection.importance).toBeGreaterThan(0);
    expect(store.peek()).toHaveLength(1);
  });

  it('rejects empty input', async () => {
    const store = makeStore();
    await expect(
      synthesizeReflection(
        { synthesizer: heuristicSynthesizer, store },
        {
          subjectType: 'tenant',
          subjectId: 't-X',
          periodStart: '2026-04-01T00:00:00Z',
          periodEnd: '2026-05-01T00:00:00Z',
          coreBlocks: [],
          recentFacts: [],
        },
      ),
    ).rejects.toThrow(/empty input/);
  });

  it('rejects empty summary from synthesizer', async () => {
    const store = makeStore();
    await expect(
      synthesizeReflection(
        {
          synthesizer: () => ({ summary: '   ', importance: 0.5 }),
          store,
        },
        {
          subjectType: 'tenant',
          subjectId: 't-X',
          periodStart: '2026-04-01T00:00:00Z',
          periodEnd: '2026-05-01T00:00:00Z',
          coreBlocks: [coreBlock('c1', 'x')],
          recentFacts: [],
        },
      ),
    ).rejects.toThrow(/empty summary/);
  });

  it('clamps importance to [0,1]', async () => {
    const store = makeStore();
    const r = await synthesizeReflection(
      {
        synthesizer: () => ({ summary: 'ok', importance: 5 }),
        store,
      },
      {
        subjectType: 'tenant',
        subjectId: 't-X',
        periodStart: '2026-04-01T00:00:00Z',
        periodEnd: '2026-05-01T00:00:00Z',
        coreBlocks: [coreBlock('c1', 'x')],
        recentFacts: [],
      },
    );
    expect(r.importance).toBe(1);
  });

  it('heuristicSynthesizer importance grows with predicate diversity', () => {
    const sparse = heuristicSynthesizer({
      subjectType: 'tenant',
      subjectId: 't',
      periodStart: '2026-04-01T00:00:00Z',
      periodEnd: '2026-05-01T00:00:00Z',
      coreBlocks: [],
      recentFacts: [edge('e1', 't', 'a', 'o')],
    });
    const dense = heuristicSynthesizer({
      subjectType: 'tenant',
      subjectId: 't',
      periodStart: '2026-04-01T00:00:00Z',
      periodEnd: '2026-05-01T00:00:00Z',
      coreBlocks: [],
      recentFacts: [
        edge('e1', 't', 'a', 'o'),
        edge('e2', 't', 'b', 'o'),
        edge('e3', 't', 'c', 'o'),
        edge('e4', 't', 'd', 'o'),
        edge('e5', 't', 'e', 'o'),
      ],
    });
    // both are sync results; cast away the Promise union
    const sparseImp = (sparse as { importance: number }).importance;
    const denseImp = (dense as { importance: number }).importance;
    expect(denseImp).toBeGreaterThan(sparseImp);
  });
});
