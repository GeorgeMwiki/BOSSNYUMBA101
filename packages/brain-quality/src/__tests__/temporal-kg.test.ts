import { describe, expect, it } from 'vitest';

import {
  FactAlreadyInvalidatedError,
  UnknownFactError,
  addFact,
  createTemporalKG,
  currentFacts,
  invalidateFact,
  queryAsOf,
  upsertNode,
} from '../memory/temporal-kg.js';

describe('TemporalKG — persistent tier 3 (Zep-style)', () => {
  it('createTemporalKG returns an empty graph', () => {
    const g = createTemporalKG();
    expect(g.nodes.size).toBe(0);
    expect(g.edges.size).toBe(0);
  });

  it('upsertNode adds a node immutably', () => {
    const g = createTemporalKG();
    const next = upsertNode(g, {
      id: 'tenant-001',
      entityType: 'tenant',
      properties: { name: 'Mary' },
    });
    expect(g.nodes.size).toBe(0);
    expect(next.nodes.size).toBe(1);
    expect(next.nodes.get('tenant-001')?.properties.name).toBe('Mary');
  });

  it('addFact creates a current (validTo null) edge', () => {
    let g = createTemporalKG();
    g = upsertNode(g, { id: 't1', entityType: 'tenant', properties: {} });
    g = upsertNode(g, { id: 'b1', entityType: 'building', properties: {} });
    g = addFact(g, {
      subjectId: 't1',
      predicate: 'occupies',
      objectId: 'b1',
    });
    const open = currentFacts(g);
    expect(open).toHaveLength(1);
    expect(open[0]?.validTo).toBeNull();
  });

  it('invalidateFact closes the time window', () => {
    let g = createTemporalKG();
    g = upsertNode(g, { id: 't1', entityType: 'tenant', properties: {} });
    g = upsertNode(g, { id: 'b1', entityType: 'building', properties: {} });
    g = addFact(g, {
      subjectId: 't1',
      predicate: 'occupies',
      objectId: 'b1',
      validFrom: '2026-01-01T00:00:00Z',
    });
    const id = [...g.edges.values()][0]!.id;
    g = invalidateFact(g, id, 'moved out', '2026-04-01T00:00:00Z');
    expect(currentFacts(g)).toHaveLength(0);
    const edge = g.edges.get(id);
    expect(edge?.validTo).toBe('2026-04-01T00:00:00Z');
    expect(edge?.invalidationReason).toBe('moved out');
  });

  it('throws UnknownFactError for missing id', () => {
    const g = createTemporalKG();
    expect(() => invalidateFact(g, 'missing', 'reason')).toThrow(UnknownFactError);
  });

  it('throws FactAlreadyInvalidatedError on double-close', () => {
    let g = createTemporalKG();
    g = upsertNode(g, { id: 't1', entityType: 'tenant', properties: {} });
    g = upsertNode(g, { id: 'b1', entityType: 'building', properties: {} });
    g = addFact(g, { subjectId: 't1', predicate: 'occupies', objectId: 'b1' });
    const id = [...g.edges.values()][0]!.id;
    g = invalidateFact(g, id, 'first');
    expect(() => invalidateFact(g, id, 'second')).toThrow(
      FactAlreadyInvalidatedError,
    );
  });

  it('queryAsOf returns facts valid at that timestamp', () => {
    let g = createTemporalKG();
    g = upsertNode(g, { id: 't1', entityType: 'tenant', properties: {} });
    g = upsertNode(g, { id: 'b1', entityType: 'building', properties: {} });
    g = upsertNode(g, { id: 'b2', entityType: 'building', properties: {} });
    g = addFact(g, {
      subjectId: 't1',
      predicate: 'occupies',
      objectId: 'b1',
      validFrom: '2026-01-01T00:00:00Z',
    });
    const firstId = [...g.edges.values()][0]!.id;
    g = invalidateFact(g, firstId, 'moved', '2026-04-01T00:00:00Z');
    g = addFact(g, {
      subjectId: 't1',
      predicate: 'occupies',
      objectId: 'b2',
      validFrom: '2026-04-01T00:00:00Z',
    });

    const inFeb = queryAsOf(g, '2026-02-15T00:00:00Z', {
      subjectId: 't1',
      predicate: 'occupies',
    });
    expect(inFeb).toHaveLength(1);
    expect(inFeb[0]?.objectId).toBe('b1');

    const inMay = queryAsOf(g, '2026-05-15T00:00:00Z', {
      subjectId: 't1',
      predicate: 'occupies',
    });
    expect(inMay).toHaveLength(1);
    expect(inMay[0]?.objectId).toBe('b2');
  });

  it('queryAsOf respects entityType filter via subject node', () => {
    let g = createTemporalKG();
    g = upsertNode(g, { id: 't1', entityType: 'tenant', properties: {} });
    g = upsertNode(g, { id: 'v1', entityType: 'vendor', properties: {} });
    g = upsertNode(g, { id: 'b1', entityType: 'building', properties: {} });
    g = addFact(g, { subjectId: 't1', predicate: 'related', objectId: 'b1' });
    g = addFact(g, { subjectId: 'v1', predicate: 'related', objectId: 'b1' });

    const tenantOnly = queryAsOf(g, new Date().toISOString(), {
      predicate: 'related',
      entityType: 'tenant',
    });
    expect(tenantOnly).toHaveLength(1);
    expect(tenantOnly[0]?.subjectId).toBe('t1');
  });

  it('currentFacts skips closed edges', () => {
    let g = createTemporalKG();
    g = upsertNode(g, { id: 't1', entityType: 'tenant', properties: {} });
    g = upsertNode(g, { id: 'b1', entityType: 'building', properties: {} });
    g = addFact(g, { subjectId: 't1', predicate: 'occupies', objectId: 'b1' });
    const id = [...g.edges.values()][0]!.id;
    g = invalidateFact(g, id, 'moved');
    expect(currentFacts(g)).toHaveLength(0);
  });

  it('rejects invalid edge via zod (negative dates accepted as ISO; bad shape rejected)', () => {
    const g = createTemporalKG();
    expect(() =>
      // missing subjectId
      addFact(g, { subjectId: '', predicate: 'x', objectId: 'b1' }),
    ).toThrow();
  });

  it('queryAsOf with no filter returns every edge valid at the timestamp', () => {
    let g = createTemporalKG();
    g = upsertNode(g, { id: 't1', entityType: 'tenant', properties: {} });
    g = upsertNode(g, { id: 'b1', entityType: 'building', properties: {} });
    g = addFact(g, { subjectId: 't1', predicate: 'occupies', objectId: 'b1' });
    g = addFact(g, { subjectId: 't1', predicate: 'pays_to', objectId: 'b1' });
    const all = queryAsOf(g, new Date().toISOString());
    expect(all).toHaveLength(2);
  });
});
