/**
 * K-G integration tests.
 *
 * Each test exercises the full chain: registry → render-tool →
 * data-port (stub) → ag-ui blocks → interactivity event → ack +
 * preference write → second render with preference applied.
 *
 * 8 scenarios, mirroring the K-G acceptance criteria:
 *
 *   1. "Show me my top-5 employees" — end-to-end render
 *   2. "What's my occupancy" — KPI grid + drilldown event
 *   3. Owner taps a row → expand-row event → follow-up render
 *   4. Bulk-action toolbar emits send-reminder → MD ack
 *   5. Sort customization persists across renders
 *   6. Cross-tenant isolation under pressure
 *   7. Tool descriptor reflects every registered view
 *   8. Renderer round-trips citations end-to-end
 */

import { describe, expect, it } from 'vitest';
import {
  renderTabInChat,
} from '../render-tool/render-tab-in-chat.js';
import {
  describeRenderTabInChatTool,
} from '../render-tool/tool-descriptor.js';
import { createInMemoryAuditSink } from '../render-tool/audit-sink.js';
import type { DataPort, DataFetchResult } from '../render-tool/data-port.js';
import { createSeedTabViewRegistry } from '../registry/seed.js';
import { internalAdmin, ownerCustomer } from '../types/principal.js';
import {
  createInMemoryCustomizationStore,
} from '../customization/preference-store.js';
import {
  applyEventToPreference,
  emptyPreference,
} from '../customization/preference-derivation.js';
import {
  buildTableSortEvent,
  buildTableRowExpandEvent,
  buildKpiDrilldownEvent,
  buildTableBulkActionEvent,
} from '../interactivity/event-builders.js';
import {
  dispatchInteractionEvent,
} from '../interactivity/dispatcher.js';

const principal = ownerCustomer({ principalId: 'p1', tenantId: 't1' });

describe('K-G integration', () => {
  it('1. "show me my top-5 employees by tickets-closed" — full render', async () => {
    const registry = createSeedTabViewRegistry();
    const audit = createInMemoryAuditSink();
    const port: DataPort = {
      async fetchViewData<TData>(): Promise<DataFetchResult<TData>> {
        const rows = [
          {
            id: 'e1', name: 'Asha', role: 'caretaker', properties_managed: 5,
            tickets_closed_30d: 30, avg_ticket_resolution_hours: 2,
            rating: 4.8, last_activity_at: '2026-05-19T00:00:00.000Z',
          },
          {
            id: 'e2', name: 'Brenda', role: 'caretaker', properties_managed: 3,
            tickets_closed_30d: 28, avg_ticket_resolution_hours: 3,
            rating: 4.5, last_activity_at: '2026-05-19T00:00:00.000Z',
          },
        ];
        return { data: { rows } as TData, citations: [], crossTenant: false };
      },
    };
    const r = await renderTabInChat(
      {
        entity_type: 'employee',
        limit: 5,
        sortBy: 'tickets_closed_30d',
        sortDir: 'desc',
      },
      { principal },
      { registry, dataPort: port, audit },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.viewKey).toBe('employee.roster.table');
      expect(r.parts[0]?.kind).toBe('data-table');
      const rows = (r.parts[0] as unknown as { rows: { name: string }[] }).rows;
      expect(rows.map((row) => row.name)).toEqual(['Asha', 'Brenda']);
    }
    expect(audit.events.length).toBe(1);
  });

  it('2. "what is my occupancy" — KPI grid + drilldown event flow', async () => {
    const registry = createSeedTabViewRegistry();
    const audit = createInMemoryAuditSink();
    const port: DataPort = {
      async fetchViewData<TData>(): Promise<DataFetchResult<TData>> {
        return {
          data: {
            occupancyPct: 88.4,
            occupancyDelta: 2.1,
            revenueCents: 750_000_00,
            revenueDelta: 50_000_00,
            arrearsCount: 3,
            arrearsDelta: -1,
            activeLeases: 42,
            newLeasesThisPeriod: 5,
            periodLabel: 'May 2026',
            currency: 'KES',
          } as TData,
          citations: [],
          crossTenant: false,
        };
      },
    };
    const r = await renderTabInChat(
      { entity_type: 'property' },
      { principal },
      { registry, dataPort: port, audit },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts[0]?.kind).toBe('kpi-grid');
      const tiles = (r.parts[0] as unknown as { tiles: { label: string; value: number }[] }).tiles;
      const occ = tiles.find((t) => t.label === 'Occupancy');
      expect(occ?.value).toBeCloseTo(88.4, 1);
    }

    // Owner taps the Occupancy tile → drilldown event.
    const drillEvent = buildKpiDrilldownEvent(
      { viewKey: 'property.health.kpi-grid', entityType: 'property', principal },
      { tileLabel: 'Occupancy' },
    );
    let drilled = '';
    const ack = await dispatchInteractionEvent(drillEvent, {
      handlers: {
        kpiDrilldown: (p) => {
          drilled = p.tileLabel;
          return {
            status: 'accepted',
            followUpParts: [{ kind: 'chart-vega', title: 'Occupancy trend' }],
          };
        },
      },
    });
    expect(drilled).toBe('Occupancy');
    expect(ack.followUpParts?.[0]?.kind).toBe('chart-vega');
  });

  it('3. "show top arrears" → owner taps row → expand-row → MD streams detail', async () => {
    const registry = createSeedTabViewRegistry();
    const audit = createInMemoryAuditSink();
    const port: DataPort = {
      async fetchViewData<TData>(args): Promise<DataFetchResult<TData>> {
        if (args.options.expandRow?.entityId === 'tnt-42') {
          return {
            data: {
              rows: [
                {
                  id: 'tnt-42', tenantPersonId: 'p42', tenantName: 'Asha Mwangi',
                  leaseId: 'L-3', propertyLabel: '4B Westgate', amountDueCents: 90_000_00,
                  daysLate: 47, rank: 47 * 90_000_00, currency: 'KES',
                  lastContactedAt: '2026-05-10T00:00:00.000Z',
                },
              ],
            } as TData,
            citations: [],
            crossTenant: false,
          };
        }
        return {
          data: {
            rows: [
              {
                id: 'tnt-42', tenantPersonId: 'p42', tenantName: 'Asha Mwangi',
                leaseId: 'L-3', propertyLabel: '4B Westgate', amountDueCents: 90_000_00,
                daysLate: 47, rank: 47 * 90_000_00, currency: 'KES',
              },
              {
                id: 'tnt-43', tenantPersonId: 'p43', tenantName: 'Brenda Otieno',
                leaseId: 'L-7', propertyLabel: '2C Karen', amountDueCents: 30_000_00,
                daysLate: 18, rank: 18 * 30_000_00, currency: 'KES',
              },
            ],
          } as TData,
          citations: [],
          crossTenant: false,
        };
      },
    };
    const r1 = await renderTabInChat(
      { entity_type: 'arrears' },
      { principal },
      { registry, dataPort: port, audit },
    );
    expect(r1.ok).toBe(true);
    // Owner taps row.
    const expandEvent = buildTableRowExpandEvent(
      { viewKey: 'arrears.severity.table', entityType: 'arrears', principal },
      { entityId: 'tnt-42' },
    );
    // The MD dispatches the event AND issues a follow-up render with the
    // expandRow option set.
    const r2 = await renderTabInChat(
      { entity_type: 'arrears', expandRow: { entityId: 'tnt-42' } },
      { principal },
      { registry, dataPort: port, audit },
    );
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      const rows = (r2.parts[0] as unknown as { rows: { id: string }[] }).rows;
      expect(rows.map((row) => row.id)).toEqual(['tnt-42']);
    }
    // Confirm the ack flows.
    const ack = await dispatchInteractionEvent(expandEvent, { handlers: {} });
    expect(ack.status).toBe('accepted');
  });

  it('4. "send reminders to all 7" — bulk-action ack', async () => {
    const registry = createSeedTabViewRegistry();
    const audit = createInMemoryAuditSink();
    const r = await renderTabInChat(
      { entity_type: 'arrears' },
      { principal },
      {
        registry,
        dataPort: {
          async fetchViewData<TData>(): Promise<DataFetchResult<TData>> {
            return {
              data: {
                rows: Array.from({ length: 7 }, (_, i) => ({
                  id: `t${i}`, tenantPersonId: `p${i}`, tenantName: `Tenant ${i}`,
                  leaseId: `L-${i}`, propertyLabel: `Unit ${i}`, amountDueCents: 10_000_00,
                  daysLate: 15, rank: 150_000_00, currency: 'KES',
                })),
              } as TData,
              citations: [],
              crossTenant: false,
            };
          },
        },
        audit,
      },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parts.length).toBe(2);
      expect(r.parts[1]?.kind).toBe('prompt-suggestions');
    }

    // Bulk-action event for "send reminders to all".
    let actionsExecuted = 0;
    const bulkEvent = buildTableBulkActionEvent(
      { viewKey: 'arrears.severity.table', entityType: 'arrears', principal },
      {
        action: 'send-reminder',
        entityIds: Array.from({ length: 7 }, (_, i) => `t${i}`),
      },
    );
    const ack = await dispatchInteractionEvent(bulkEvent, {
      handlers: {
        tableBulkAction: (p) => {
          actionsExecuted = p.entityIds.length;
          return { status: 'queued' };
        },
      },
    });
    expect(ack.status).toBe('queued');
    expect(actionsExecuted).toBe(7);
  });

  it('5. sort customization persists across renders', async () => {
    const registry = createSeedTabViewRegistry();
    const audit = createInMemoryAuditSink();
    const prefStore = createInMemoryCustomizationStore();

    const port: DataPort = {
      async fetchViewData<TData>(): Promise<DataFetchResult<TData>> {
        const rows = [
          {
            id: 'e1', name: 'Charles', role: 'caretaker', properties_managed: 2,
            tickets_closed_30d: 12, avg_ticket_resolution_hours: 3,
            rating: 4.0, last_activity_at: '2026-05-19T00:00:00.000Z',
          },
          {
            id: 'e2', name: 'Asha', role: 'caretaker', properties_managed: 3,
            tickets_closed_30d: 20, avg_ticket_resolution_hours: 2.5,
            rating: 4.8, last_activity_at: '2026-05-19T00:00:00.000Z',
          },
        ];
        return { data: { rows } as TData, citations: [], crossTenant: false };
      },
    };

    // First render — no preference yet. Default sort = tickets_closed_30d desc.
    const r1 = await renderTabInChat(
      { entity_type: 'employee' },
      { principal, conversationId: 'conv-1' },
      { registry, dataPort: port, audit, preferenceStore: prefStore },
    );
    if (!r1.ok) throw new Error('first render failed');

    // Owner sorts by name asc. Derive preference + write.
    const draft = applyEventToPreference(
      emptyPreference({
        viewKey: 'employee.roster.table',
        entityType: 'employee',
        scope: 'conversation',
      }),
      buildTableSortEvent(
        {
          viewKey: 'employee.roster.table',
          entityType: 'employee',
          principal,
        },
        { column: 'name', direction: 'asc' },
      ),
    );
    await prefStore.write({
      principal,
      preference: { ...draft, id: 'p1', updatedAt: '2026-05-19T00:00:00.000Z' },
      conversationId: 'conv-1',
    });

    // Second render — preference is recalled + applied.
    const r2 = await renderTabInChat(
      { entity_type: 'employee', preferenceScope: 'conversation' },
      { principal, conversationId: 'conv-1' },
      { registry, dataPort: port, audit, preferenceStore: prefStore },
    );
    if (!r2.ok) throw new Error('second render failed');
    const rows = (r2.parts[0] as unknown as { rows: { name: string }[] }).rows;
    expect(rows.map((row) => row.name)).toEqual(['Asha', 'Charles']);
  });

  it('6. cross-tenant isolation: tenant-A cannot summon tenant-B data via crafted query', async () => {
    const registry = createSeedTabViewRegistry();
    const audit = createInMemoryAuditSink();

    // Watcher port — records what tenantId it was called with.
    let calledWithTenant: string | undefined;
    let calledWithCrossTenant = false;
    const port: DataPort = {
      async fetchViewData<TData>(args): Promise<DataFetchResult<TData>> {
        calledWithTenant = args.principal.tenantId;
        calledWithCrossTenant = args.options.allowCrossTenant === true;
        return { data: { rows: [] } as TData, citations: [], crossTenant: false };
      },
    };
    const principalA = ownerCustomer({ principalId: 'a', tenantId: 'tenant-A' });

    // Try with allowCrossTenant — should be refused.
    const r1 = await renderTabInChat(
      {
        entity_type: 'employee',
        allowCrossTenant: true,
        crossTenantReason: 'sneaky',
      },
      { principal: principalA },
      { registry, dataPort: port, audit },
    );
    expect(r1.ok).toBe(false);
    expect(calledWithTenant).toBeUndefined(); // Port never reached.

    // Now without the flag — should call port scoped to tenant-A only.
    const r2 = await renderTabInChat(
      { entity_type: 'employee' },
      { principal: principalA },
      { registry, dataPort: port, audit },
    );
    expect(r2.ok).toBe(true);
    expect(calledWithTenant).toBe('tenant-A');
    expect(calledWithCrossTenant).toBe(false);
  });

  it('7. tool descriptor reflects every registered view', () => {
    const registry = createSeedTabViewRegistry();
    const tool = describeRenderTabInChatTool(registry);
    expect(tool.name).toBe('renderTabInChat');
    // Every registered view appears in the description.
    for (const v of registry.all()) {
      expect(tool.description).toContain(v.key);
    }
    // Every entity_type appears in the enum constraint.
    const enumValues = (tool.input_schema as unknown as {
      properties: { entity_type: { enum: string[] } };
    }).properties.entity_type.enum;
    for (const t of registry.entityTypes()) {
      expect(enumValues).toContain(t);
    }
  });

  it('8. citations round-trip end-to-end through the renderer', async () => {
    const registry = createSeedTabViewRegistry();
    const audit = createInMemoryAuditSink();
    const port: DataPort = {
      async fetchViewData<TData>(): Promise<DataFetchResult<TData>> {
        return {
          data: { rows: [] } as TData,
          citations: [
            {
              id: 'c1',
              label: 'Lease L-204 page 3',
              entityId: 'lease-204',
              attributeKey: 'rent_amount_cents',
              attributeVersion: 4,
              confidence: 'high',
            },
            {
              id: 'c2',
              label: 'Property property-77 — units roster',
              entityId: 'property-77',
              attributeKey: 'unit_count',
              attributeVersion: 1,
              confidence: 'medium',
            },
          ],
          crossTenant: false,
          rowCountHint: 0,
        };
      },
    };
    const r = await renderTabInChat(
      { entity_type: 'employee' },
      { principal, sessionId: 'sess-1' },
      { registry, dataPort: port, audit },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.citations.length).toBe(2);
      expect(r.citations[0]?.entityId).toBe('lease-204');
      expect(r.citations[1]?.attributeKey).toBe('unit_count');
    }
    expect(audit.events[0]?.partKindsEmitted).toEqual(['markdown-card']);
  });
});
