/**
 * renderTabInChat unit tests.
 *
 * Pins:
 *   - the view-lookup ladder (viewKey > entity_type+view_kind > default)
 *   - the cross-tenant gate (owner-customer ⇒ forbidden)
 *   - validation forwarding (view.validateQuery rejection bubbles up)
 *   - audit emission (every successful render writes an audit entry)
 *   - dedup of citations across parts
 *   - preference resolution from the customization store
 */

import { describe, expect, it } from 'vitest';
import {
  renderTabInChat,
} from '../render-tool/render-tab-in-chat.js';
import {
  createInMemoryAuditSink,
} from '../render-tool/audit-sink.js';
import type { DataPort, DataFetchResult } from '../render-tool/data-port.js';
import {
  TabViewRegistry,
} from '../registry/tab-view-registry.js';
import { createSeedTabViewRegistry } from '../registry/seed.js';
import { internalAdmin, ownerCustomer } from '../types/principal.js';
import {
  createInMemoryCustomizationStore,
} from '../customization/preference-store.js';
import type { TabView } from '../types/tab-view.js';

function stubPort(data: unknown, opts: { citations?: { id: string; label: string }[]; rowCountHint?: number } = {}): DataPort {
  return {
    async fetchViewData<TData>(): Promise<DataFetchResult<TData>> {
      return {
        data: data as TData,
        citations: opts.citations ?? [],
        crossTenant: false,
        ...(opts.rowCountHint !== undefined ? { rowCountHint: opts.rowCountHint } : {}),
      };
    },
  };
}

describe('renderTabInChat — view resolution', () => {
  const registry = createSeedTabViewRegistry();
  const audit = createInMemoryAuditSink();

  it('resolves by explicit viewKey', async () => {
    const r = await renderTabInChat(
      { viewKey: 'employee.roster.table' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({ rows: [] }), audit },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.viewKey).toBe('employee.roster.table');
  });

  it('returns view-not-found for missing viewKey', async () => {
    const r = await renderTabInChat(
      { viewKey: 'no.such.view' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({}), audit },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('view-not-found');
  });

  it('resolves by entity_type when viewKey omitted', async () => {
    const r = await renderTabInChat(
      { entity_type: 'property' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      {
        registry,
        dataPort: stubPort({
          occupancyPct: 80,
          occupancyDelta: 0,
          revenueCents: 0,
          revenueDelta: 0,
          arrearsCount: 0,
          arrearsDelta: 0,
          activeLeases: 0,
          newLeasesThisPeriod: 0,
          periodLabel: 'May 2026',
          currency: 'KES',
        }),
        audit,
      },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.viewKey).toBe('property.health.kpi-grid');
  });

  it('returns entity-type-unknown when entity_type has no views', async () => {
    const r = await renderTabInChat(
      { entity_type: 'nonexistent-type' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({}), audit },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('entity-type-unknown');
  });

  it('returns entity-type-unknown when both entity_type and viewKey are missing', async () => {
    const r = await renderTabInChat(
      {},
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({}), audit },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('entity-type-unknown');
  });
});

describe('renderTabInChat — cross-tenant gate', () => {
  const registry = createSeedTabViewRegistry();

  it('refuses allowCrossTenant for owner-customer', async () => {
    const audit = createInMemoryAuditSink();
    const r = await renderTabInChat(
      {
        viewKey: 'employee.roster.table',
        allowCrossTenant: true,
        crossTenantReason: 'I want to see other tenant',
      },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({ rows: [] }), audit },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('forbidden');
      expect(r.error.message).toMatch(/owner-customer/);
    }
    // No audit emitted for refused requests.
    expect(audit.events.length).toBe(0);
  });

  it('refuses internal-admin without a reason', async () => {
    const audit = createInMemoryAuditSink();
    const r = await renderTabInChat(
      { viewKey: 'employee.roster.table', allowCrossTenant: true },
      { principal: internalAdmin({ principalId: 'a1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({ rows: [] }), audit },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('forbidden');
  });

  it('allows internal-admin with reason', async () => {
    const audit = createInMemoryAuditSink();
    const r = await renderTabInChat(
      {
        viewKey: 'employee.roster.table',
        allowCrossTenant: true,
        crossTenantReason: 'support investigation #12',
      },
      { principal: internalAdmin({ principalId: 'a1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({ rows: [] }), audit },
    );
    expect(r.ok).toBe(true);
  });

  it('attack: owner-customer cannot bypass tenant scope via crafted entity_type', async () => {
    // The owner-customer asks for an entity_type they wouldn't normally
    // see. The data port returns nothing — but more importantly the
    // permission gate is the port's contract, not a per-call check.
    const audit = createInMemoryAuditSink();
    // Stub port that would leak data if the caller asked for cross-tenant.
    // It MUST receive `options.allowCrossTenant === false` because the
    // render-tool refuses to set it for owner-customer.
    let receivedAllowCross = false;
    const portWatcher: DataPort = {
      async fetchViewData<TData>(args): Promise<DataFetchResult<TData>> {
        receivedAllowCross = args.options.allowCrossTenant === true;
        return { data: { rows: [] } as TData, citations: [], crossTenant: false };
      },
    };
    const r = await renderTabInChat(
      {
        viewKey: 'employee.roster.table',
        allowCrossTenant: true,
        crossTenantReason: 'attempting bypass',
      },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: portWatcher, audit },
    );
    expect(r.ok).toBe(false);
    // Verify the data port was never called.
    expect(receivedAllowCross).toBe(false);
  });
});

describe('renderTabInChat — validation forwarding', () => {
  const registry = createSeedTabViewRegistry();
  const audit = createInMemoryAuditSink();

  it('returns invalid-query when validateQuery rejects', async () => {
    const r = await renderTabInChat(
      { viewKey: 'employee.roster.table', query: { sortBy: 'unknown' } },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({ rows: [] }), audit },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('invalid-query');
      if (r.error.kind === 'invalid-query') {
        expect(r.error.cause.kind).toBe('unknown-field');
      }
    }
  });

  it('merges convenience overrides into query when not set in query', async () => {
    // Build a custom view that echoes back the merged query so we can
    // inspect what validateQuery sees.
    let seenQuery: unknown = undefined;
    const echoView: TabView<{ sortBy?: string; sortDir?: string; limit?: number }, unknown> = {
      key: 'echo',
      label: 'Echo',
      entity_type: 'echo',
      view_kind: 'table',
      defaultQuery: {},
      validateQuery: (q) => {
        seenQuery = q;
        return { ok: true, query: q as { sortBy?: string; sortDir?: string; limit?: number } };
      },
      renderToBlocks: () => [],
    };
    const reg = new TabViewRegistry().register(echoView);
    await renderTabInChat(
      { viewKey: 'echo', sortBy: 'name', sortDir: 'asc', limit: 10 },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry: reg, dataPort: stubPort({}), audit: createInMemoryAuditSink() },
    );
    expect(seenQuery).toMatchObject({ sortBy: 'name', sortDir: 'asc', limit: 10 });
  });
});

describe('renderTabInChat — audit + citations', () => {
  const registry = createSeedTabViewRegistry();

  it('emits exactly one audit entry per successful render', async () => {
    const audit = createInMemoryAuditSink();
    await renderTabInChat(
      { viewKey: 'employee.roster.table' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({ rows: [] }), audit },
    );
    expect(audit.events.length).toBe(1);
    expect(audit.events[0]?.viewKey).toBe('employee.roster.table');
    expect(audit.events[0]?.tenantId).toBe('t1');
  });

  it('dedups citations by id across the response', async () => {
    const audit = createInMemoryAuditSink();
    const r = await renderTabInChat(
      { viewKey: 'employee.roster.table' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      {
        registry,
        dataPort: stubPort(
          { rows: [] },
          {
            citations: [
              { id: 'c1', label: 'Lease 1' },
              { id: 'c2', label: 'Lease 2' },
              { id: 'c1', label: 'Lease 1' }, // dup
            ],
          },
        ),
        audit,
      },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.citations.length).toBe(2);
      expect(r.citations.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
    }
  });

  it('audit reflects rowCountHint from the data port', async () => {
    const audit = createInMemoryAuditSink();
    await renderTabInChat(
      { viewKey: 'employee.roster.table' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry, dataPort: stubPort({ rows: [] }, { rowCountHint: 42 }), audit },
    );
    expect(audit.events[0]?.rowCountHint).toBe(42);
  });
});

describe('renderTabInChat — preference resolution', () => {
  const registry = createSeedTabViewRegistry();

  it('reads preference from the store under conversation scope', async () => {
    const audit = createInMemoryAuditSink();
    const prefStore = createInMemoryCustomizationStore();
    const principal = ownerCustomer({ principalId: 'p1', tenantId: 't1' });
    await prefStore.write({
      principal,
      preference: {
        entityType: 'employee',
        viewKey: 'employee.roster.table',
        scope: 'conversation',
        sortBy: [{ field: 'name', direction: 'asc' }],
      },
      conversationId: 'conv-1',
    });

    let receivedPreference: unknown = undefined;
    const echoView: TabView<unknown, unknown> = {
      key: 'employee.roster.table.test',
      label: 'Echo',
      entity_type: 'employee.test',
      view_kind: 'table',
      defaultQuery: {},
      validateQuery: (q, ctx) => {
        receivedPreference = ctx.preference;
        return { ok: true, query: q };
      },
      renderToBlocks: () => [],
    };
    const reg = new TabViewRegistry().register(echoView);
    // Write a preference for echoView key + read it.
    await prefStore.write({
      principal,
      preference: {
        entityType: 'employee.test',
        viewKey: 'employee.roster.table.test',
        scope: 'conversation',
        sortBy: [{ field: 'rating', direction: 'desc' }],
      },
      conversationId: 'conv-1',
    });
    await renderTabInChat(
      { viewKey: 'employee.roster.table.test', preferenceScope: 'conversation' },
      { principal, conversationId: 'conv-1' },
      { registry: reg, dataPort: stubPort({}), audit, preferenceStore: prefStore },
    );
    expect(receivedPreference).toMatchObject({
      viewKey: 'employee.roster.table.test',
      sortBy: [{ field: 'rating', direction: 'desc' }],
    });
  });

  it('explicit applyPreference overrides the store lookup', async () => {
    const audit = createInMemoryAuditSink();
    const prefStore = createInMemoryCustomizationStore();
    let received: unknown = undefined;
    const view: TabView<unknown, unknown> = {
      key: 'override-test',
      label: 'X',
      entity_type: 'x',
      view_kind: 'table',
      defaultQuery: {},
      validateQuery: (q, ctx) => {
        received = ctx.preference;
        return { ok: true, query: q };
      },
      renderToBlocks: () => [],
    };
    const reg = new TabViewRegistry().register(view);
    const principal = ownerCustomer({ principalId: 'p1', tenantId: 't1' });
    await prefStore.write({
      principal,
      preference: {
        entityType: 'x',
        viewKey: 'override-test',
        scope: 'conversation',
        sortBy: [{ field: 'a', direction: 'asc' }],
      },
      conversationId: 'conv-1',
    });

    await renderTabInChat(
      {
        viewKey: 'override-test',
        applyPreference: {
          id: 'p-override',
          entityType: 'x',
          viewKey: 'override-test',
          scope: 'conversation',
          sortBy: [{ field: 'b', direction: 'desc' }],
          updatedAt: '2026-05-19T00:00:00.000Z',
        },
      },
      { principal, conversationId: 'conv-1' },
      { registry: reg, dataPort: stubPort({}), audit, preferenceStore: prefStore },
    );
    expect((received as { sortBy?: { field: string }[] })?.sortBy?.[0]?.field).toBe('b');
  });
});

describe('renderTabInChat — error surfaces', () => {
  it('returns fetch-failed when the data port throws', async () => {
    const audit = createInMemoryAuditSink();
    const port: DataPort = {
      async fetchViewData(): Promise<DataFetchResult<unknown>> {
        throw new Error('boom');
      },
    };
    const r = await renderTabInChat(
      { viewKey: 'employee.roster.table' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry: createSeedTabViewRegistry(), dataPort: port, audit },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('fetch-failed');
      expect(r.error.message).toMatch(/boom/);
    }
  });

  it('returns render-failed when the view throws on renderToBlocks', async () => {
    const audit = createInMemoryAuditSink();
    const bad: TabView<unknown, unknown> = {
      key: 'bad',
      label: 'Bad',
      entity_type: 'bad',
      view_kind: 'table',
      defaultQuery: {},
      validateQuery: (q) => ({ ok: true, query: q }),
      renderToBlocks: () => {
        throw new Error('render boom');
      },
    };
    const reg = new TabViewRegistry().register(bad);
    const r = await renderTabInChat(
      { viewKey: 'bad' },
      { principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }) },
      { registry: reg, dataPort: stubPort({}), audit },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('render-failed');
      expect(r.error.message).toMatch(/render boom/);
    }
  });
});
