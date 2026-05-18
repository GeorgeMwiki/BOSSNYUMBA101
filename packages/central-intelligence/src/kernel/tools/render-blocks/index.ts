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
  // ProdFix-7 Tier-1
  renderKanbanTool,
  renderDashboardGridTool,
  renderHeatmapTool,
  renderMarkdownCardTool,
  renderPromptSuggestionsTool,
  renderEvidenceCardTool,
  // ProdFix-7 Tier-2
  renderTreeTool,
  renderDiffViewTool,
  renderGaugeTool,
  renderMetricSparklineTool,
  renderImageAnnotationTool,
  renderSignaturePadTool,
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
  // ProdFix-7 sub-types
  type KanbanCard,
  type KanbanColumn,
  type MarkdownCitation,
  type PromptSuggestion,
  type TreeAction,
  type TreeNode,
  type ImageAnnotation,
  type GaugeThreshold,
  type SignatureAction,
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
  // ProdFix-7 schemas
  KanbanPartSchema,
  KanbanColumnSchema,
  KanbanCardSchema,
  DashboardGridPartSchema,
  DashboardGridCellSchema,
  HeatmapPartSchema,
  MarkdownCardPartSchema,
  MarkdownCitationSchema,
  PromptSuggestionsPartSchema,
  PromptSuggestionSchema,
  EvidenceCardPartSchema,
  TreePartSchema,
  TreeNodeSchema,
  DiffViewPartSchema,
  GaugePartSchema,
  MetricSparklinePartSchema,
  ImageAnnotationPartSchema,
  ImageAnnotationSchema,
  SignaturePadPartSchema,
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
  type KanbanPart,
  type DashboardGridPart,
  type HeatmapPart,
  type MarkdownCardPart,
  type PromptSuggestionsPart,
  type EvidenceCardPart,
  type TreePart,
  type DiffViewPart,
  type GaugePart,
  type MetricSparklinePart,
  type ImageAnnotationPart,
  type SignaturePadPart,
  type PartKind,
} from './schemas.js';

export {
  validateVegaSpec,
  type VegaSpecValidation,
} from './validate.js';

export {
  createRenderBlockTool,
} from './tool-factory.js';
