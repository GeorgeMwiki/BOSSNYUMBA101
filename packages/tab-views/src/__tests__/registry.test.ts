/**
 * Registry unit tests.
 *
 * Pins the immutability contract: every register / deregister
 * returns a NEW registry; the original is unchanged. Pins the
 * per-entity-type sort order: lower sort_order first, then alpha
 * by key. Pins the duplicate-key guard.
 */

import { describe, expect, it } from 'vitest';
import {
  TabViewRegistry,
  createTabViewRegistry,
} from '../registry/tab-view-registry.js';
import { createSeedTabViewRegistry, SEEDED_ENTITY_TYPES } from '../registry/seed.js';
import type { TabView } from '../types/tab-view.js';

function stubView(args: {
  key: string;
  entity_type: string;
  sort_order?: number;
}): TabView<unknown, unknown> {
  return {
    key: args.key,
    label: args.key,
    entity_type: args.entity_type,
    view_kind: 'table',
    defaultQuery: {},
    validateQuery: () => ({ ok: true, query: {} }),
    renderToBlocks: () => [],
    ...(args.sort_order !== undefined ? { sort_order: args.sort_order } : {}),
  };
}

describe('TabViewRegistry', () => {
  it('starts empty', () => {
    const r = new TabViewRegistry();
    expect(r.size).toBe(0);
    expect(r.all()).toEqual([]);
    expect(r.entityTypes()).toEqual([]);
  });

  it('createTabViewRegistry returns an empty registry', () => {
    expect(createTabViewRegistry().size).toBe(0);
  });

  it('register returns a NEW registry; the original is unchanged', () => {
    const r1 = new TabViewRegistry();
    const r2 = r1.register(stubView({ key: 'a', entity_type: 'employee' }));
    expect(r1.size).toBe(0);
    expect(r2.size).toBe(1);
    expect(r2.get('a')).toBeDefined();
    expect(r1.get('a')).toBeUndefined();
  });

  it('registerAll registers each view in order', () => {
    const r = new TabViewRegistry().registerAll([
      stubView({ key: 'a', entity_type: 'employee' }),
      stubView({ key: 'b', entity_type: 'lease' }),
      stubView({ key: 'c', entity_type: 'lead' }),
    ]);
    expect(r.size).toBe(3);
    expect(r.has('a')).toBe(true);
    expect(r.has('b')).toBe(true);
    expect(r.has('c')).toBe(true);
  });

  it('throws on duplicate key', () => {
    const r1 = new TabViewRegistry().register(
      stubView({ key: 'a', entity_type: 'employee' }),
    );
    expect(() =>
      r1.register(stubView({ key: 'a', entity_type: 'lease' })),
    ).toThrow(/duplicate registration/);
  });

  it('deregister returns a NEW registry without the named view', () => {
    const r1 = new TabViewRegistry()
      .register(stubView({ key: 'a', entity_type: 'employee' }))
      .register(stubView({ key: 'b', entity_type: 'lease' }));
    const r2 = r1.deregister('a');
    expect(r1.size).toBe(2);
    expect(r2.size).toBe(1);
    expect(r2.get('a')).toBeUndefined();
    expect(r2.get('b')).toBeDefined();
  });

  it('deregister is a no-op on missing key', () => {
    const r1 = new TabViewRegistry().register(
      stubView({ key: 'a', entity_type: 'employee' }),
    );
    const r2 = r1.deregister('missing');
    expect(r2.size).toBe(1);
    // No-op returns the same instance.
    expect(r2).toBe(r1);
  });

  it('forEntityType returns views sorted by sort_order asc', () => {
    const r = new TabViewRegistry().registerAll([
      stubView({ key: 'b', entity_type: 'employee', sort_order: 20 }),
      stubView({ key: 'a', entity_type: 'employee', sort_order: 10 }),
      stubView({ key: 'c', entity_type: 'employee', sort_order: 30 }),
    ]);
    const list = r.forEntityType('employee');
    expect(list.map((v) => v.key)).toEqual(['a', 'b', 'c']);
  });

  it('forEntityType breaks sort ties by key alphabetical', () => {
    const r = new TabViewRegistry().registerAll([
      stubView({ key: 'z', entity_type: 'employee', sort_order: 10 }),
      stubView({ key: 'a', entity_type: 'employee', sort_order: 10 }),
      stubView({ key: 'm', entity_type: 'employee', sort_order: 10 }),
    ]);
    const list = r.forEntityType('employee');
    expect(list.map((v) => v.key)).toEqual(['a', 'm', 'z']);
  });

  it('forEntityType defaults missing sort_order to 1000 (last)', () => {
    const r = new TabViewRegistry().registerAll([
      stubView({ key: 'late', entity_type: 'employee' }),
      stubView({ key: 'early', entity_type: 'employee', sort_order: 1 }),
    ]);
    const list = r.forEntityType('employee');
    expect(list.map((v) => v.key)).toEqual(['early', 'late']);
  });

  it('forEntityType returns empty array for unknown entity_type', () => {
    const r = new TabViewRegistry();
    expect(r.forEntityType('unknown')).toEqual([]);
  });

  it('entityTypes returns sorted, deduped list', () => {
    const r = new TabViewRegistry().registerAll([
      stubView({ key: 'a', entity_type: 'lease' }),
      stubView({ key: 'b', entity_type: 'employee' }),
      stubView({ key: 'c', entity_type: 'employee' }),
    ]);
    expect(r.entityTypes()).toEqual(['employee', 'lease']);
  });

  it('get returns undefined for missing key', () => {
    expect(new TabViewRegistry().get('nope')).toBeUndefined();
  });

  it('has reflects get', () => {
    const r = new TabViewRegistry().register(
      stubView({ key: 'k', entity_type: 'employee' }),
    );
    expect(r.has('k')).toBe(true);
    expect(r.has('missing')).toBe(false);
  });

  it('all returns every registered view, deduped', () => {
    const r = new TabViewRegistry().registerAll([
      stubView({ key: 'a', entity_type: 'employee' }),
      stubView({ key: 'b', entity_type: 'employee' }),
      stubView({ key: 'c', entity_type: 'lease' }),
    ]);
    expect(r.all().length).toBe(3);
    expect(new Set(r.all().map((v) => v.key))).toEqual(new Set(['a', 'b', 'c']));
  });
});

describe('createSeedTabViewRegistry — coverage of all 14 default J1 entity types', () => {
  const r = createSeedTabViewRegistry();

  it('registers a view for every seeded entity_type', () => {
    for (const t of SEEDED_ENTITY_TYPES) {
      const list = r.forEntityType(t);
      expect(list.length, `entity_type=${t}`).toBeGreaterThan(0);
    }
  });

  it('headline views are registered', () => {
    expect(r.get('employee.roster.table')).toBeDefined();
    expect(r.get('property.health.kpi-grid')).toBeDefined();
    expect(r.get('lease.history.timeline')).toBeDefined();
    expect(r.get('arrears.severity.table')).toBeDefined();
    expect(r.get('kra-filing.profile-card')).toBeDefined();
    expect(r.get('recommendation.scored.list')).toBeDefined();
  });

  it('placeholder views exist for entity_types without headline coverage', () => {
    const placeholderTypes = SEEDED_ENTITY_TYPES.filter(
      (t) =>
        ![
          'employee',
          'property',
          'lease',
          'arrears',
          'kra-filing',
          'recommendation',
        ].includes(t),
    );
    for (const t of placeholderTypes) {
      const list = r.forEntityType(t);
      expect(list.some((v) => v.key === `${t}.default`)).toBe(true);
    }
  });

  it('entityTypes() includes all 15 seeded types (14 J1 + arrears)', () => {
    const types = r.entityTypes();
    for (const t of SEEDED_ENTITY_TYPES) {
      expect(types).toContain(t);
    }
  });

  it('view keys are unique across the registry', () => {
    const keys = r.all().map((v) => v.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
