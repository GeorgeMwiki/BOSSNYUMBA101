/**
 * Client-side Zod schemas for every AG-UI UiPart payload.
 *
 * Mirrors the server-side schemas in
 * `packages/central-intelligence/src/kernel/tools/render-blocks/schemas.ts`
 * so the client can re-validate every payload at the render boundary.
 *
 * Belt-and-suspenders. The server already validates before emit, but
 * defense in depth: a compromised or out-of-date server build should
 * never crash the admin console.
 */

import { z } from 'zod';

const CurrencySchema = z.enum(['KES', 'TZS', 'USD']);

const Iso8601Schema = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be ISO-8601 parseable');

const LatLngSchema = z.tuple([
  z.number().gte(-90).lte(90),
  z.number().gte(-180).lte(180),
]);

// chart-vega
export const ChartVegaPartSchema = z
  .object({
    kind: z.literal('chart-vega'),
    title: z.string().max(200).optional(),
    spec: z.record(z.unknown()),
    data: z.array(z.record(z.unknown())).max(100_000),
  })
  .strict();

// data-table
export const DataTableColumnSchema = z
  .object({
    id: z.string().min(1).max(120),
    header: z.string().min(1).max(200),
    accessorKey: z.string().min(1).max(200),
    format: z.enum(['text', 'currency', 'percent', 'number', 'date']).optional(),
    currency: CurrencySchema.optional(),
    enableSorting: z.boolean().optional(),
  })
  .strict();

export const DataTablePartSchema = z
  .object({
    kind: z.literal('data-table'),
    title: z.string().max(200).optional(),
    columns: z.array(DataTableColumnSchema).min(1).max(50),
    rows: z.array(z.record(z.unknown())).max(50_000),
    pageSize: z.number().int().min(1).max(500).optional(),
  })
  .strict();

// timeline
export const TimelineEventSchema = z
  .object({
    timestamp: Iso8601Schema,
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    severity: z.enum(['info', 'warn', 'error', 'success']).optional(),
    icon: z.string().max(60).optional(),
  })
  .strict();

export const TimelinePartSchema = z
  .object({
    kind: z.literal('timeline'),
    title: z.string().max(200).optional(),
    events: z.array(TimelineEventSchema).min(1).max(500),
  })
  .strict();

// kpi-grid
export const KpiTileSchema = z
  .object({
    label: z.string().min(1).max(120),
    value: z.union([z.number(), z.string().max(80)]),
    delta: z.number().optional(),
    deltaDirection: z.enum(['up', 'down', 'flat']).optional(),
    format: z.enum(['currency', 'percent', 'number']),
    currency: CurrencySchema.optional(),
  })
  .strict();

export const KpiGridPartSchema = z
  .object({
    kind: z.literal('kpi-grid'),
    title: z.string().max(200).optional(),
    tiles: z.array(KpiTileSchema).min(1).max(24),
  })
  .strict();

// prefill-form
export const PrefillFormPartSchema = z
  .object({
    kind: z.literal('prefill-form'),
    title: z.string().max(200).optional(),
    formId: z.string().min(1).max(120),
    schemaJson: z.record(z.unknown()),
    values: z.record(z.unknown()),
    action: z.string().min(1).max(500),
    diffMode: z.boolean().optional(),
  })
  .strict();

// approval
export const ApprovalPartSchema = z
  .object({
    kind: z.literal('approval'),
    title: z.string().max(200).optional(),
    action: z.string().min(1).max(200),
    payload: z.record(z.unknown()),
    diff: z.record(z.unknown()),
    checklist: z.tuple([
      z.string().min(1).max(280),
      z.string().min(1).max(280),
      z.string().min(1).max(280),
      z.string().min(1).max(280),
      z.string().min(1).max(280),
    ]),
  })
  .strict();

// workflow
export const WorkflowStepSchema = z
  .object({
    label: z.string().min(1).max(120),
    status: z.enum(['pending', 'running', 'done', 'failed']),
    startedAt: Iso8601Schema.optional(),
    completedAt: Iso8601Schema.optional(),
  })
  .strict();

export const WorkflowPartSchema = z
  .object({
    kind: z.literal('workflow'),
    title: z.string().max(200).optional(),
    steps: z.array(WorkflowStepSchema).min(1).max(40),
    currentIndex: z.number().int().min(0),
  })
  .strict();

// map
export const MapMarkerSchema = z
  .object({
    position: LatLngSchema,
    popup: z.string().max(500).optional(),
  })
  .strict();

export const MapPartSchema = z
  .object({
    kind: z.literal('map'),
    title: z.string().max(200).optional(),
    center: LatLngSchema,
    zoom: z.number().int().min(0).max(20),
    markers: z.array(MapMarkerSchema).max(2000),
  })
  .strict();

// calendar
export const CalendarEventSchema = z
  .object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    start: Iso8601Schema,
    end: Iso8601Schema.optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{3,8}$/)
      .optional(),
  })
  .strict();

export const CalendarPartSchema = z
  .object({
    kind: z.literal('calendar'),
    title: z.string().max(200).optional(),
    events: z.array(CalendarEventSchema).max(5000),
    view: z.enum(['dayGrid', 'timeGrid', 'list']).optional(),
  })
  .strict();

// file-preview
export const FilePreviewPartSchema = z
  .object({
    kind: z.literal('file-preview'),
    title: z.string().max(200).optional(),
    url: z
      .string()
      .min(1)
      .max(2000)
      .refine((u) => /^https?:\/\//.test(u) || u.startsWith('/')),
    mimeType: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
    sizeBytes: z.number().int().nonnegative().optional(),
  })
  .strict();

// ═════════════════════════════════════════════════════════════════════
// ProdFix-7 — 12 new UiPart kinds
// ═════════════════════════════════════════════════════════════════════

// ISO-4217 regex (ProdFix-2 widening). Reserved for ProdFix-7 kinds that
// don't need to be backwards-compatible with the older Currency enum.
const Iso4217Schema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'ISO-4217 currency code (3 upper-case letters)');

const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{3,8}$/, 'must be hex colour, e.g. #1f6feb');

// ── 11. kanban ────────────────────────────────────────────────────────

export const KanbanCardSchema = z
  .object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    subtitle: z.string().max(200).optional(),
    badges: z.array(z.string().min(1).max(60)).max(8).optional(),
    meta: z.record(z.union([z.string().max(200), z.number()])).optional(),
    dueAt: Iso8601Schema.optional(),
  })
  .strict();

export const KanbanColumnSchema = z
  .object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    cards: z.array(KanbanCardSchema).max(500),
  })
  .strict();

export const KanbanPartSchema = z
  .object({
    kind: z.literal('kanban'),
    title: z.string().max(200).optional(),
    columns: z.array(KanbanColumnSchema).min(1).max(8),
  })
  .strict();

// ── 12. dashboard-grid ────────────────────────────────────────────────

export const DashboardGridCellSchema = z
  .object({
    span: z.number().int().min(1).max(12),
    part: z.object({ kind: z.string().min(1).max(60) }).passthrough(),
  })
  .strict();

export const DashboardGridPartSchema = z
  .object({
    kind: z.literal('dashboard-grid'),
    title: z.string().max(200).optional(),
    cells: z.array(DashboardGridCellSchema).min(1).max(32),
  })
  .strict();

// ── 13. heatmap ───────────────────────────────────────────────────────

export const HeatmapPartSchema = z
  .object({
    kind: z.literal('heatmap'),
    title: z.string().max(200).optional(),
    xAxis: z.array(z.string().min(1).max(120)).min(1).max(200),
    yAxis: z.array(z.string().min(1).max(120)).min(1).max(200),
    cells: z.array(z.array(z.number())).min(1).max(200),
    colorScale: z.enum(['linear', 'log', 'diverging']),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    format: z.enum(['currency', 'percent', 'count']),
    currency: Iso4217Schema.optional(),
    unit: z.string().max(40).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.format === 'currency' && !p.currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currency required when format=currency',
        path: ['currency'],
      });
    }
    if (p.cells.length !== p.yAxis.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cells.length must equal yAxis.length',
        path: ['cells'],
      });
    }
    for (const [i, row] of p.cells.entries()) {
      if (row.length !== p.xAxis.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `cells[${i}].length must equal xAxis.length`,
          path: ['cells', i],
        });
      }
    }
  });

// ── 14. markdown-card ─────────────────────────────────────────────────

export const MarkdownCitationSchema = z
  .object({
    id: z.string().min(1).max(60),
    label: z.string().min(1).max(200),
    sourceUri: z.string().max(2000).optional(),
    sourceRowRef: z.string().max(200).optional(),
  })
  .strict();

export const MarkdownCardPartSchema = z
  .object({
    kind: z.literal('markdown-card'),
    title: z.string().max(200).optional(),
    markdown: z.string().min(1).max(20_000),
    citations: z.array(MarkdownCitationSchema).max(50).optional(),
    severity: z.enum(['info', 'warning', 'success', 'danger']).optional(),
  })
  .strict();

// ── 15. prompt-suggestions ────────────────────────────────────────────

export const PromptSuggestionSchema = z
  .object({
    label: z.string().min(1).max(120),
    prompt: z.string().min(1).max(2000),
    kind: z.enum(['primary', 'secondary', 'destructive']),
    icon: z.string().max(60).optional(),
  })
  .strict();

export const PromptSuggestionsPartSchema = z
  .object({
    kind: z.literal('prompt-suggestions'),
    title: z.string().max(200).optional(),
    suggestions: z.array(PromptSuggestionSchema).min(1).max(12),
  })
  .strict();

// ── 16. evidence-card ─────────────────────────────────────────────────

export const EvidenceCardPartSchema = z
  .object({
    kind: z.literal('evidence-card'),
    title: z.string().max(200).optional(),
    quote: z.string().min(1).max(4000),
    sourceTitle: z.string().min(1).max(200),
    sourceUri: z.string().max(2000).optional(),
    sourcePageOrLocator: z.string().max(120).optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    extractedAt: Iso8601Schema.optional(),
  })
  .strict();

// ── 17. tree ──────────────────────────────────────────────────────────

const TreeActionSchema = z
  .object({
    kind: z.enum(['message', 'tool', 'navigate']),
    payload: z.record(z.unknown()),
  })
  .strict();

export type TreeNodeShape = {
  id: string;
  label: string;
  badge?: string;
  children?: TreeNodeShape[];
  onClickAction?: z.infer<typeof TreeActionSchema>;
};

export const TreeNodeSchema: z.ZodType<TreeNodeShape> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1).max(120),
      label: z.string().min(1).max(200),
      badge: z.string().max(60).optional(),
      children: z.array(TreeNodeSchema).max(500).optional(),
      onClickAction: TreeActionSchema.optional(),
    })
    .strict(),
);

export const TreePartSchema = z
  .object({
    kind: z.literal('tree'),
    title: z.string().max(200).optional(),
    root: TreeNodeSchema,
  })
  .strict();

// ── 18. diff-view ─────────────────────────────────────────────────────

export const DiffViewPartSchema = z
  .object({
    kind: z.literal('diff-view'),
    title: z.string().max(200).optional(),
    left: z.string().max(50_000),
    right: z.string().max(50_000),
    leftLabel: z.string().min(1).max(120),
    rightLabel: z.string().min(1).max(120),
    mode: z.enum(['unified', 'split']),
    language: z.enum(['text', 'json', 'sql']).optional(),
  })
  .strict();

// ── 19. gauge ─────────────────────────────────────────────────────────

const GaugeThresholdSchema = z
  .object({
    value: z.number(),
    color: HexColorSchema,
  })
  .strict();

export const GaugePartSchema = z
  .object({
    kind: z.literal('gauge'),
    title: z.string().max(200).optional(),
    value: z.number(),
    min: z.number(),
    max: z.number(),
    label: z.string().min(1).max(120),
    format: z.enum(['percent', 'number', 'currency']).optional(),
    currency: Iso4217Schema.optional(),
    thresholds: z.array(GaugeThresholdSchema).max(8).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.min >= p.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'min must be less than max',
        path: ['min'],
      });
    }
    if (p.format === 'currency' && !p.currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currency required when format=currency',
        path: ['currency'],
      });
    }
  });

// ── 20. metric-sparkline ──────────────────────────────────────────────

export const MetricSparklinePartSchema = z
  .object({
    kind: z.literal('metric-sparkline'),
    title: z.string().max(200).optional(),
    label: z.string().min(1).max(120),
    value: z.number(),
    format: z.enum(['currency', 'percent', 'number']),
    currency: Iso4217Schema.optional(),
    sparkline: z.array(z.number()).min(2).max(500),
    delta: z.number().optional(),
    deltaIsPositive: z.boolean().optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.format === 'currency' && !p.currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currency required when format=currency',
        path: ['currency'],
      });
    }
  });

// ── 21. image-annotation ──────────────────────────────────────────────

export const ImageAnnotationSchema = z
  .object({
    x: z.number().gte(0).lte(1),
    y: z.number().gte(0).lte(1),
    label: z.string().min(1).max(200),
    severity: z.enum(['info', 'warning', 'critical']),
  })
  .strict();

export const ImageAnnotationPartSchema = z
  .object({
    kind: z.literal('image-annotation'),
    title: z.string().max(200).optional(),
    imageUrl: z
      .string()
      .min(1)
      .max(2000)
      .refine(
        (u) => /^https?:\/\//.test(u) || u.startsWith('/') || u.startsWith('data:image/'),
        'imageUrl must be http(s), path-relative, or data:image/',
      ),
    annotations: z.array(ImageAnnotationSchema).max(200),
  })
  .strict();

// ── 22. signature-pad ─────────────────────────────────────────────────

const SignatureActionSchema = z
  .object({
    kind: z.enum(['tool', 'navigate']),
    payload: z.record(z.unknown()),
  })
  .strict();

export const SignaturePadPartSchema = z
  .object({
    kind: z.literal('signature-pad'),
    title: z.string().max(200).optional(),
    prompt: z.string().min(1).max(1000),
    requiredFor: z.string().min(1).max(200),
    onSubmitAction: SignatureActionSchema,
  })
  .strict();

export const PART_SCHEMAS = {
  'chart-vega': ChartVegaPartSchema,
  'data-table': DataTablePartSchema,
  timeline: TimelinePartSchema,
  'kpi-grid': KpiGridPartSchema,
  'prefill-form': PrefillFormPartSchema,
  approval: ApprovalPartSchema,
  workflow: WorkflowPartSchema,
  map: MapPartSchema,
  calendar: CalendarPartSchema,
  'file-preview': FilePreviewPartSchema,
  // ProdFix-7 Tier-1
  kanban: KanbanPartSchema,
  'dashboard-grid': DashboardGridPartSchema,
  heatmap: HeatmapPartSchema,
  'markdown-card': MarkdownCardPartSchema,
  'prompt-suggestions': PromptSuggestionsPartSchema,
  'evidence-card': EvidenceCardPartSchema,
  // ProdFix-7 Tier-2
  tree: TreePartSchema,
  'diff-view': DiffViewPartSchema,
  gauge: GaugePartSchema,
  'metric-sparkline': MetricSparklinePartSchema,
  'image-annotation': ImageAnnotationPartSchema,
  'signature-pad': SignaturePadPartSchema,
} as const;

export type PartKind = keyof typeof PART_SCHEMAS;
