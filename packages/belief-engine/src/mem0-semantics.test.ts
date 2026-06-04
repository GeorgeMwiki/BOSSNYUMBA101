/**
 * Mem0 ADD/UPDATE/DELETE/NOOP tests. Covers each decision branch + the
 * negation path + the confidence-gated NOOP/UPDATE split.
 */

import { describe, it, expect } from 'vitest';

import {
  decideMem0Op,
  describeMem0Decision,
  type Mem0ExistingFact,
} from './mem0-semantics.js';

const existing: Mem0ExistingFact[] = [
  {
    id: 'f-1',
    factText: 'The Kinondoni block runs a day caretaker and a night caretaker',
    factType: 'operations',
    confidence: 0.8,
  },
];

describe('mem0-semantics', () => {
  it('ADDs a brand-new fact (no match in factType)', () => {
    const d = decideMem0Op(
      { factText: 'The maintenance depot is in Mwanza', factType: 'logistics' },
      existing,
    );
    expect(d.kind).toBe('add');
  });

  it('ADDs when no existing fact of the same factType exists', () => {
    const d = decideMem0Op(
      {
        factText: 'Completely unrelated claim about rent pricing',
        factType: 'operations',
      },
      existing,
    );
    expect(d.kind).toBe('add');
  });

  it('DELETEs on an explicit negation matching a prior fact', () => {
    const d = decideMem0Op(
      {
        factText: 'The Kinondoni block no longer runs a night caretaker',
        factType: 'operations',
        explicitNegation: true,
      },
      existing,
    );
    expect(d.kind).toBe('delete');
    if (d.kind === 'delete') expect(d.targetId).toBe('f-1');
  });

  it('DELETEs on a keyword-detected negation (no explicit flag)', () => {
    // Stripping "stopped" leaves "The Kinondoni block running a day caretaker
    // and a night caretaker" which Jaccard-overlaps the stored fact above the
    // 0.7 delete bar.
    const d = decideMem0Op(
      {
        factText:
          'The Kinondoni block stopped running a day caretaker and a night caretaker',
        factType: 'operations',
      },
      existing,
    );
    expect(d.kind).toBe('delete');
  });

  it('NOOPs when the same claim arrives with equal-or-lower confidence', () => {
    const d = decideMem0Op(
      {
        factText:
          'The Kinondoni block runs a day caretaker and a night caretaker',
        factType: 'operations',
        confidence: 0.7,
      },
      existing,
    );
    expect(d.kind).toBe('noop');
  });

  it('UPDATEs when the same claim arrives with higher confidence', () => {
    const d = decideMem0Op(
      {
        factText:
          'The Kinondoni block runs a day caretaker and a night caretaker',
        factType: 'operations',
        confidence: 0.95,
      },
      existing,
    );
    expect(d.kind).toBe('update');
    if (d.kind === 'update') expect(d.supersedesId).toBe('f-1');
  });

  it('UPDATEs on a high-similarity contradiction below the same-claim bar', () => {
    const facts: Mem0ExistingFact[] = [
      {
        id: 'g-1',
        factText: 'unit occupancy rate is approximately ninety two percent',
        factType: 'occupancy',
        confidence: 0.6,
      },
    ];
    const d = decideMem0Op(
      {
        factText: 'unit occupancy rate is approximately eighty percent now',
        factType: 'occupancy',
      },
      facts,
      { contradictionThreshold: 0.5 },
    );
    expect(d.kind).toBe('update');
  });

  it('uses cosine similarity when embeddings are present', () => {
    const facts: Mem0ExistingFact[] = [
      {
        id: 'e-1',
        factText: 'anything',
        factType: 'x',
        confidence: 0.5,
        embedding: [1, 0, 0],
      },
    ];
    const d = decideMem0Op(
      {
        factText: 'totally different words',
        factType: 'x',
        embedding: [1, 0, 0], // identical vector → cosine 1.0
        confidence: 0.9,
      },
      facts,
    );
    // Identical embedding → high similarity → update (higher confidence).
    expect(d.kind).toBe('update');
  });

  it('describeMem0Decision renders each kind', () => {
    expect(describeMem0Decision({ kind: 'add', reason: 'r' })).toMatch(/^ADD/);
    expect(
      describeMem0Decision({
        kind: 'noop',
        matchedId: 'm',
        similarity: 0.99,
        reason: 'r',
      }),
    ).toMatch(/^NOOP/);
  });
});
