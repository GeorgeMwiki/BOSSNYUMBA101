/**
 * LLM tool descriptor for `renderTabInChat`.
 *
 * The MD's tool-calling loop reads this descriptor to know:
 *   - the tool's stable name (`renderTabInChat`)
 *   - the JSONSchema of the request shape
 *   - a free-form description that explains when to invoke it
 *
 * The shape mirrors the Anthropic Tool format so the MD orchestrator
 * can register it without an adapter. The `input_schema` is hand
 * written rather than auto-generated so the MD sees an LLM-friendly
 * description for every parameter — not just the type.
 */

import type { TabViewRegistry } from '../registry/tab-view-registry.js';

export interface ToolDescriptor {
  readonly name: 'renderTabInChat';
  readonly description: string;
  readonly input_schema: Readonly<Record<string, unknown>>;
}

/**
 * Build the tool descriptor.
 *
 * The registry is passed in so the description can enumerate the
 * known views — this is the seam that keeps the MD's tool-list up
 * to date even as new entity types come online.
 */
export function describeRenderTabInChatTool(
  registry: TabViewRegistry,
): ToolDescriptor {
  const allViews = registry.all();
  const knownEntityTypes = registry.entityTypes();
  const viewSummary = allViews
    .map(
      (v) =>
        `  - \`${v.key}\` — ${v.entity_type} (${v.view_kind}): ${
          v.description ?? v.label
        }`,
    )
    .join('\n');

  const description =
    `Render a tab's primary view INLINE in chat. This is the universal renderer ` +
    `tool — instead of telling the user to navigate to a tab, you summon the tab's ` +
    `UI directly into the conversation. The user can interact with it (sort, filter, ` +
    `click-row, bulk-select) without leaving chat.\n\n` +
    `When to use this tool:\n` +
    `  - The user asks for a list, table, KPI, timeline, chart, or any structured ` +
    `view of entities (employees, properties, leases, leads, deals, recommendations, ...).\n` +
    `  - The user says "show me", "list", "rank", "compare", or "who are my top".\n\n` +
    `Known entity_types (${knownEntityTypes.length}):\n${knownEntityTypes.map((t) => `  - ${t}`).join('\n')}\n\n` +
    `Available views:\n${viewSummary}\n\n` +
    `IMPORTANT permission contract:\n` +
    `  - Owner-customer principals are STRICTLY scoped to their own tenant. ` +
    `Setting allowCrossTenant for an owner-customer principal returns a "forbidden" ` +
    `error — there is no path around this.\n` +
    `  - Internal-admin principals can opt in to cross-tenant queries with ` +
    `allowCrossTenant + crossTenantReason. Every cross-tenant call is audited.\n`;

  const input_schema = {
    type: 'object',
    properties: {
      entity_type: {
        type: 'string',
        description:
          'The J1 entity_type to render (e.g. "employee", "lease", "kra-filing"). ' +
          'Required unless `viewKey` is provided.',
        enum: knownEntityTypes,
      },
      view_kind: {
        type: 'string',
        description:
          'Optional view-shape filter when the entity_type has multiple paired ' +
          'views. Defaults to the lowest sort_order view.',
        enum: [
          'table',
          'kanban',
          'chart',
          'kpi-grid',
          'matrix',
          'profile-card',
          'timeline',
          'map',
        ],
      },
      viewKey: {
        type: 'string',
        description:
          'Bypass entity_type → view resolution by passing the explicit view ' +
          'registry key (e.g. "employee.roster.table").',
      },
      query: {
        type: 'object',
        description:
          'View-specific query shape. Pass through filters, sort fields, and ' +
          'view-specific options. Each view defines its own shape.',
        additionalProperties: true,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        description: 'Soft top-K cap. Views may further constrain.',
      },
      sortBy: {
        type: 'string',
        description:
          'Convenience sort field. Merged into `query.sortBy` unless query.sortBy is set.',
      },
      sortDir: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Convenience sort direction. Default per-view.',
      },
      filterBy: {
        type: 'array',
        description: 'Convenience filter array. Each entry is {field, op, value}.',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            op: {
              type: 'string',
              enum: ['eq', 'neq', 'in', 'gte', 'lte', 'contains'],
            },
            value: {},
          },
          required: ['field', 'op', 'value'],
        },
      },
      expandRow: {
        type: 'object',
        description: 'Inline expand-row hint when the user clicks a row.',
        properties: {
          entityId: { type: 'string' },
        },
        required: ['entityId'],
      },
      allowCrossTenant: {
        type: 'boolean',
        description:
          'Cross-tenant escape hatch. ONLY honoured for internal-admin principals; ' +
          'returns "forbidden" otherwise. Audited.',
      },
      crossTenantReason: {
        type: 'string',
        description:
          'Required when allowCrossTenant=true. Reason persisted in the audit log.',
      },
      preferenceScope: {
        type: 'string',
        enum: ['session', 'conversation', 'tenant'],
        description:
          'Which preference scope to look up when re-rendering. Defaults to "conversation".',
      },
    },
  } as const;

  return {
    name: 'renderTabInChat',
    description,
    input_schema,
  };
}
