/**
 * Generative-UI barrel — 10 primitives, registry, AdaptiveRenderer.
 *
 * Consumers (e.g. JarvisConsole) import only `AdaptiveRenderer` and
 * `AgUiUiPart`. The individual primitives are exported for tests +
 * future code-splitting.
 */

export { AdaptiveRenderer } from './AdaptiveRenderer';
export type { AdaptiveRendererProps } from './AdaptiveRenderer';

export { GENUI_REGISTRY, GENUI_KINDS } from './registry';

export { VegaChart } from './VegaChart';
export { DataTable } from './DataTable';
export { Timeline } from './Timeline';
export { KpiGrid } from './KpiGrid';
export { PrefillForm } from './PrefillForm';
export { ApprovalDialog } from './ApprovalDialog';
export { WorkflowStepper } from './WorkflowStepper';
export { MapView } from './MapView';
export { CalendarView } from './CalendarView';
export { FilePreview } from './FilePreview';

export { Frame, GenUiError } from './Frame';

export type {
  AgUiUiPart,
  AgUiUiPartByKind,
  VegaLiteSpec,
  DataTableColumn,
  TimelineEvent,
  KpiTile,
  WorkflowStep,
  MapMarker,
  CalendarEvent,
} from './types';

export {
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
  type PartKind,
} from './schemas';

export { validateVegaSpec, quickVegaShapeCheck } from './validate';
