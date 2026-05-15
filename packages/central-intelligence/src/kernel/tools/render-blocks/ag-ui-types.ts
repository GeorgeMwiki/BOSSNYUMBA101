/**
 * AG-UI UiPart placeholder.
 *
 * C1 owns `packages/central-intelligence/src/kernel/streaming/ag-ui-types.ts`
 * which will define the canonical `AgUiUiPart` discriminated union once
 * the AG-UI emitter lands. Until then, this module defines the same
 * shape locally so C3 (Generative UI Primitives) can wire its
 * render-block tools without a circular dependency on C1.
 *
 * Coordination rules:
 *   - This file ONLY mirrors `kind` discriminants + payload shapes.
 *   - Once C1 ships, the canonical types replace this file via barrel
 *     re-export. Do NOT add behaviour here — types only.
 *   - The render-block tools below import `AgUiUiPart` from THIS file;
 *     swapping it for the canonical version is a one-line change in
 *     `index.ts`.
 *
 * Contract:
 *   - Server emits a `tool-output-available` event whose `output` is an
 *     `AgUiUiPart`. The client switches on `kind` and renders the
 *     matching primitive. LLM never emits raw JSX, Tailwind classnames,
 *     or schema modifications — values only.
 */

/** Vega-Lite v5 specification (subset). The full spec is large; we
 *  treat it opaquely as `Record<string, unknown>` and ajv-validate it
 *  against the official Vega-Lite v5 JSON schema before render. */
export type VegaLiteSpec = Readonly<Record<string, unknown>>;

/** A column definition for TanStack Table v8. Subset — the full
 *  ColumnDef shape includes function accessors we don't allow from
 *  the LLM (would mean code emission). */
export interface DataTableColumn {
  readonly id: string;
  readonly header: string;
  /** Path to read from each row, e.g. "tenant.name" or "amountMajor". */
  readonly accessorKey: string;
  /** Optional render hint — primitive owns the actual className/JSX. */
  readonly format?: 'text' | 'currency' | 'percent' | 'number' | 'date';
  /** Optional currency code when format === 'currency'. */
  readonly currency?: 'KES' | 'TZS' | 'USD';
  /** Whether the user can sort by this column. Defaults to true. */
  readonly enableSorting?: boolean;
}

export interface TimelineEvent {
  readonly timestamp: string; // ISO-8601
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
  readonly position: readonly [number, number]; // [lat, lng]
  readonly popup?: string;
}

export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly start: string; // ISO-8601
  readonly end?: string;
  readonly color?: string;
}

/**
 * The discriminated union — every generative UI primitive payload the
 * brain can emit. Each variant matches a server-side render-block
 * tool and a client-side React primitive.
 */
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
      /** JSON Schema (Draft-7) — SERVER-OWNED. LLM may NOT modify. */
      readonly schemaJson: Readonly<Record<string, unknown>>;
      readonly values: Readonly<Record<string, unknown>>;
      /** Action URL on api-gateway to POST validated payload. NOT the agent. */
      readonly action: string;
      readonly diffMode?: boolean;
    }
  | {
      readonly kind: 'approval';
      readonly title?: string;
      readonly action: string;
      readonly payload: Readonly<Record<string, unknown>>;
      readonly diff: Readonly<Record<string, unknown>>;
      /** 5-item challenge-and-response checklist per R1 HIL pattern. */
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

/** Narrow `AgUiUiPart` by `kind`. */
export type AgUiUiPartByKind<K extends AgUiUiPart['kind']> = Extract<
  AgUiUiPart,
  { kind: K }
>;

/** All known UiPart kinds — useful for runtime registries / switch
 *  exhaustiveness checks. */
export const AG_UI_UI_PART_KINDS = [
  'chart-vega',
  'data-table',
  'timeline',
  'kpi-grid',
  'prefill-form',
  'approval',
  'workflow',
  'map',
  'calendar',
  'file-preview',
] as const;

export type AgUiUiPartKind = (typeof AG_UI_UI_PART_KINDS)[number];
