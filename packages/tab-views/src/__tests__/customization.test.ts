/**
 * Customization persistence tests.
 *
 * Pins scope-keyed isolation (tenant prefs never bleed into
 * conversation prefs), the resolved-scope ladder, and the
 * preference-derivation function.
 */

import { describe, expect, it } from 'vitest';
import {
  createInMemoryCustomizationStore,
  buildPreferenceKey,
} from '../customization/preference-store.js';
import {
  emptyPreference,
  applyEventToPreference,
} from '../customization/preference-derivation.js';
import {
  buildTableSortEvent,
  buildTableFilterEvent,
} from '../interactivity/event-builders.js';
import { ownerCustomer } from '../types/principal.js';

const principalA = ownerCustomer({ principalId: 'pA', tenantId: 'tenant-A' });
const principalB = ownerCustomer({ principalId: 'pB', tenantId: 'tenant-B' });

describe('buildPreferenceKey', () => {
  it('keys tenant scope by tenantId + viewKey', () => {
    expect(
      buildPreferenceKey({
        principal: principalA,
        viewKey: 'employee.roster.table',
        scope: 'tenant',
      }),
    ).toBe('pref::tenant::tenant-A::employee.roster.table');
  });

  it('keys conversation scope by conversationId', () => {
    expect(
      buildPreferenceKey({
        principal: principalA,
        viewKey: 'arrears',
        scope: 'conversation',
        conversationId: 'conv-1',
      }),
    ).toBe('pref::conv::tenant-A::conv-1::arrears');
  });

  it('returns undefined when conversation scope is missing conversationId', () => {
    expect(
      buildPreferenceKey({
        principal: principalA,
        viewKey: 'x',
        scope: 'conversation',
      }),
    ).toBeUndefined();
  });

  it('returns undefined when session scope is missing sessionId', () => {
    expect(
      buildPreferenceKey({ principal: principalA, viewKey: 'x', scope: 'session' }),
    ).toBeUndefined();
  });

  it('two tenants on the same viewKey get different keys', () => {
    const a = buildPreferenceKey({ principal: principalA, viewKey: 'x', scope: 'tenant' });
    const b = buildPreferenceKey({ principal: principalB, viewKey: 'x', scope: 'tenant' });
    expect(a).not.toBe(b);
  });
});

describe('CustomizationStore — in-memory', () => {
  it('write + read round-trips a preference', async () => {
    const store = createInMemoryCustomizationStore();
    const saved = await store.write({
      principal: principalA,
      preference: {
        entityType: 'employee',
        viewKey: 'employee.roster.table',
        scope: 'tenant',
        sortBy: [{ field: 'name', direction: 'asc' }],
      },
    });
    expect(saved.id).toBeTruthy();
    const read = await store.read({
      principal: principalA,
      viewKey: 'employee.roster.table',
      scope: 'tenant',
    });
    expect(read).toBeDefined();
    expect(read?.sortBy?.[0]?.field).toBe('name');
  });

  it('writes use distinct keys per scope', async () => {
    const store = createInMemoryCustomizationStore();
    await store.write({
      principal: principalA,
      preference: {
        entityType: 'employee',
        viewKey: 'v',
        scope: 'tenant',
        sortBy: [{ field: 'name', direction: 'asc' }],
      },
    });
    await store.write({
      principal: principalA,
      preference: {
        entityType: 'employee',
        viewKey: 'v',
        scope: 'conversation',
        sortBy: [{ field: 'rating', direction: 'desc' }],
      },
      conversationId: 'conv-1',
    });
    const t = await store.read({
      principal: principalA,
      viewKey: 'v',
      scope: 'tenant',
    });
    const c = await store.read({
      principal: principalA,
      viewKey: 'v',
      scope: 'conversation',
      conversationId: 'conv-1',
    });
    expect(t?.sortBy?.[0]?.field).toBe('name');
    expect(c?.sortBy?.[0]?.field).toBe('rating');
  });

  it('readResolved walks scopes in declared order', async () => {
    const store = createInMemoryCustomizationStore();
    // Only tenant-scope is set.
    await store.write({
      principal: principalA,
      preference: {
        entityType: 'x',
        viewKey: 'v',
        scope: 'tenant',
        sortBy: [{ field: 'tenant-pref', direction: 'asc' }],
      },
    });
    const found = await store.readResolved({
      principal: principalA,
      viewKey: 'v',
      conversationId: 'conv-1',
    });
    // First conversation lookup misses; falls back to tenant.
    expect(found?.sortBy?.[0]?.field).toBe('tenant-pref');
  });

  it('readResolved returns undefined when nothing matches', async () => {
    const store = createInMemoryCustomizationStore();
    const found = await store.readResolved({
      principal: principalA,
      viewKey: 'never',
      conversationId: 'conv-1',
    });
    expect(found).toBeUndefined();
  });

  it('delete removes the preference', async () => {
    const store = createInMemoryCustomizationStore();
    await store.write({
      principal: principalA,
      preference: {
        entityType: 'x',
        viewKey: 'v',
        scope: 'tenant',
      },
    });
    await store.delete({
      principal: principalA,
      viewKey: 'v',
      scope: 'tenant',
    });
    const found = await store.read({
      principal: principalA,
      viewKey: 'v',
      scope: 'tenant',
    });
    expect(found).toBeUndefined();
  });

  it('two tenants cannot read each other prefs', async () => {
    const store = createInMemoryCustomizationStore();
    await store.write({
      principal: principalA,
      preference: {
        entityType: 'x',
        viewKey: 'v',
        scope: 'tenant',
        sortBy: [{ field: 'A-pref', direction: 'asc' }],
      },
    });
    const bRead = await store.read({
      principal: principalB,
      viewKey: 'v',
      scope: 'tenant',
    });
    expect(bRead).toBeUndefined();
  });

  it('throws when writing a conversation pref without a conversationId', async () => {
    const store = createInMemoryCustomizationStore();
    await expect(
      store.write({
        principal: principalA,
        preference: {
          entityType: 'x',
          viewKey: 'v',
          scope: 'conversation',
        },
      }),
    ).rejects.toThrow();
  });
});

describe('emptyPreference + applyEventToPreference', () => {
  it('emptyPreference returns a fresh draft', () => {
    const p = emptyPreference({
      viewKey: 'v',
      entityType: 'x',
      scope: 'conversation',
      label: 'Test',
    });
    expect(p.viewKey).toBe('v');
    expect(p.entityType).toBe('x');
    expect(p.scope).toBe('conversation');
    expect(p.label).toBe('Test');
  });

  it('applyEventToPreference applies table-sort', () => {
    const p = emptyPreference({ viewKey: 'v', entityType: 'x', scope: 'tenant' });
    const e = buildTableSortEvent(
      {
        viewKey: 'v',
        entityType: 'x',
        principal: principalA,
        now: () => new Date('2026-05-19T00:00:00.000Z'),
      },
      { column: 'rating', direction: 'desc' },
    );
    const next = applyEventToPreference(p, e, () => new Date('2026-05-19T01:00:00.000Z'));
    expect(next).not.toBe(p);
    expect(next.sortBy).toEqual([{ field: 'rating', direction: 'desc' }]);
    expect(next.updatedAt).toBe('2026-05-19T01:00:00.000Z');
  });

  it('applyEventToPreference applies table-filter', () => {
    const p = emptyPreference({ viewKey: 'v', entityType: 'x', scope: 'tenant' });
    const e = buildTableFilterEvent(
      { viewKey: 'v', entityType: 'x', principal: principalA },
      { filters: [{ field: 'role', op: 'eq', value: 'caretaker' }] },
    );
    const next = applyEventToPreference(p, e);
    expect(next.filterBy).toEqual([{ field: 'role', op: 'eq', value: 'caretaker' }]);
  });

  it('applyEventToPreference is a no-op for non-persistable kinds', () => {
    const p = emptyPreference({ viewKey: 'v', entityType: 'x', scope: 'tenant' });
    const e = {
      eventId: 'evt-1',
      emittedAt: '2026-05-19T00:00:00.000Z',
      viewKey: 'v',
      entityType: 'x',
      principal: principalA,
      payload: { kind: 'table-row-expand' as const, entityId: 'e1' },
    };
    const next = applyEventToPreference(p, e);
    expect(next).toBe(p);
  });
});
