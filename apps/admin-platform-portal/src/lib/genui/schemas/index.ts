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
