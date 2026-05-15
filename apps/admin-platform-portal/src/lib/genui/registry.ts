/**
 * Generative-UI primitive registry.
 *
 * `kind → React component`. AdaptiveRenderer uses this map to dispatch
 * `AgUiUiPart` payloads to the correct primitive without a large
 * switch statement (the switch lives in AdaptiveRenderer.tsx, but
 * tests use this registry to assert every kind is wired).
 *
 * Adding a new primitive:
 *   1. Add the schema in `./schemas/index.ts`
 *   2. Add the component file alongside the existing primitives
 *   3. Register it here AND in AdaptiveRenderer.tsx
 *   4. Add a server-side render-block tool in
 *      `packages/central-intelligence/.../render-blocks/`
 */

import type { ComponentType } from 'react';

import type { AgUiUiPart } from './types';
import { VegaChart } from './VegaChart';
import { DataTable } from './DataTable';
import { Timeline } from './Timeline';
import { KpiGrid } from './KpiGrid';
import { PrefillForm } from './PrefillForm';
import { ApprovalDialog } from './ApprovalDialog';
import { WorkflowStepper } from './WorkflowStepper';
import { MapView } from './MapView';
import { CalendarView } from './CalendarView';
import { FilePreview } from './FilePreview';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GENUI_REGISTRY: Record<AgUiUiPart['kind'], ComponentType<any>> = {
  'chart-vega': VegaChart,
  'data-table': DataTable,
  timeline: Timeline,
  'kpi-grid': KpiGrid,
  'prefill-form': PrefillForm,
  approval: ApprovalDialog,
  workflow: WorkflowStepper,
  map: MapView,
  calendar: CalendarView,
  'file-preview': FilePreview,
};

export const GENUI_KINDS = Object.keys(GENUI_REGISTRY) as ReadonlyArray<
  AgUiUiPart['kind']
>;
