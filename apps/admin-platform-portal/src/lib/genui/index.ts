/**
 * Generative-UI barrel — re-export shim.
 *
 * The 10 primitives, registry, schemas and AdaptiveRenderer now live in
 * `@bossnyumba/genui` so all four BOSSNYUMBA portals can render the same
 * typed AG-UI `uiParts[]` payloads. This file keeps the legacy
 * `@/lib/genui` import path working for admin-platform-portal — new code
 * should import from `@bossnyumba/genui` directly.
 */

export {
  AdaptiveRenderer,
  GENUI_REGISTRY,
  GENUI_KINDS,
  VegaChart,
  DataTable,
  Timeline,
  KpiGrid,
  PrefillForm,
  ApprovalDialog,
  WorkflowStepper,
  MapView,
  CalendarView,
  FilePreview,
  UnknownKindCard,
  Frame,
  GenUiError,
  ClientOnly,
  ChartVegaPartSchema,
  DataTablePartSchema,
  TimelinePartSchema,
  KpiGridPartSchema,
  PrefillFormPartSchema,
  ApprovalPartSchema,
  WorkflowPartSchema,
  MapPartSchema,
  CalendarPartSchema,
  FilePreviewPartSchema,
  PART_SCHEMAS,
  validateVegaSpec,
  quickVegaShapeCheck,
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDate,
  formatCell,
} from '@bossnyumba/genui';

export type {
  AdaptiveRendererProps,
  AgUiUiPart,
  AgUiUiPartByKind,
  VegaLiteSpec,
  DataTableColumn,
  TimelineEvent,
  KpiTile,
  WorkflowStep,
  MapMarker,
  CalendarEvent,
  PartKind,
  Currency,
} from '@bossnyumba/genui';
