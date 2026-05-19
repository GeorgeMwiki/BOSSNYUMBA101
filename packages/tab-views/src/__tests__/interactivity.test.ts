/**
 * Interactivity protocol tests.
 *
 * Pins event-builder shape, dispatcher routing, and the exhaustiveness
 * guard that keeps the discriminator typesafe.
 */

import { describe, expect, it } from 'vitest';
import {
  buildInteractionEvent,
  buildTableSortEvent,
  buildTableFilterEvent,
  buildTableRowExpandEvent,
  buildTableBulkActionEvent,
  buildKanbanCardMovedEvent,
  buildChartZoomEvent,
  buildChartDrilldownEvent,
  buildKpiDrilldownEvent,
  buildCellEditEvent,
  buildProfileCardActionEvent,
  buildTableRowSelectEvent,
  buildChartFilterEvent,
  type EventEnvelope,
} from '../interactivity/event-builders.js';
import {
  dispatchInteractionEvent,
  type InteractionHandlerMap,
} from '../interactivity/dispatcher.js';
import { ownerCustomer } from '../types/principal.js';

function envelope(): EventEnvelope {
  return {
    viewKey: 'employee.roster.table',
    entityType: 'employee',
    principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }),
    conversationId: 'conv-1',
    sessionId: 'sess-1',
    now: () => new Date('2026-05-19T12:00:00.000Z'),
  };
}

describe('Event builders', () => {
  it('buildInteractionEvent stamps eventId + emittedAt', () => {
    const e = buildInteractionEvent(envelope(), {
      kind: 'table-sort',
      column: 'name',
      direction: 'asc',
    });
    expect(e.eventId).toMatch(/^evt-/);
    expect(e.emittedAt).toBe('2026-05-19T12:00:00.000Z');
    expect(e.viewKey).toBe('employee.roster.table');
    expect(e.entityType).toBe('employee');
  });

  it('buildTableSortEvent emits payload.kind=table-sort', () => {
    const e = buildTableSortEvent(envelope(), { column: 'name', direction: 'asc' });
    expect(e.payload).toEqual({ kind: 'table-sort', column: 'name', direction: 'asc' });
  });

  it('buildTableFilterEvent emits payload.kind=table-filter', () => {
    const e = buildTableFilterEvent(envelope(), {
      filters: [{ field: 'role', op: 'eq', value: 'caretaker' }],
    });
    expect(e.payload.kind).toBe('table-filter');
  });

  it('buildTableRowSelectEvent supports select-all', () => {
    const e = buildTableRowSelectEvent(envelope(), {
      mode: 'select-all',
      rowIds: [],
    });
    expect(e.payload.kind).toBe('table-row-select');
    if (e.payload.kind === 'table-row-select') expect(e.payload.mode).toBe('select-all');
  });

  it('buildTableRowExpandEvent surfaces entityId', () => {
    const e = buildTableRowExpandEvent(envelope(), { entityId: 'emp-42' });
    if (e.payload.kind === 'table-row-expand') expect(e.payload.entityId).toBe('emp-42');
  });

  it('buildTableBulkActionEvent surfaces action + ids', () => {
    const e = buildTableBulkActionEvent(envelope(), {
      action: 'send-reminder',
      entityIds: ['t1', 't2'],
    });
    if (e.payload.kind === 'table-bulk-action') {
      expect(e.payload.action).toBe('send-reminder');
      expect(e.payload.entityIds).toEqual(['t1', 't2']);
    }
  });

  it('buildKanbanCardMovedEvent surfaces from/to columns + newIndex', () => {
    const e = buildKanbanCardMovedEvent(envelope(), {
      cardId: 'card-1',
      fromColumn: 'open',
      toColumn: 'in-progress',
      newIndex: 2,
    });
    if (e.payload.kind === 'kanban-card-moved') {
      expect(e.payload.fromColumn).toBe('open');
      expect(e.payload.toColumn).toBe('in-progress');
      expect(e.payload.newIndex).toBe(2);
    }
  });

  it('buildChartZoomEvent supports xFrom/xTo', () => {
    const e = buildChartZoomEvent(envelope(), {
      xFrom: '2026-01-01T00:00:00.000Z',
      xTo: '2026-03-31T00:00:00.000Z',
    });
    if (e.payload.kind === 'chart-zoom') {
      expect(e.payload.xFrom).toBe('2026-01-01T00:00:00.000Z');
    }
  });

  it('buildChartFilterEvent surfaces selected series', () => {
    const e = buildChartFilterEvent(envelope(), { series: ['rent', 'arrears'] });
    if (e.payload.kind === 'chart-filter') {
      expect(e.payload.series).toEqual(['rent', 'arrears']);
    }
  });

  it('buildChartDrilldownEvent surfaces the clicked X value', () => {
    const e = buildChartDrilldownEvent(envelope(), { xValue: 'May 2026' });
    if (e.payload.kind === 'chart-drilldown') {
      expect(e.payload.xValue).toBe('May 2026');
    }
  });

  it('buildKpiDrilldownEvent surfaces the tile label', () => {
    const e = buildKpiDrilldownEvent(envelope(), { tileLabel: 'Occupancy' });
    if (e.payload.kind === 'kpi-drilldown') {
      expect(e.payload.tileLabel).toBe('Occupancy');
    }
  });

  it('buildCellEditEvent surfaces before/after', () => {
    const e = buildCellEditEvent(envelope(), {
      entityId: 'emp-1',
      attributeKey: 'name',
      previousValue: 'Asha',
      newValue: 'Aisha',
    });
    if (e.payload.kind === 'cell-edit') {
      expect(e.payload.previousValue).toBe('Asha');
      expect(e.payload.newValue).toBe('Aisha');
    }
  });

  it('buildProfileCardActionEvent surfaces actionId + entityId', () => {
    const e = buildProfileCardActionEvent(envelope(), {
      actionId: 'mark-paid',
      entityId: 'kra-F1',
    });
    if (e.payload.kind === 'profile-card-action') {
      expect(e.payload.actionId).toBe('mark-paid');
    }
  });

  it('event IDs are unique across successive builds', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const e = buildTableSortEvent(envelope(), { column: 'name', direction: 'asc' });
      ids.add(e.eventId);
    }
    expect(ids.size).toBe(50);
  });
});

describe('Dispatcher', () => {
  it('returns accepted by default when no handler is registered', async () => {
    const e = buildTableSortEvent(envelope(), { column: 'name', direction: 'asc' });
    const ack = await dispatchInteractionEvent(e, { handlers: {} });
    expect(ack.status).toBe('accepted');
    expect(ack.eventId).toBe(e.eventId);
  });

  it('routes table-sort to its handler', async () => {
    const e = buildTableSortEvent(envelope(), { column: 'rating', direction: 'desc' });
    let seenColumn = '';
    const handlers: InteractionHandlerMap = {
      tableSort: (p) => {
        seenColumn = p.column;
        return { status: 'accepted' };
      },
    };
    await dispatchInteractionEvent(e, { handlers });
    expect(seenColumn).toBe('rating');
  });

  it('routes table-row-expand to its handler with follow-up parts', async () => {
    const e = buildTableRowExpandEvent(envelope(), { entityId: 'emp-1' });
    const handlers: InteractionHandlerMap = {
      tableRowExpand: () => ({
        status: 'accepted',
        followUpParts: [
          { kind: 'markdown-card', markdown: 'Detail' },
        ],
      }),
    };
    const ack = await dispatchInteractionEvent(e, { handlers });
    expect(ack.followUpParts?.length).toBe(1);
    expect(ack.followUpParts?.[0]?.kind).toBe('markdown-card');
  });

  it('routes kanban-card-moved to its handler', async () => {
    const e = buildKanbanCardMovedEvent(envelope(), {
      cardId: 'c1',
      fromColumn: 'open',
      toColumn: 'closed',
      newIndex: 0,
    });
    let moved = false;
    const handlers: InteractionHandlerMap = {
      kanbanCardMoved: () => {
        moved = true;
        return { status: 'accepted' };
      },
    };
    await dispatchInteractionEvent(e, { handlers });
    expect(moved).toBe(true);
  });

  it('supports async handlers', async () => {
    const e = buildTableBulkActionEvent(envelope(), {
      action: 'send-reminder',
      entityIds: ['t1'],
    });
    const handlers: InteractionHandlerMap = {
      tableBulkAction: async () => {
        await Promise.resolve();
        return { status: 'queued' };
      },
    };
    const ack = await dispatchInteractionEvent(e, { handlers });
    expect(ack.status).toBe('queued');
  });

  it('ack carries the right eventId and an accepted timestamp', async () => {
    const e = buildTableSortEvent(envelope(), { column: 'name', direction: 'asc' });
    const ack = await dispatchInteractionEvent(e, {
      handlers: {},
      now: () => new Date('2026-05-19T15:00:00.000Z'),
    });
    expect(ack.eventId).toBe(e.eventId);
    expect(ack.acceptedAt).toBe('2026-05-19T15:00:00.000Z');
  });

  it('handler may reject explicitly', async () => {
    const e = buildTableBulkActionEvent(envelope(), {
      action: 'delete-everything',
      entityIds: ['*'],
    });
    const handlers: InteractionHandlerMap = {
      tableBulkAction: () => ({
        status: 'rejected',
        reason: 'wildcard delete not allowed in chat',
      }),
    };
    const ack = await dispatchInteractionEvent(e, { handlers });
    expect(ack.status).toBe('rejected');
    expect(ack.reason).toMatch(/wildcard/);
  });

  it('every payload kind routes through dispatcher', async () => {
    // Make sure every discriminator branch has a default route.
    const events = [
      buildTableSortEvent(envelope(), { column: 'c', direction: 'asc' }),
      buildTableFilterEvent(envelope(), { filters: [] }),
      buildTableRowSelectEvent(envelope(), { mode: 'clear', rowIds: [] }),
      buildTableRowExpandEvent(envelope(), { entityId: 'e1' }),
      buildTableBulkActionEvent(envelope(), { action: 'x', entityIds: [] }),
      buildKanbanCardMovedEvent(envelope(), {
        cardId: 'c',
        fromColumn: 'a',
        toColumn: 'b',
        newIndex: 0,
      }),
      buildChartZoomEvent(envelope(), {}),
      buildChartFilterEvent(envelope(), { series: [] }),
      buildChartDrilldownEvent(envelope(), { xValue: 'q1' }),
      buildKpiDrilldownEvent(envelope(), { tileLabel: 'Occupancy' }),
      buildCellEditEvent(envelope(), {
        entityId: 'e1',
        attributeKey: 'name',
        previousValue: 'a',
        newValue: 'b',
      }),
      buildProfileCardActionEvent(envelope(), { actionId: 'x', entityId: 'e1' }),
    ];
    for (const e of events) {
      const ack = await dispatchInteractionEvent(e, { handlers: {} });
      expect(ack.status, e.payload.kind).toBe('accepted');
    }
  });
});
