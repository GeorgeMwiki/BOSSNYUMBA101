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
  /**
   * Optional currency code when format === 'currency'.
   * MUST be an ISO-4217 3-letter code (e.g. KES, TZS, USD, EUR, ZAR, NGN).
   * Validated at runtime via the Zod schema (`CurrencySchema` in
   * `./schemas.ts`).
   */
  readonly currency?: string;
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
  /**
   * Optional currency code when format === 'currency'.
   * MUST be an ISO-4217 3-letter code (e.g. KES, TZS, USD, EUR, ZAR, NGN).
   * Validated at runtime via the Zod schema (`CurrencySchema` in
   * `./schemas.ts`).
   */
  readonly currency?: string;
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

// ─────────────────────────────────────────────────────────────────────
// Tier-1 & Tier-2 — ProdFix-7 expansion (12 new kinds)
// ─────────────────────────────────────────────────────────────────────

/** A single kanban card. */
export interface KanbanCard {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly badges?: ReadonlyArray<string>;
  readonly meta?: Readonly<Record<string, string | number>>;
  readonly dueAt?: string; // ISO-8601
}

/** A kanban swimlane column. */
export interface KanbanColumn {
  readonly id: string;
  readonly title: string;
  readonly cards: ReadonlyArray<KanbanCard>;
}

/** Citation marker referenced from markdown-card body via [cite:<id>]. */
export interface MarkdownCitation {
  readonly id: string;
  readonly label: string;
  readonly sourceUri?: string;
  readonly sourceRowRef?: string;
}

/** Prompt-suggestion quick reply. */
export interface PromptSuggestion {
  readonly label: string;
  readonly prompt: string;
  readonly kind: 'primary' | 'secondary' | 'destructive';
  readonly icon?: string;
}

/** Action descriptor for tree node clicks. */
export interface TreeAction {
  readonly kind: 'message' | 'tool' | 'navigate';
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Recursive tree node. */
export interface TreeNode {
  readonly id: string;
  readonly label: string;
  readonly badge?: string;
  readonly children?: ReadonlyArray<TreeNode>;
  readonly onClickAction?: TreeAction;
}

/** Image-annotation overlay marker. */
export interface ImageAnnotation {
  readonly x: number; // 0..1 normalised
  readonly y: number; // 0..1 normalised
  readonly label: string;
  readonly severity: 'info' | 'warning' | 'critical';
}

/** Gauge threshold band. */
export interface GaugeThreshold {
  readonly value: number;
  readonly color: string; // hex
}

/** Signature-pad submit action. */
export interface SignatureAction {
  readonly kind: 'tool' | 'navigate';
  readonly payload: Readonly<Record<string, unknown>>;
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
    }
  // ── ProdFix-7 Tier-1 ──────────────────────────────────────────────
  | {
      readonly kind: 'kanban';
      readonly title?: string;
      readonly columns: ReadonlyArray<KanbanColumn>;
    }
  | {
      readonly kind: 'dashboard-grid';
      readonly title?: string;
      /** 12-col responsive grid. Each cell can contain another AGUiPart. */
      readonly cells: ReadonlyArray<{
        readonly span: number; // 1..12
        readonly part: AgUiUiPart;
      }>;
    }
  | {
      readonly kind: 'heatmap';
      readonly title?: string;
      readonly xAxis: ReadonlyArray<string>;
      readonly yAxis: ReadonlyArray<string>;
      readonly cells: ReadonlyArray<ReadonlyArray<number>>;
      readonly colorScale: 'linear' | 'log' | 'diverging';
      readonly minValue?: number;
      readonly maxValue?: number;
      readonly format: 'currency' | 'percent' | 'count';
      readonly currency?: string; // ISO-4217
      readonly unit?: string;
    }
  | {
      readonly kind: 'markdown-card';
      readonly title?: string;
      readonly markdown: string;
      readonly citations?: ReadonlyArray<MarkdownCitation>;
      readonly severity?: 'info' | 'warning' | 'success' | 'danger';
    }
  | {
      readonly kind: 'prompt-suggestions';
      readonly title?: string;
      readonly suggestions: ReadonlyArray<PromptSuggestion>;
    }
  | {
      readonly kind: 'evidence-card';
      readonly title?: string;
      readonly quote: string;
      readonly sourceTitle: string;
      readonly sourceUri?: string;
      readonly sourcePageOrLocator?: string;
      readonly confidence?: 'high' | 'medium' | 'low';
      readonly extractedAt?: string; // ISO-8601
    }
  // ── ProdFix-7 Tier-2 ──────────────────────────────────────────────
  | {
      readonly kind: 'tree';
      readonly title?: string;
      readonly root: TreeNode;
    }
  | {
      readonly kind: 'diff-view';
      readonly title?: string;
      readonly left: string;
      readonly right: string;
      readonly leftLabel: string;
      readonly rightLabel: string;
      readonly mode: 'unified' | 'split';
      readonly language?: 'text' | 'json' | 'sql';
    }
  | {
      readonly kind: 'gauge';
      readonly title?: string;
      readonly value: number;
      readonly min: number;
      readonly max: number;
      readonly label: string;
      readonly format?: 'percent' | 'number' | 'currency';
      readonly currency?: string; // ISO-4217 when format = 'currency'
      readonly thresholds?: ReadonlyArray<GaugeThreshold>;
    }
  | {
      readonly kind: 'metric-sparkline';
      readonly title?: string;
      readonly label: string;
      readonly value: number;
      readonly format: 'currency' | 'percent' | 'number';
      readonly currency?: string;
      readonly sparkline: ReadonlyArray<number>;
      readonly delta?: number;
      readonly deltaIsPositive?: boolean;
    }
  | {
      readonly kind: 'image-annotation';
      readonly title?: string;
      readonly imageUrl: string;
      readonly annotations: ReadonlyArray<ImageAnnotation>;
    }
  | {
      readonly kind: 'signature-pad';
      readonly title?: string;
      readonly prompt: string;
      readonly requiredFor: string;
      readonly onSubmitAction: SignatureAction;
    };

// TODO: ProdFix-8 — additional deferred kinds: pdf-viewer (full), slider-input,
// multistep-wizard, media-grid, chat-embed, live-counter, org-chart,
// comparison-table, geo-fence, notification-toast, decision-trace,
// code-block, dataflow-diagram.

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
  // ProdFix-7 Tier-1
  'kanban',
  'dashboard-grid',
  'heatmap',
  'markdown-card',
  'prompt-suggestions',
  'evidence-card',
  // ProdFix-7 Tier-2
  'tree',
  'diff-view',
  'gauge',
  'metric-sparkline',
  'image-annotation',
  'signature-pad',
] as const;

export type AgUiUiPartKind = (typeof AG_UI_UI_PART_KINDS)[number];
