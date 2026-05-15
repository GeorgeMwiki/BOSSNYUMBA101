/**
 * Zod schemas for every AG-UI UiPart payload.
 *
 * Each primitive has a server-owned schema. The LLM emits VALUES that
 * are `safeParse`d before the render-block tool returns. On failure,
 * the tool returns a `ToolOutcome.error` so the agent loop can repair
 * (e.g. retry with smaller model / repair-pass).
 *
 * Anti-patterns enforced:
 *   - LLM never modifies the schemas (schemas are imported, not emitted)
 *   - LLM never emits Tailwind classnames (no className fields here)
 *   - LLM never emits JSX (only structured data)
 *
 * Note on Vega-Lite specs: the Zod schema here is intentionally loose
 * (`z.record(z.unknown())`) because the full Vega-Lite v5 grammar is
 * huge. Tight validation happens via ajv against the OFFICIAL Vega-Lite
 * v5 JSON schema, in `./validate.ts`.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────
// Shared sub-schemas
// ─────────────────────────────────────────────────────────────────────

const CurrencySchema = z.enum(['KES', 'TZS', 'USD']);

const Iso8601Schema = z
  .string()
  .min(1, 'timestamp required')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be ISO-8601 parseable');

const LatLngSchema = z
  .tuple([
    z.number().gte(-90).lte(90),
    z.number().gte(-180).lte(180),
  ])
  .readonly();

// ─────────────────────────────────────────────────────────────────────
// 1. chart-vega
// ─────────────────────────────────────────────────────────────────────

export const ChartVegaPartSchema = z
  .object({
    kind: z.literal('chart-vega'),
    title: z.string().max(200).optional(),
    spec: z.record(z.unknown()),
    data: z.array(z.record(z.unknown())).max(100_000),
  })
  .strict();
export type ChartVegaPart = z.infer<typeof ChartVegaPartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 2. data-table
// ─────────────────────────────────────────────────────────────────────

export const DataTableColumnSchema = z
  .object({
    id: z.string().min(1).max(120),
    header: z.string().min(1).max(200),
    accessorKey: z.string().min(1).max(200),
    format: z
      .enum(['text', 'currency', 'percent', 'number', 'date'])
      .optional(),
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
export type DataTablePart = z.infer<typeof DataTablePartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 3. timeline
// ─────────────────────────────────────────────────────────────────────

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
export type TimelinePart = z.infer<typeof TimelinePartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 4. kpi-grid
// ─────────────────────────────────────────────────────────────────────

const KpiTileObjectSchema = z
  .object({
    label: z.string().min(1).max(120),
    value: z.union([z.number(), z.string().max(80)]),
    delta: z.number().optional(),
    deltaDirection: z.enum(['up', 'down', 'flat']).optional(),
    format: z.enum(['currency', 'percent', 'number']),
    currency: CurrencySchema.optional(),
  })
  .strict();

export const KpiTileSchema = KpiTileObjectSchema.refine(
  (t) => (t.format === 'currency' ? Boolean(t.currency) : true),
  { message: 'currency required when format=currency' },
);

export const KpiGridPartSchema = z
  .object({
    kind: z.literal('kpi-grid'),
    title: z.string().max(200).optional(),
    tiles: z.array(KpiTileSchema).min(1).max(24),
  })
  .strict();

/** Plain (un-refined) object variant, for use inside discriminated unions
 *  which cannot accept `ZodEffects`. The refinement above still runs on
 *  the single-tile schema path. */
const KpiGridPartObjectSchema = z
  .object({
    kind: z.literal('kpi-grid'),
    title: z.string().max(200).optional(),
    tiles: z.array(KpiTileObjectSchema).min(1).max(24),
  })
  .strict();
export type KpiGridPart = z.infer<typeof KpiGridPartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 5. prefill-form
// ─────────────────────────────────────────────────────────────────────

export const PrefillFormPartSchema = z
  .object({
    kind: z.literal('prefill-form'),
    title: z.string().max(200).optional(),
    formId: z.string().min(1).max(120),
    /** JSON Schema (Draft-7). LLM cannot modify — the tool input
     *  schemaJson is supplied by the server, not the model. */
    schemaJson: z.record(z.unknown()),
    values: z.record(z.unknown()),
    /** api-gateway URL (NOT agent). Must be relative or same-origin. */
    action: z.string().min(1).max(500),
    diffMode: z.boolean().optional(),
  })
  .strict();
export type PrefillFormPart = z.infer<typeof PrefillFormPartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 6. approval
// ─────────────────────────────────────────────────────────────────────

export const ApprovalPartSchema = z
  .object({
    kind: z.literal('approval'),
    title: z.string().max(200).optional(),
    action: z.string().min(1).max(200),
    payload: z.record(z.unknown()),
    diff: z.record(z.unknown()),
    /** Exactly 5 items per R1's challenge-and-response pattern. */
    checklist: z
      .tuple([
        z.string().min(1).max(280),
        z.string().min(1).max(280),
        z.string().min(1).max(280),
        z.string().min(1).max(280),
        z.string().min(1).max(280),
      ])
      .readonly(),
  })
  .strict();
export type ApprovalPart = z.infer<typeof ApprovalPartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 7. workflow
// ─────────────────────────────────────────────────────────────────────

export const WorkflowStepSchema = z
  .object({
    label: z.string().min(1).max(120),
    status: z.enum(['pending', 'running', 'done', 'failed']),
    startedAt: Iso8601Schema.optional(),
    completedAt: Iso8601Schema.optional(),
  })
  .strict();

const WorkflowPartObjectSchema = z
  .object({
    kind: z.literal('workflow'),
    title: z.string().max(200).optional(),
    steps: z.array(WorkflowStepSchema).min(1).max(40),
    currentIndex: z.number().int().min(0),
  })
  .strict();

export const WorkflowPartSchema = WorkflowPartObjectSchema.refine(
  (p) => p.currentIndex < p.steps.length,
  { message: 'currentIndex out of range' },
);
export type WorkflowPart = z.infer<typeof WorkflowPartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 8. map
// ─────────────────────────────────────────────────────────────────────

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
export type MapPart = z.infer<typeof MapPartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 9. calendar
// ─────────────────────────────────────────────────────────────────────

export const CalendarEventSchema = z
  .object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(200),
    start: Iso8601Schema,
    end: Iso8601Schema.optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{3,8}$/, 'must be hex colour, e.g. #1f6feb')
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
export type CalendarPart = z.infer<typeof CalendarPartSchema>;

// ─────────────────────────────────────────────────────────────────────
// 10. file-preview
// ─────────────────────────────────────────────────────────────────────

export const FilePreviewPartSchema = z
  .object({
    kind: z.literal('file-preview'),
    title: z.string().max(200).optional(),
    url: z
      .string()
      .min(1)
      .max(2000)
      .refine(
        (u) => /^https?:\/\//.test(u) || u.startsWith('/'),
        'url must be http(s) or path-relative',
      ),
    mimeType: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
    sizeBytes: z.number().int().nonnegative().optional(),
  })
  .strict();
export type FilePreviewPart = z.infer<typeof FilePreviewPartSchema>;

// ─────────────────────────────────────────────────────────────────────
// Discriminated union of every part
// ─────────────────────────────────────────────────────────────────────

// NOTE: `z.discriminatedUnion` cannot accept `ZodEffects` (refined
// schemas). For the union we use the un-refined object variants of
// kpi-grid and workflow. Refinements still execute on the
// single-primitive Zod schemas used by the render-block tools.
export const AgUiUiPartSchema = z.discriminatedUnion('kind', [
  ChartVegaPartSchema,
  DataTablePartSchema,
  TimelinePartSchema,
  KpiGridPartObjectSchema,
  PrefillFormPartSchema,
  ApprovalPartSchema,
  WorkflowPartObjectSchema,
  MapPartSchema,
  CalendarPartSchema,
  FilePreviewPartSchema,
]);

export type AnyAgUiUiPart = z.infer<typeof AgUiUiPartSchema>;

/** Map from `kind` → Zod schema. Used by the render-block tool factory. */
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
} as const;

export type PartKind = keyof typeof PART_SCHEMAS;
