/**
 * Inline UI blocks — BossNyumba INLINE-FIRST flow (ported from Borjie).
 *
 * The owner-portal chat is inline-first by default: the brain renders
 * the EXACT slice the conversation needs INSIDE the chat bubble, not a
 * full tab. The "jump to full tab" is an escape hatch (Flow B) surfaced
 * via the `tab_promotion_chip` only when a richer view exists.
 *
 * 16 block types are validated by a discriminated union and parsed out
 * of brain replies via `parseInlineBlocks`. Real-estate retailored — the
 * field kinds, table column kinds, and example payloads target rent /
 * lease / tenant / maintenance workflows.
 *
 * Layer 1 (action-oriented):
 *   1. data_capture_card    — collect 1-3 fields from the owner inline
 *   2. confirmation_card    — high-stakes ask; supports auto-authorize
 *   3. file_request_card    — owner uploads a doc to proceed
 *   4. micro_action_card    — one-tap action (snooze, mark renewed, etc.)
 *   5. mini_metric          — single live KPI chip
 *   6. tab_promotion_chip   — the escape hatch to spawn the full tab
 *   7. draft_edit           — inline editing of a generated draft
 *
 * Layer 2 (rich):
 *   8. inline_table         — paginated data table
 *   9. inline_chart         — bar / line / sparkline / area / donut
 *  10. inline_wizard        — multi-step form with progress dots
 *  11. inline_workflow      — checklist / runbook with live status
 *  12. inline_comparison    — 2-3 side-by-side option cards
 *  13. inline_section       — collapsible grouping of sub-blocks
 *  14. inline_dashboard     — composed mini-dashboard
 *  15. draft_preview        — preview of a generated draft document
 *  16. citations_block      — evidence trail beneath a recommendation
 */

import { z } from 'zod';

import { ownerOsTabTypeSchema, ownerOsTabContextSchema } from './types.js';

// ─── Shared helpers ─────────────────────────────────────────────────

const bilingualLabelSchema = z.object({
  en: z.string().min(1).max(80),
  sw: z.string().min(1).max(80),
});

export type BilingualLabel = z.infer<typeof bilingualLabelSchema>;

const richBilingualLabelSchema = z.object({
  en: z.string().min(1).max(120),
  sw: z.string().min(1).max(120),
});

const toneSchema = z.enum(['positive', 'neutral', 'warning']);
const statusSchema = z.enum(['pending', 'in_progress', 'done', 'blocked']);

const tabPromotionRefSchema = z.object({
  tabType: ownerOsTabTypeSchema,
  contextTemplate: z.record(z.string(), z.unknown()).default({}),
  label: richBilingualLabelSchema,
});

// ─── 1. data_capture_card ───────────────────────────────────────────

export const DATA_CAPTURE_FIELD_KINDS = [
  'text',
  'number',
  'date',
  'select',
  'property-picker',
  'unit-picker',
  'tenant-picker',
  'amount-tzs',
] as const;

const dataCaptureFieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: bilingualLabelSchema,
  kind: z.enum(DATA_CAPTURE_FIELD_KINDS),
  options: z.array(z.string().min(1).max(60)).max(20).optional(),
  required: z.boolean().default(true),
  placeholder: z.string().min(1).max(120).optional(),
});

export const dataCaptureCardSchema = z.object({
  type: z.literal('data_capture_card'),
  purpose: z.string().min(1).max(120),
  fields: z.array(dataCaptureFieldSchema).min(1).max(3),
  submitAction: z.string().min(1).max(80),
});

export type DataCaptureCard = z.infer<typeof dataCaptureCardSchema>;

// ─── 2. confirmation_card ───────────────────────────────────────────

const confirmationActionSchema = z.object({
  label: z.string().min(1).max(40),
  kind: z.enum(['destructive', 'primary', 'ghost']),
});

export const confirmationCardSchema = z.object({
  type: z.literal('confirmation_card'),
  question: z.string().min(1).max(200),
  summary: z.string().min(1).max(400),
  primaryAction: confirmationActionSchema,
  secondaryAction: confirmationActionSchema,
  autoAuthorized: z.boolean().default(false),
  rationale: z.string().min(1).max(300),
  actionId: z.string().min(1).max(80).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type ConfirmationCard = z.infer<typeof confirmationCardSchema>;

// ─── 3. file_request_card ───────────────────────────────────────────

export const fileRequestCardSchema = z.object({
  type: z.literal('file_request_card'),
  whatFor: z.string().min(1).max(200),
  acceptedKinds: z.array(z.string().min(1).max(20)).min(1).max(10),
  maxSizeMb: z.number().int().min(1).max(50).default(10),
  jumpToTabType: ownerOsTabTypeSchema.optional(),
});

export type FileRequestCard = z.infer<typeof fileRequestCardSchema>;

// ─── 4. micro_action_card ───────────────────────────────────────────

export const microActionCardSchema = z.object({
  type: z.literal('micro_action_card'),
  label: bilingualLabelSchema,
  action: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type MicroActionCard = z.infer<typeof microActionCardSchema>;

// ─── 5. mini_metric ─────────────────────────────────────────────────

export const miniMetricSchema = z.object({
  type: z.literal('mini_metric'),
  name: z.string().min(1).max(60),
  value: z.string().min(1).max(60),
  delta: z.string().min(1).max(40).optional(),
  tone: toneSchema.default('neutral'),
  sparkline: z.array(z.number()).min(2).max(40).optional(),
});

export type MiniMetric = z.infer<typeof miniMetricSchema>;

// ─── 6. tab_promotion_chip ──────────────────────────────────────────

export const tabPromotionChipSchema = z.object({
  type: z.literal('tab_promotion_chip'),
  tabType: ownerOsTabTypeSchema,
  context: ownerOsTabContextSchema.default({}),
  label: bilingualLabelSchema,
});

export type TabPromotionChip = z.infer<typeof tabPromotionChipSchema>;

// ─── 7. draft_edit ──────────────────────────────────────────────────

export const DRAFT_EDIT_FIELD_KINDS = [
  'text',
  'multiline',
  'currency',
  'date',
  'select',
] as const;

const draftEditFieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: bilingualLabelSchema,
  kind: z.enum(DRAFT_EDIT_FIELD_KINDS),
  value: z.string().min(0).max(2000),
  options: z.array(z.string().min(1).max(60)).max(20).optional(),
});

export type DraftEditField = z.infer<typeof draftEditFieldSchema>;

export const draftEditBlockSchema = z.object({
  type: z.literal('draft_edit'),
  draftId: z.string().min(1).max(80),
  title: bilingualLabelSchema,
  fields: z.array(draftEditFieldSchema).min(1).max(10),
  submitAction: z.string().min(1).max(80),
});

export type DraftEditBlock = z.infer<typeof draftEditBlockSchema>;

// ─── 8. inline_table ────────────────────────────────────────────────

const TABLE_COLUMN_KINDS = [
  'text',
  'number',
  'date',
  'currency',
  'status_pill',
  'action',
] as const;

const inlineTableColumnSchema = z.object({
  key: z.string().min(1).max(40),
  label: richBilingualLabelSchema,
  kind: z.enum(TABLE_COLUMN_KINDS),
});

const inlineTableRowSchema = z
  .object({
    id: z.string().min(1).max(120),
  })
  .catchall(z.unknown());

const inlineRowActionSchema = z.object({
  kind: z.enum(['inline_drawer', 'micro_action_card', 'data_capture_card']),
  payloadTemplate: z.record(z.string(), z.unknown()).default({}),
});

export const inlineTableSchema = z.object({
  type: z.literal('inline_table'),
  title: richBilingualLabelSchema,
  columns: z.array(inlineTableColumnSchema).min(1).max(8),
  rows: z.array(inlineTableRowSchema).max(500),
  pageSize: z.number().int().min(1).max(50).default(8),
  emptyState: richBilingualLabelSchema.optional(),
  rowAction: inlineRowActionSchema.optional(),
  tabPromotion: tabPromotionRefSchema.optional(),
});

export type InlineTable = z.infer<typeof inlineTableSchema>;

// ─── 9. inline_chart ────────────────────────────────────────────────

const CHART_KINDS = ['bar', 'line', 'sparkline', 'area', 'donut'] as const;

const chartPointSchema = z.object({
  x: z.union([z.string().min(1).max(40), z.number()]),
  y: z.number(),
});

const chartSeriesSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().min(1).max(40),
  points: z.array(chartPointSchema).min(1).max(120),
});

export const inlineChartSchema = z.object({
  type: z.literal('inline_chart'),
  kind: z.enum(CHART_KINDS),
  title: richBilingualLabelSchema,
  series: z.array(chartSeriesSchema).min(1).max(5),
  height: z.number().int().min(80).max(480).default(220),
  tabPromotion: tabPromotionRefSchema.optional(),
});

export type InlineChart = z.infer<typeof inlineChartSchema>;

// ─── 10. inline_wizard ──────────────────────────────────────────────

const wizardStepSchema = z.object({
  id: z.string().min(1).max(40),
  title: richBilingualLabelSchema,
  intro: richBilingualLabelSchema.optional(),
  fields: z.array(dataCaptureFieldSchema).max(8),
});

export const inlineWizardSchema = z.object({
  type: z.literal('inline_wizard'),
  purpose: z.string().min(1).max(120),
  steps: z.array(wizardStepSchema).min(1).max(8),
  submitAction: z.string().min(1).max(80),
  tabPromotion: tabPromotionRefSchema.optional(),
});

export type InlineWizard = z.infer<typeof inlineWizardSchema>;

// ─── 11. inline_workflow ────────────────────────────────────────────

const workflowStepSchema = z.object({
  id: z.string().min(1).max(40),
  label: richBilingualLabelSchema,
  status: statusSchema,
  detail: richBilingualLabelSchema.optional(),
});

export const inlineWorkflowSchema = z.object({
  type: z.literal('inline_workflow'),
  title: richBilingualLabelSchema,
  steps: z.array(workflowStepSchema).min(1).max(20),
  tabPromotion: tabPromotionRefSchema.optional(),
});

export type InlineWorkflow = z.infer<typeof inlineWorkflowSchema>;

// ─── 12. inline_comparison ──────────────────────────────────────────

const comparisonOptionSchema = z.object({
  name: richBilingualLabelSchema,
  summary: richBilingualLabelSchema,
  pros: z.array(richBilingualLabelSchema).max(8).default([]),
  cons: z.array(richBilingualLabelSchema).max(8).default([]),
  cta: z
    .object({
      label: richBilingualLabelSchema,
      action: z.string().min(1).max(80),
    })
    .optional(),
});

export const inlineComparisonSchema = z.object({
  type: z.literal('inline_comparison'),
  title: richBilingualLabelSchema,
  options: z.array(comparisonOptionSchema).min(2).max(3),
});

export type InlineComparison = z.infer<typeof inlineComparisonSchema>;

// ─── 13. inline_section ─────────────────────────────────────────────
//
// Recursive grouping. The children are rendered as sub-blocks. Depth
// is capped at 3 by the renderer to keep cost bounded.

// NOTE: `inlineSectionSchema` is intentionally untyped (no explicit
// `z.ZodType<...>` annotation) so it remains a concrete `ZodObject` /
// `ZodLazy` that `z.discriminatedUnion('type', [...])` below can accept.
// The recursion through `inlineBlockSchema` is broken via `z.lazy(() => ...)`
// inside the `children` array — TypeScript handles the forward reference
// because `inlineBlockSchema` is declared later in this module with an
// explicit `z.ZodTypeAny` annotation that closes the cycle.
export const inlineSectionSchema = z.object({
  type: z.literal('inline_section'),
  title: bilingualLabelSchema,
  children: z.array(z.lazy(() => inlineBlockSchema)).max(10),
  collapsed: z.boolean().optional(),
});

export type InlineSection = z.infer<typeof inlineSectionSchema>;

// ─── 14. inline_dashboard ───────────────────────────────────────────

export const inlineDashboardSchema = z.object({
  type: z.literal('inline_dashboard'),
  title: richBilingualLabelSchema,
  metrics: z.array(miniMetricSchema).max(6).default([]),
  panels: z.array(z.lazy(() => inlineBlockSchema)).max(6),
});

export type InlineDashboard = z.infer<typeof inlineDashboardSchema>;

// ─── 15. draft_preview ──────────────────────────────────────────────

export const draftPreviewBlockSchema = z.object({
  type: z.literal('draft_preview'),
  draftId: z.string().min(1).max(80),
  title: bilingualLabelSchema,
  body: z.string().min(1).max(8000),
  language: z.enum(['sw', 'en']),
  acceptAction: z.string().min(1).max(80),
  editAction: z.string().min(1).max(80),
});

export type DraftPreviewBlock = z.infer<typeof draftPreviewBlockSchema>;

// ─── 16. citations_block ────────────────────────────────────────────

const citationRefSchema = z.object({
  id: z.string().min(1).max(120),
  label: richBilingualLabelSchema,
  href: z.string().min(1).max(2000).optional(),
});

export type CitationRef = z.infer<typeof citationRefSchema>;

export const citationsBlockSchema = z.object({
  type: z.literal('citations_block'),
  citations: z.array(citationRefSchema).min(1).max(8),
});

export type CitationsBlock = z.infer<typeof citationsBlockSchema>;

export const CITATIONS_BLOCK_TYPE = 'citations_block' as const;

// ─── Discriminated union of every inline block ──────────────────────

export const inlineBlockSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion('type', [
    dataCaptureCardSchema,
    confirmationCardSchema,
    fileRequestCardSchema,
    microActionCardSchema,
    miniMetricSchema,
    tabPromotionChipSchema,
    draftEditBlockSchema,
    inlineTableSchema,
    inlineChartSchema,
    inlineWizardSchema,
    inlineWorkflowSchema,
    inlineComparisonSchema,
    inlineSectionSchema,
    inlineDashboardSchema,
    draftPreviewBlockSchema,
    citationsBlockSchema,
  ]),
);

export type InlineBlock =
  | DataCaptureCard
  | ConfirmationCard
  | FileRequestCard
  | MicroActionCard
  | MiniMetric
  | TabPromotionChip
  | DraftEditBlock
  | InlineTable
  | InlineChart
  | InlineWizard
  | InlineWorkflow
  | InlineComparison
  | InlineSection
  | InlineDashboard
  | DraftPreviewBlock
  | CitationsBlock;

export const INLINE_BLOCK_TYPES: ReadonlyArray<InlineBlock['type']> = [
  'data_capture_card',
  'confirmation_card',
  'file_request_card',
  'micro_action_card',
  'mini_metric',
  'tab_promotion_chip',
  'draft_edit',
  'inline_table',
  'inline_chart',
  'inline_wizard',
  'inline_workflow',
  'inline_comparison',
  'inline_section',
  'inline_dashboard',
  'draft_preview',
  'citations_block',
];

// ─── Parser ─────────────────────────────────────────────────────────

const INLINE_BLOCK_TAG = /<ui_block>\s*(\{[\s\S]*?\})\s*<\/ui_block>/gi;
const MAX_INLINE_BLOCKS = 8;

export interface ParseInlineBlocksResult {
  readonly body: string;
  readonly blocks: ReadonlyArray<InlineBlock>;
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isInlineBlockType(value: unknown): value is InlineBlock['type'] {
  return (
    typeof value === 'string' &&
    INLINE_BLOCK_TYPES.includes(value as InlineBlock['type'])
  );
}

/**
 * Parse every `<ui_block>` tag in the text. Returns the cleaned body
 * (tags stripped) plus an array of validated inline blocks in
 * document order. Blocks whose `type` does NOT match an inline schema
 * are LEFT IN PLACE.
 *
 * Cap: 8 inline blocks per response.
 */
export function parseInlineBlocks(text: string): ParseInlineBlocksResult {
  const blocks: InlineBlock[] = [];
  const stripMatches: string[] = [];

  INLINE_BLOCK_TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_BLOCK_TAG.exec(text)) !== null) {
    if (blocks.length >= MAX_INLINE_BLOCKS) break;
    const raw = match[0];
    const json = match[1] ?? '';
    const parsed = safeParseJson(json);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      !isInlineBlockType((parsed as { type?: unknown }).type)
    ) {
      continue;
    }
    const validation = inlineBlockSchema.safeParse(parsed);
    if (!validation.success) continue;
    blocks.push(validation.data as InlineBlock);
    stripMatches.push(raw);
  }

  let body = text;
  for (const raw of stripMatches) {
    body = body.replace(raw, '');
  }

  return { body, blocks };
}

// ─── auto_authorized companion tag ──────────────────────────────────

const autoAuthorizedSchema = z.object({
  action: z.string().min(1).max(80),
  rationale: z.string().min(1).max(300),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type AutoAuthorized = z.infer<typeof autoAuthorizedSchema>;

const AUTO_AUTHORIZED_TAG =
  /<auto_authorized>\s*(\{[\s\S]*?\})\s*<\/auto_authorized>/i;

export interface ExtractAutoAuthorizedResult {
  readonly body: string;
  readonly autoAuthorized: AutoAuthorized | null;
}

/**
 * Strip the single `<auto_authorized>` tag from the body.
 */
export function extractAutoAuthorized(
  text: string,
): ExtractAutoAuthorizedResult {
  let autoAuthorized: AutoAuthorized | null = null;
  const body = text.replace(AUTO_AUTHORIZED_TAG, (_m, json: string) => {
    if (autoAuthorized) return '';
    const parsed = safeParseJson(json);
    if (!parsed) return '';
    const validation = autoAuthorizedSchema.safeParse(parsed);
    if (validation.success) autoAuthorized = validation.data;
    return '';
  });
  return { body, autoAuthorized };
}
