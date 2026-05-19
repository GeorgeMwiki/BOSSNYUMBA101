/**
 * @bossnyumba/tab-views/interactivity — event protocol surface.
 */

export type {
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

export {
  buildInteractionEvent,
  buildTableSortEvent,
  buildTableFilterEvent,
  buildTableRowSelectEvent,
  buildTableRowExpandEvent,
  buildTableBulkActionEvent,
  buildKanbanCardMovedEvent,
  buildChartZoomEvent,
  buildChartFilterEvent,
  buildChartDrilldownEvent,
  buildKpiDrilldownEvent,
  buildCellEditEvent,
  buildProfileCardActionEvent,
  type EventEnvelope,
} from './event-builders.js';

export {
  dispatchInteractionEvent,
  type DispatcherDeps,
  type InteractionHandler,
  type InteractionHandlerMap,
  type InteractionHandlerContext,
} from './dispatcher.js';
