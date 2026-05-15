/**
 * Render-blocks public surface.
 *
 * The 10 server-side tool wrappers that let the brain emit generative
 * UI primitives. Each tool validates payloads with Zod + (for chart
 * specs) ajv before returning. Failures collapse to ToolOutcome.error
 * so the agent loop can repair-pass.
 *
 * Anti-patterns enforced:
 *   - LLM emits values only — schemas are server-owned
 *   - LLM never emits raw JSX / Tailwind classnames
 *   - chart-vega specs are ajv-validated before render
 *   - prefill-form actions must POST to api-gateway (not the agent)
 */

export {
  // tools
  renderChartVegaTool,
  renderDataTableTool,
  renderTimelineTool,
  renderKpiGridTool,
  renderPrefillFormTool,
  renderApprovalTool,
  renderWorkflowTool,
  renderMapTool,
  renderCalendarTool,
  renderFilePreviewTool,
  // bundle
  createRenderBlockTools,
  type RenderBlockToolBundle,
} from './tools.js';

export {
  // types
  type AgUiUiPart,
  type AgUiUiPartByKind,
  type AgUiUiPartKind,
  type VegaLiteSpec,
  type DataTableColumn,
  type TimelineEvent,
  type KpiTile,
  type WorkflowStep,
  type MapMarker,
  type CalendarEvent,
  AG_UI_UI_PART_KINDS,
} from './ag-ui-types.js';

export {
  // schemas (re-exported for client consumers)
  AgUiUiPartSchema,
  ChartVegaPartSchema,
  DataTablePartSchema,
  DataTableColumnSchema,
  TimelinePartSchema,
  TimelineEventSchema,
  KpiGridPartSchema,
  KpiTileSchema,
  PrefillFormPartSchema,
  ApprovalPartSchema,
  WorkflowPartSchema,
  WorkflowStepSchema,
  MapPartSchema,
  MapMarkerSchema,
  CalendarPartSchema,
  CalendarEventSchema,
  FilePreviewPartSchema,
  PART_SCHEMAS,
  type AnyAgUiUiPart,
  type ChartVegaPart,
  type DataTablePart,
  type TimelinePart,
  type KpiGridPart,
  type PrefillFormPart,
  type ApprovalPart,
  type WorkflowPart,
  type MapPart,
  type CalendarPart,
  type FilePreviewPart,
  type PartKind,
} from './schemas.js';

export {
  validateVegaSpec,
  type VegaSpecValidation,
} from './validate.js';

export {
  createRenderBlockTool,
} from './tool-factory.js';
