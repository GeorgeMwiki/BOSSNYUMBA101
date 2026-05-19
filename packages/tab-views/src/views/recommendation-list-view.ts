/**
 * RecommendationListView — proactive intelligence recommendations
 * sorted by `confidence × impact`.
 *
 * The owner asks "what should I work on next?" — the MD picks this
 * view, fetches the open recommendations from the J5 proactive
 * intelligence loop, ranks them, and emits a `data-table` block
 * with per-row inline approve / dismiss / snooze actions surfaced
 * via a follow-up `prompt-suggestions` block.
 *
 * Each row is a `recommendation` entity from J1. When the owner
 * taps a row in the chat, the renderer emits an `expand-row`
 * interactivity event which the MD uses to summon the full
 * recommendation card inline (the rationale, evidence,
 * sub-actions).
 *
 * Sort: `confidence × impact` descending. A 0.95-confidence
 * 8-impact recommendation outranks a 0.4-confidence 9-impact one.
 */

import type { AgUiUiPart } from '../types/ag-ui.js';
import type {
  TabView,
  RenderContext,
  QueryValidation,
} from '../types/tab-view.js';

export type RecommendationStatus =
  | 'pending'
  | 'approved'
  | 'dismissed'
  | 'snoozed'
  | 'expired';

export interface RecommendationQuery {
  readonly limit?: number;
  readonly statuses?: readonly RecommendationStatus[];
  readonly minConfidence?: number;
  readonly minImpact?: number;
}

export interface RecommendationRow {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly confidence: number;
  readonly impact: number;
  readonly status: RecommendationStatus;
  readonly summary: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

export interface RecommendationData {
  readonly rows: readonly RecommendationRow[];
}

const MAX_LIMIT = 200;
const ALLOWED_STATUSES: readonly RecommendationStatus[] = [
  'pending',
  'approved',
  'dismissed',
  'snoozed',
  'expired',
];

function validateRecommendationQuery(
  query: unknown,
  _ctx: RenderContext,
): QueryValidation<RecommendationQuery> {
  if (query === undefined || query === null) {
    return { ok: true, query: { limit: 20, statuses: ['pending'] } };
  }
  if (typeof query !== 'object') {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'query must be an object or null' },
    };
  }
  const q = query as Record<string, unknown>;

  const limit = q['limit'];
  if (limit !== undefined && (typeof limit !== 'number' || limit < 1)) {
    return {
      ok: false,
      reason: { kind: 'invalid-shape', message: 'limit must be a positive integer' },
    };
  }
  if (typeof limit === 'number' && limit > MAX_LIMIT) {
    return {
      ok: false,
      reason: { kind: 'limit-exceeded', message: `limit must be <= ${MAX_LIMIT}` },
    };
  }

  const statuses = q['statuses'];
  if (statuses !== undefined) {
    if (!Array.isArray(statuses)) {
      return {
        ok: false,
        reason: { kind: 'invalid-shape', message: 'statuses must be an array' },
      };
    }
    for (const s of statuses) {
      if (!ALLOWED_STATUSES.includes(s as RecommendationStatus)) {
        return {
          ok: false,
          reason: {
            kind: 'unknown-field',
            message: `unknown status: ${String(s)}`,
          },
        };
      }
    }
  }

  const minConfidence = q['minConfidence'];
  if (
    minConfidence !== undefined &&
    (typeof minConfidence !== 'number' || minConfidence < 0 || minConfidence > 1)
  ) {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'minConfidence must be a number in [0, 1]',
      },
    };
  }

  const minImpact = q['minImpact'];
  if (
    minImpact !== undefined &&
    (typeof minImpact !== 'number' || minImpact < 0 || minImpact > 10)
  ) {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'minImpact must be a number in [0, 10]',
      },
    };
  }

  const out: RecommendationQuery = {
    limit: (limit as number | undefined) ?? 20,
    statuses: (statuses as readonly RecommendationStatus[] | undefined) ?? ['pending'],
    ...(minConfidence !== undefined ? { minConfidence: minConfidence as number } : {}),
    ...(minImpact !== undefined ? { minImpact: minImpact as number } : {}),
  };
  return { ok: true, query: out };
}

function renderRecommendationToBlocks(
  data: RecommendationData,
  _ctx: RenderContext,
): readonly AgUiUiPart[] {
  if (data.rows.length === 0) {
    return [
      {
        kind: 'markdown-card',
        title: 'Recommendations',
        markdown:
          'No open recommendations. The proactive-intelligence loop will surface ' +
          'new ones as it observes opportunities.',
        severity: 'info',
      },
    ];
  }

  // Sort by confidence × impact desc.
  const ranked = [...data.rows].sort(
    (a, b) => b.confidence * b.impact - a.confidence * a.impact,
  );

  const rows = ranked.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    confidence: Math.round(r.confidence * 1000) / 10, // shown as percent
    impact: r.impact,
    score: Math.round(r.confidence * r.impact * 100) / 100,
    status: r.status,
  }));

  return [
    {
      kind: 'data-table',
      title: 'Recommendations',
      columns: [
        {
          id: 'title',
          header: 'Recommendation',
          accessorKey: 'title',
          enableSorting: true,
        },
        {
          id: 'category',
          header: 'Category',
          accessorKey: 'category',
          enableSorting: true,
        },
        {
          id: 'confidence',
          header: 'Confidence',
          accessorKey: 'confidence',
          format: 'percent',
          enableSorting: true,
        },
        {
          id: 'impact',
          header: 'Impact',
          accessorKey: 'impact',
          format: 'number',
          enableSorting: true,
        },
        {
          id: 'score',
          header: 'Score',
          accessorKey: 'score',
          format: 'number',
          enableSorting: true,
        },
        {
          id: 'status',
          header: 'Status',
          accessorKey: 'status',
          enableSorting: true,
        },
      ],
      rows,
      pageSize: 25,
    },
    {
      kind: 'prompt-suggestions',
      title: 'Actions',
      suggestions: [
        {
          label: 'Approve top 3',
          prompt: 'Approve the three highest-scoring recommendations from the list above.',
          kind: 'primary',
        },
        {
          label: 'Snooze low-confidence',
          prompt:
            'Snooze every recommendation with confidence below 60% for two weeks.',
          kind: 'secondary',
        },
        {
          label: 'Explain rationale',
          prompt: 'Walk me through the rationale for the #1 recommendation.',
          kind: 'secondary',
        },
        {
          label: 'Dismiss all',
          prompt:
            'Dismiss every recommendation in the list above. Tell the brain why ' +
            'before doing it.',
          kind: 'destructive',
        },
      ],
    },
  ];
}

export const RecommendationListView: TabView<
  RecommendationQuery,
  RecommendationData
> = {
  key: 'recommendation.scored.list',
  label: 'Recommendations',
  entity_type: 'recommendation',
  view_kind: 'table',
  defaultQuery: { limit: 20, statuses: ['pending'] },
  validateQuery: validateRecommendationQuery,
  renderToBlocks: renderRecommendationToBlocks,
  sort_order: 60,
  description:
    'Open recommendations sorted by confidence × impact. Click a row to expand the ' +
    'full rationale + evidence. Bulk approve / dismiss / snooze via the action toolbar.',
};
