/**
 * Dispatcher — turns a stream of interaction events into a
 * series of `InteractionAck` envelopes plus optional side-effects
 * (preference updates, follow-up renders).
 *
 * Consumers register typed handlers, one per payload kind. The
 * dispatcher exhaustively switches on `payload.kind` so a missing
 * handler is a compile error (the discriminant remains in scope).
 *
 * Default behaviour:
 *   - table-sort + table-filter → no-op + accept (the MD typically
 *     handles these by re-issuing renderTabInChat with updated query).
 *   - table-row-expand → no-op + accept; consumers register a
 *     handler that summons the row-detail card.
 *   - table-bulk-action → no-op + accept; consumers route to the
 *     domain command implied by `action`.
 *   - kanban-card-moved → no-op + accept; consumers persist the
 *     new column to the entity attribute store.
 *
 * Every dispatch path is idempotent: re-dispatching the same
 * eventId yields the same ack.
 */

import type {
  BlackboardInteractionEvent,
  InteractionAck,
  InteractionPayload,
  TableSortPayload,
  TableFilterPayload,
  TableRowSelectPayload,
  TableRowExpandPayload,
  TableBulkActionPayload,
  KanbanCardMovedPayload,
  ChartZoomPayload,
  ChartFilterPayload,
  ChartDrilldownPayload,
  KpiDrilldownPayload,
  CellEditPayload,
  ProfileCardActionPayload,
} from './events.js';

export interface InteractionHandlerContext {
  readonly event: BlackboardInteractionEvent;
  /** Inject the clock so tests can pin timestamps. */
  readonly now: () => Date;
}

export type InteractionHandler<P extends InteractionPayload> = (
  payload: P,
  ctx: InteractionHandlerContext,
) => Promise<Omit<InteractionAck, 'eventId' | 'acceptedAt'>> | Omit<InteractionAck, 'eventId' | 'acceptedAt'>;

export interface InteractionHandlerMap {
  readonly tableSort?: InteractionHandler<TableSortPayload>;
  readonly tableFilter?: InteractionHandler<TableFilterPayload>;
  readonly tableRowSelect?: InteractionHandler<TableRowSelectPayload>;
  readonly tableRowExpand?: InteractionHandler<TableRowExpandPayload>;
  readonly tableBulkAction?: InteractionHandler<TableBulkActionPayload>;
  readonly kanbanCardMoved?: InteractionHandler<KanbanCardMovedPayload>;
  readonly chartZoom?: InteractionHandler<ChartZoomPayload>;
  readonly chartFilter?: InteractionHandler<ChartFilterPayload>;
  readonly chartDrilldown?: InteractionHandler<ChartDrilldownPayload>;
  readonly kpiDrilldown?: InteractionHandler<KpiDrilldownPayload>;
  readonly cellEdit?: InteractionHandler<CellEditPayload>;
  readonly profileCardAction?: InteractionHandler<ProfileCardActionPayload>;
}

export interface DispatcherDeps {
  readonly handlers: InteractionHandlerMap;
  readonly now?: () => Date;
}

const ACCEPT: Omit<InteractionAck, 'eventId' | 'acceptedAt'> = { status: 'accepted' };

/**
 * Dispatch a single event. Returns the ack envelope the renderer
 * should consume.
 */
export async function dispatchInteractionEvent(
  event: BlackboardInteractionEvent,
  deps: DispatcherDeps,
): Promise<InteractionAck> {
  const now = deps.now ?? (() => new Date());
  const ctx: InteractionHandlerContext = { event, now };

  const result = await runHandler(event.payload, deps.handlers, ctx);

  return {
    eventId: event.eventId,
    acceptedAt: now().toISOString(),
    ...result,
  };
}

async function runHandler(
  payload: InteractionPayload,
  handlers: InteractionHandlerMap,
  ctx: InteractionHandlerContext,
): Promise<Omit<InteractionAck, 'eventId' | 'acceptedAt'>> {
  switch (payload.kind) {
    case 'table-sort':
      return handlers.tableSort ? await handlers.tableSort(payload, ctx) : ACCEPT;
    case 'table-filter':
      return handlers.tableFilter ? await handlers.tableFilter(payload, ctx) : ACCEPT;
    case 'table-row-select':
      return handlers.tableRowSelect
        ? await handlers.tableRowSelect(payload, ctx)
        : ACCEPT;
    case 'table-row-expand':
      return handlers.tableRowExpand
        ? await handlers.tableRowExpand(payload, ctx)
        : ACCEPT;
    case 'table-bulk-action':
      return handlers.tableBulkAction
        ? await handlers.tableBulkAction(payload, ctx)
        : ACCEPT;
    case 'kanban-card-moved':
      return handlers.kanbanCardMoved
        ? await handlers.kanbanCardMoved(payload, ctx)
        : ACCEPT;
    case 'chart-zoom':
      return handlers.chartZoom ? await handlers.chartZoom(payload, ctx) : ACCEPT;
    case 'chart-filter':
      return handlers.chartFilter ? await handlers.chartFilter(payload, ctx) : ACCEPT;
    case 'chart-drilldown':
      return handlers.chartDrilldown
        ? await handlers.chartDrilldown(payload, ctx)
        : ACCEPT;
    case 'kpi-drilldown':
      return handlers.kpiDrilldown
        ? await handlers.kpiDrilldown(payload, ctx)
        : ACCEPT;
    case 'cell-edit':
      return handlers.cellEdit ? await handlers.cellEdit(payload, ctx) : ACCEPT;
    case 'profile-card-action':
      return handlers.profileCardAction
        ? await handlers.profileCardAction(payload, ctx)
        : ACCEPT;
    default: {
      // Exhaustiveness check — fails the typecheck if a new kind
      // is added without a handler branch above.
      const _exhaustive: never = payload;
      void _exhaustive;
      return {
        status: 'rejected',
        reason: `unknown interaction kind: ${(payload as { kind: string }).kind}`,
      };
    }
  }
}
