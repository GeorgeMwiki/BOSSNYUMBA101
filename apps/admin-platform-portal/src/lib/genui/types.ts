/**
 * Client-side AG-UI UiPart types.
 *
 * Mirrors `packages/central-intelligence/src/kernel/tools/render-blocks/ag-ui-types.ts`
 * — kept local so the client doesn't pull the server kernel into its
 * bundle. The shapes MUST stay in lock-step. The shared Zod schemas
 * under `./schemas/` are the cross-boundary validator; this module
 * is types-only.
 *
 * When C1 lands `packages/central-intelligence/src/kernel/streaming/
 * ag-ui-types.ts`, replace this file with a re-export from there.
 */

export type VegaLiteSpec = Readonly<Record<string, unknown>>;

export interface DataTableColumn {
  readonly id: string;
  readonly header: string;
  readonly accessorKey: string;
  readonly format?: 'text' | 'currency' | 'percent' | 'number' | 'date';
  readonly currency?: 'KES' | 'TZS' | 'USD';
  readonly enableSorting?: boolean;
}

export interface TimelineEvent {
  readonly timestamp: string;
  readonly title: string;
  readonly description?: string;
  readonly severity?: 'info' | 'warn' | 'error' | 'success';
  readonly icon?: string;
}

export interface KpiTile {
  readonly label: string;
  readonly value: number | string;
  readonly delta?: number;
  readonly deltaDirection?: 'up' | 'down' | 'flat';
  readonly format: 'currency' | 'percent' | 'number';
  readonly currency?: 'KES' | 'TZS' | 'USD';
}

export interface WorkflowStep {
  readonly label: string;
  readonly status: 'pending' | 'running' | 'done' | 'failed';
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export interface MapMarker {
  readonly position: readonly [number, number];
  readonly popup?: string;
}

export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly start: string;
  readonly end?: string;
  readonly color?: string;
}

export type AgUiUiPart =
  | {
      readonly kind: 'chart-vega';
      readonly title?: string;
      readonly spec: VegaLiteSpec;
      readonly data: ReadonlyArray<Readonly<Record<string, unknown>>>;
    }
  | {
      readonly kind: 'data-table';
      readonly title?: string;
      readonly columns: ReadonlyArray<DataTableColumn>;
      readonly rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
      readonly pageSize?: number;
    }
  | {
      readonly kind: 'timeline';
      readonly title?: string;
      readonly events: ReadonlyArray<TimelineEvent>;
    }
  | {
      readonly kind: 'kpi-grid';
      readonly title?: string;
      readonly tiles: ReadonlyArray<KpiTile>;
    }
  | {
      readonly kind: 'prefill-form';
      readonly title?: string;
      readonly formId: string;
      readonly schemaJson: Readonly<Record<string, unknown>>;
      readonly values: Readonly<Record<string, unknown>>;
      readonly action: string;
      readonly diffMode?: boolean;
    }
  | {
      readonly kind: 'approval';
      readonly title?: string;
      readonly action: string;
      readonly payload: Readonly<Record<string, unknown>>;
      readonly diff: Readonly<Record<string, unknown>>;
      readonly checklist: readonly [string, string, string, string, string];
    }
  | {
      readonly kind: 'workflow';
      readonly title?: string;
      readonly steps: ReadonlyArray<WorkflowStep>;
      readonly currentIndex: number;
    }
  | {
      readonly kind: 'map';
      readonly title?: string;
      readonly center: readonly [number, number];
      readonly zoom: number;
      readonly markers: ReadonlyArray<MapMarker>;
    }
  | {
      readonly kind: 'calendar';
      readonly title?: string;
      readonly events: ReadonlyArray<CalendarEvent>;
      readonly view?: 'dayGrid' | 'timeGrid' | 'list';
    }
  | {
      readonly kind: 'file-preview';
      readonly title?: string;
      readonly url: string;
      readonly mimeType: string;
      readonly name: string;
      readonly sizeBytes?: number;
    };

export type AgUiUiPartByKind<K extends AgUiUiPart['kind']> = Extract<
  AgUiUiPart,
  { kind: K }
>;
