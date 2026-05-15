'use client';

/**
 * AdaptiveRenderer — dispatches `AgUiUiPart` → primitive component.
 *
 * Anti-patterns enforced:
 *   - render only on COMPLETE `tool-output-available` payload — never
 *     streamed piece-by-piece
 *   - LLM never emits classnames or JSX; primitives own all rendering
 *   - unknown `kind` renders a small placeholder, never crashes
 *
 * This switch is the contractual boundary between the brain's emit
 * vocabulary and the admin console's display layer. Adding a new
 * primitive requires touching this file + the registry.
 */

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
import { GenUiError } from './Frame';

export interface AdaptiveRendererProps {
  readonly uiPart: AgUiUiPart;
}

export function AdaptiveRenderer({ uiPart }: AdaptiveRendererProps): JSX.Element {
  switch (uiPart.kind) {
    case 'chart-vega':
      return <VegaChart {...uiPart} />;
    case 'data-table':
      return <DataTable {...uiPart} />;
    case 'timeline':
      return <Timeline {...uiPart} />;
    case 'kpi-grid':
      return <KpiGrid {...uiPart} />;
    case 'prefill-form':
      return <PrefillForm {...uiPart} />;
    case 'approval':
      return <ApprovalDialog {...uiPart} />;
    case 'workflow':
      return <WorkflowStepper {...uiPart} />;
    case 'map':
      return <MapView {...uiPart} />;
    case 'calendar':
      return <CalendarView {...uiPart} />;
    case 'file-preview':
      return <FilePreview {...uiPart} />;
    default: {
      // Defensive: a future brain version might emit a kind this
      // client doesn't yet know. Renders an obvious "unknown" badge
      // so the user knows it's missing without crashing the console.
      const unknown = uiPart as { kind?: string };
      return (
        <GenUiError
          kind="unknown"
          message={`unknown UiPart kind: ${unknown.kind ?? '(missing)'}`}
        />
      );
    }
  }
}
