/**
 * In-memory repository tests — the data plane underpinning every service test.
 *
 * Covers:
 *   - insert/get round-trips
 *   - id collision guard
 *   - attribute version monotonicity (per-key)
 *   - currentAttributes returns MAX(version) per key
 *   - relation duplicate guard
 *   - relation queries
 *   - soft-delete excludes by default; includes when asked
 *   - attribute equality filter
 *   - updateAttributeSource for applyProvenance plumbing
 */

import { describe, it, expect } from 'vitest';
import { InMemoryEntityStoreRepository } from '../repository/in-memory-repository.js';
import { RelationDuplicateError } from '../types/errors.js';
import type { Entity, EntityRelation } from '../types/entity.js';

function header(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'e_001',
    type: 'employee',
    scopeOwnerType: 'tenant',
    scopeOwnerId: 't_alpha',
    tenantId: 't_alpha',
    createdBy: 'u_md',
    createdAt: '2026-05-19T10:00:00Z',
    sourceProvenance: { manual: true, timestamp: '2026-05-19T10:00:00Z' },
    deletedAt: null,
    ...overrides,
  };
}

describe('InMemoryEntityStoreRepository / entities', () => {
  it('inserts and gets an entity', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    const got = await r.getEntity('e_001');
    expect(got?.id).toBe('e_001');
  });

  it('returns null for missing id', async () => {
    const r = new InMemoryEntityStoreRepository();
    expect(await r.getEntity('e_missing')).toBeNull();
  });

  it('rejects id collision', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    await expect(r.insertEntity(header())).rejects.toThrow(/id collision/);
  });

  it('soft-deletes an entity', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    await r.softDeleteEntity('e_001', '2026-05-19T11:00:00Z');
    const got = await r.getEntity('e_001');
    expect(got?.deletedAt).toBe('2026-05-19T11:00:00Z');
  });

  it('soft-delete on missing id is a no-op', async () => {
    const r = new InMemoryEntityStoreRepository();
    await expect(r.softDeleteEntity('nope', '2026-05-19T11:00:00Z')).resolves.toBeUndefined();
  });
});

describe('InMemoryEntityStoreRepository / findEntities', () => {
  it('returns [] when nothing matches', async () => {
    const r = new InMemoryEntityStoreRepository();
    expect(await r.findEntities({ type: 'employee' })).toEqual([]);
  });

  it('filters by type', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header({ id: 'e1', type: 'employee' }));
    await r.insertEntity(header({ id: 'e2', type: 'lease' }));
    const out = await r.findEntities({ type: 'lease' });
    expect(out.map((e) => e.id)).toEqual(['e2']);
  });

  it('filters by tenant_id', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header({ id: 'e1', tenantId: 't_alpha', scopeOwnerId: 't_alpha' }));
    await r.insertEntity(header({ id: 'e2', tenantId: 't_beta', scopeOwnerId: 't_beta' }));
    const out = await r.findEntities({ tenantId: 't_beta' });
    expect(out.map((e) => e.id)).toEqual(['e2']);
  });

  it('filters by scope_owner_type', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header({ id: 'e1', scopeOwnerType: 'tenant' }));
    await r.insertEntity(header({ id: 'e2', scopeOwnerType: 'platform', tenantId: undefined, scopeOwnerId: 'plat' }));
    const out = await r.findEntities({ scopeOwnerType: 'platform' });
    expect(out.map((e) => e.id)).toEqual(['e2']);
  });

  it('excludes soft-deleted by default', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header({ id: 'e1' }));
    await r.softDeleteEntity('e1', '2026-05-19T11:00:00Z');
    expect(await r.findEntities({ type: 'employee' })).toEqual([]);
  });

  it('includes soft-deleted when asked', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header({ id: 'e1' }));
    await r.softDeleteEntity('e1', '2026-05-19T11:00:00Z');
    const out = await r.findEntities({ type: 'employee', includeDeleted: true });
    expect(out).toHaveLength(1);
  });

  it('filters by attribute equality', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header({ id: 'e1' }));
    await r.insertEntity(header({ id: 'e2' }));
    await r.insertAttribute(
      { entityId: 'e1', key: 'role', value: 'manager', source: { manual: true, timestamp: '2026-05-19T10:00:00Z' }, createdBy: 'u_md' },
      '2026-05-19T10:00:00Z',
    );
    await r.insertAttribute(
      { entityId: 'e2', key: 'role', value: 'cleaner', source: { manual: true, timestamp: '2026-05-19T10:00:00Z' }, createdBy: 'u_md' },
      '2026-05-19T10:00:00Z',
    );
    const out = await r.findEntities({ attributesEqual: [{ key: 'role', value: 'manager' }] });
    expect(out.map((e) => e.id)).toEqual(['e1']);
  });
});

describe('InMemoryEntityStoreRepository / attributes versioning', () => {
  const src = { manual: true, timestamp: '2026-05-19T10:00:00Z' } as const;

  it('first attribute for a key starts at version 1', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    const row = await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'manager', source: src, createdBy: 'u_md' },
      '2026-05-19T10:00:00Z',
    );
    expect(row.version).toBe(1);
  });

  it('subsequent attribute for same key increments version', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'manager', source: src, createdBy: 'u_md' },
      '2026-05-19T10:00:00Z',
    );
    const v2 = await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'senior_manager', source: src, createdBy: 'u_md' },
      '2026-05-19T11:00:00Z',
    );
    expect(v2.version).toBe(2);
    const v3 = await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'head', source: src, createdBy: 'u_md' },
      '2026-05-19T12:00:00Z',
    );
    expect(v3.version).toBe(3);
  });

  it('different keys keep independent version counters', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    const a = await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'X', source: src, createdBy: 'u' },
      '2026-05-19T10:00:00Z',
    );
    const b = await r.insertAttribute(
      { entityId: 'e_001', key: 'startDate', value: '2026-06-01', source: src, createdBy: 'u' },
      '2026-05-19T10:00:00Z',
    );
    expect(a.version).toBe(1);
    expect(b.version).toBe(1);
  });

  it('currentAttributes returns the MAX version per key', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'manager', source: src, createdBy: 'u' },
      '2026-05-19T10:00:00Z',
    );
    await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'senior_manager', source: src, createdBy: 'u' },
      '2026-05-19T11:00:00Z',
    );
    const current = await r.currentAttributes('e_001');
    expect(current.get('role')?.value).toBe('senior_manager');
    expect(current.get('role')?.version).toBe(2);
  });

  it('listAttributes returns rows sorted by (key, version)', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'X', source: src, createdBy: 'u' },
      '2026-05-19T10:00:00Z',
    );
    await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'Y', source: src, createdBy: 'u' },
      '2026-05-19T11:00:00Z',
    );
    await r.insertAttribute(
      { entityId: 'e_001', key: 'startDate', value: '2026-06-01', source: src, createdBy: 'u' },
      '2026-05-19T10:00:00Z',
    );
    const rows = await r.listAttributes('e_001');
    expect(rows.map((r) => `${r.key}/${r.version}`)).toEqual([
      'role/1',
      'role/2',
      'startDate/1',
    ]);
  });

  it('updateAttributeSource replaces source on the targeted version', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    const inserted = await r.insertAttribute(
      { entityId: 'e_001', key: 'role', value: 'X', source: src, createdBy: 'u' },
      '2026-05-19T10:00:00Z',
    );
    const updated = await r.updateAttributeSource(
      'e_001',
      'role',
      inserted.version,
      { llmResearch: true, timestamp: '2026-05-19T12:00:00Z' },
    );
    expect(updated?.source.llmResearch).toBe(true);
  });

  it('updateAttributeSource returns null for missing version', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertEntity(header());
    const got = await r.updateAttributeSource('e_001', 'role', 99, {
      manual: true,
      timestamp: '2026-05-19T10:00:00Z',
    });
    expect(got).toBeNull();
  });
});

describe('InMemoryEntityStoreRepository / relations', () => {
  function rel(overrides: Partial<EntityRelation> = {}): EntityRelation {
    return {
      fromId: 'e_001',
      toId: 'e_002',
      type: 'owns',
      metadata: {},
      createdAt: '2026-05-19T10:00:00Z',
      createdBy: 'u_md',
      ...overrides,
    };
  }

  it('inserts a relation', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertRelation(rel());
    const out = await r.findRelations({ fromId: 'e_001' });
    expect(out).toHaveLength(1);
  });

  it('rejects duplicate (from, type, to)', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertRelation(rel());
    await expect(r.insertRelation(rel())).rejects.toThrow(RelationDuplicateError);
  });

  it('allows same (from, to) with different type', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertRelation(rel({ type: 'owns' }));
    await expect(r.insertRelation(rel({ type: 'manages' }))).resolves.toBeDefined();
  });

  it('filters by from', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertRelation(rel({ fromId: 'a', toId: 'b' }));
    await r.insertRelation(rel({ fromId: 'a', toId: 'c' }));
    await r.insertRelation(rel({ fromId: 'x', toId: 'y' }));
    expect((await r.findRelations({ fromId: 'a' })).length).toBe(2);
  });

  it('filters by to', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertRelation(rel({ fromId: 'a', toId: 'b' }));
    await r.insertRelation(rel({ fromId: 'x', toId: 'b' }));
    await r.insertRelation(rel({ fromId: 'a', toId: 'c' }));
    expect((await r.findRelations({ toId: 'b' })).length).toBe(2);
  });

  it('filters by type', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertRelation(rel({ fromId: 'a', toId: 'b', type: 'owns' }));
    await r.insertRelation(rel({ fromId: 'a', toId: 'c', type: 'manages' }));
    expect((await r.findRelations({ type: 'owns' })).length).toBe(1);
  });

  it('combines filters', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertRelation(rel({ fromId: 'a', toId: 'b', type: 'owns' }));
    await r.insertRelation(rel({ fromId: 'a', toId: 'c', type: 'owns' }));
    await r.insertRelation(rel({ fromId: 'a', toId: 'b', type: 'manages' }));
    const out = await r.findRelations({ fromId: 'a', toId: 'b', type: 'owns' });
    expect(out).toHaveLength(1);
  });

  it('deleteRelation removes a specific edge only', async () => {
    const r = new InMemoryEntityStoreRepository();
    await r.insertRelation(rel({ fromId: 'a', toId: 'b', type: 'owns' }));
    await r.insertRelation(rel({ fromId: 'a', toId: 'b', type: 'manages' }));
    await r.deleteRelation('a', 'owns', 'b');
    const remaining = await r.findRelations({ fromId: 'a' });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.type).toBe('manages');
  });

  it('deleteRelation on missing edge is a no-op', async () => {
    const r = new InMemoryEntityStoreRepository();
    await expect(r.deleteRelation('a', 'owns', 'b')).resolves.toBeUndefined();
  });
});
