/**
 * Placeholder TabView — a minimal data-table view used to seed the
 * registry for entity_types that don't yet have a headline view.
 *
 * Renders a labelled markdown-card when the rows array is empty,
 * and a basic 3-column data-table (id / label / updatedAt) when
 * rows are supplied. Portals or follow-up phases override the
 * placeholder by registering a richer view with the same key.
 *
 * The placeholder is HALF a contract enforcement mechanism: the
 * registry tests assert that every seeded entity_type has at least
 * one view. By stubbing the missing ones we keep that invariant
 * green even before the headline views land for the remaining
 * types. Authors who write a real view for `vendor` simply
 * `.deregister('vendor.default')` and `.register(VendorTableView)`.
 */

import type { AgUiUiPart } from '../types/ag-ui.js';
import type {
  TabView,
  RenderContext,
  QueryValidation,
} from '../types/tab-view.js';

export interface PlaceholderQuery {
  readonly limit?: number;
}

export interface PlaceholderRow {
  readonly id: string;
  readonly label: string;
  readonly updatedAt: string;
  readonly [extra: string]: unknown;
}

export interface PlaceholderData {
  readonly rows: readonly PlaceholderRow[];
}

const MAX_LIMIT = 500;

function validatePlaceholderQuery(
  query: unknown,
  _ctx: RenderContext,
): QueryValidation<PlaceholderQuery> {
  if (query === undefined || query === null) {
    return { ok: true, query: { limit: 100 } };
  }
  if (typeof query !== 'object') {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'query must be an object or null',
      },
    };
  }
  const q = query as Record<string, unknown>;
  const limit = q['limit'];
  if (limit !== undefined && (typeof limit !== 'number' || limit < 1)) {
    return {
      ok: false,
      reason: {
        kind: 'invalid-shape',
        message: 'limit must be a positive integer',
      },
    };
  }
  if (typeof limit === 'number' && limit > MAX_LIMIT) {
    return {
      ok: false,
      reason: {
        kind: 'limit-exceeded',
        message: `limit must be <= ${MAX_LIMIT}`,
      },
    };
  }
  const out: PlaceholderQuery = limit !== undefined
    ? { limit: limit as number }
    : { limit: 100 };
  return { ok: true, query: out };
}

function renderPlaceholderToBlocks(
  data: PlaceholderData,
  ctx: RenderContext,
): readonly AgUiUiPart[] {
  if (data.rows.length === 0) {
    return [
      {
        kind: 'markdown-card',
        title: `${humaniseEntityType(ctx.entityType)}`,
        markdown:
          `No \`${ctx.entityType}\` records exist for this tenant yet. ` +
          `As soon as the MD creates the first one, this view will materialise.`,
        severity: 'info',
      },
    ];
  }
  return [
    {
      kind: 'data-table',
      title: humaniseEntityType(ctx.entityType),
      columns: [
        { id: 'id', header: 'ID', accessorKey: 'id', enableSorting: true },
        { id: 'label', header: 'Label', accessorKey: 'label', enableSorting: true },
        {
          id: 'updatedAt',
          header: 'Updated',
          accessorKey: 'updatedAt',
          format: 'date',
          enableSorting: true,
        },
      ],
      rows: data.rows.map((r) => ({
        id: r.id,
        label: r.label,
        updatedAt: r.updatedAt,
      })),
      pageSize: 25,
    },
  ];
}

/**
 * Human-friendly default label — converts `kra-filing` →
 * `Kra Filing` etc. Used when a placeholder doesn't override the
 * label explicitly.
 */
function humaniseEntityType(entity_type: string): string {
  return entity_type
    .split('-')
    .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ');
}

/**
 * Build the placeholder view for `entity_type`. Stable key shape:
 *   `<entity_type>.default`
 */
export function buildPlaceholderView(
  entity_type: string,
): TabView<PlaceholderQuery, PlaceholderData> {
  return {
    key: `${entity_type}.default`,
    label: humaniseEntityType(entity_type),
    entity_type,
    view_kind: 'table',
    defaultQuery: { limit: 100 },
    validateQuery: validatePlaceholderQuery,
    renderToBlocks: renderPlaceholderToBlocks,
    sort_order: 9000,
    description:
      `Placeholder default view for ${entity_type}. Override by registering ` +
      `a richer view with the same key, or register an additional view with a ` +
      `distinct key.`,
  };
}
