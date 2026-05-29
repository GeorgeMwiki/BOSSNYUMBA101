/**
 * Tool router — maps a public MCP tool name to the api-gateway REST
 * route + method + body shaping. Pure data; no transport code.
 *
 * Owned here (not in the api-gateway) because the public catalog
 * versioning belongs to the MCP surface, not to the kernel.
 */

export interface ToolRoute {
  readonly path: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly bodyKeys?: ReadonlyArray<string>;
  readonly queryKeys?: ReadonlyArray<string>;
}

const r = (route: ToolRoute): ToolRoute => Object.freeze(route);

export const TOOL_ROUTE_MAP: Readonly<Record<string, ToolRoute>> = Object.freeze(
  {
    property_drafts_compose_free_form: r({
      path: '/api/v1/owner/drafts/compose',
      method: 'POST',
      bodyKeys: ['intent', 'locale', 'format'],
    }),
    property_drafts_list: r({
      path: '/api/v1/owner/drafts',
      method: 'GET',
      queryKeys: ['cursor', 'limit'],
    }),
    property_drafts_view: r({
      path: '/api/v1/owner/drafts/{id}',
      method: 'GET',
    }),
    property_drafts_lock: r({
      path: '/api/v1/owner/drafts/revisions/{revisionId}/lock',
      method: 'POST',
      bodyKeys: ['reason'],
    }),
    property_media_generate: r({
      path: '/api/v1/owner/media/generate',
      method: 'POST',
      bodyKeys: ['entityRef', 'kind', 'prompt'],
    }),
    property_ui_tabs_list: r({
      path: '/api/v1/owner/tabs',
      method: 'GET',
    }),
    property_ui_tabs_spawn: r({
      path: '/api/v1/owner/tabs/spawn',
      method: 'POST',
      bodyKeys: ['kind', 'params'],
    }),
    property_opportunities_scan: r({
      path: '/api/v1/property/opportunities/scan',
      method: 'POST',
      bodyKeys: ['scope'],
    }),
    property_risks_scan: r({
      path: '/api/v1/property/risks/scan',
      method: 'POST',
      bodyKeys: ['scope'],
    }),
    property_calibration_status: r({
      path: '/api/v1/property/calibration/status',
      method: 'GET',
    }),
    decisions_list: r({
      path: '/api/v1/decisions',
      method: 'GET',
      queryKeys: ['since', 'limit'],
    }),
    decisions_create: r({
      path: '/api/v1/decisions',
      method: 'POST',
      bodyKeys: ['title', 'rationale', 'expectedOutcome', 'stakes'],
    }),
    entity_index_summary: r({
      path: '/api/v1/entities/summary',
      method: 'GET',
    }),
    scope_nodes_list: r({
      path: '/api/v1/owner/scope/nodes',
      method: 'GET',
    }),
    scope_nodes_create: r({
      path: '/api/v1/owner/scope/nodes',
      method: 'POST',
      bodyKeys: ['name', 'kind', 'parentId'],
    }),
    md_daily_brief: r({
      path: '/api/v1/property/cockpit/daily-brief',
      method: 'GET',
      queryKeys: ['asOfDate', 'locale'],
    }),
    property_marketplace_listings: r({
      path: '/api/v1/marketplace/listings',
      method: 'GET',
    }),
    property_workforce_list: r({
      path: '/api/v1/property/workforce',
      method: 'GET',
      queryKeys: ['scope'],
    }),
    property_geology_samples: r({
      path: '/api/v1/property/geology/samples',
      method: 'GET',
      queryKeys: ['scopeId'],
    }),
    property_production_today: r({
      path: '/api/v1/property/production/today',
      method: 'GET',
    }),
    property_cooperatives_list: r({
      path: '/api/v1/property/cooperatives',
      method: 'GET',
    }),
    property_insurance_policies: r({
      path: '/api/v1/property/insurance/policies',
      method: 'GET',
    }),
    owner_messaging_threads: r({
      path: '/api/v1/owner/messaging/threads',
      method: 'GET',
    }),
    compliance_status: r({
      path: '/api/v1/compliance/status',
      method: 'GET',
    }),
    estate_net_worth: r({
      path: '/api/v1/owner/estate/net-worth',
      method: 'GET',
    }),
    estate_share_link_create: r({
      path: '/api/v1/owner/share-links',
      method: 'POST',
      bodyKeys: ['entityRef', 'hours', 'recipientEmail'],
    }),
    reminders_list: r({
      path: '/api/v1/owner/reminders',
      method: 'GET',
    }),
    reminders_create: r({
      path: '/api/v1/owner/reminders',
      method: 'POST',
      bodyKeys: ['at', 'body'],
    }),
    owner_undo_last: r({
      path: '/api/v1/owner/undo',
      method: 'POST',
    }),
  },
);

/**
 * Substitute `{name}` placeholders in a path with the matching input
 * key. Throws when a placeholder is required but missing — the MCP
 * dispatcher catches and turns it into INVALID_PARAMS.
 */
export function substitutePath(
  template: string,
  input: Readonly<Record<string, unknown>>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const v = input[key];
    if (v === undefined || v === null) {
      throw new Error(`missing required path param: ${key}`);
    }
    return encodeURIComponent(String(v));
  });
}

/**
 * Pure helper — produce the body and query subsets from the full input
 * object, based on the route's declared keys. Keeps the dispatcher
 * deterministic and easy to test.
 */
export interface ShapedRequest {
  readonly body: Record<string, unknown> | undefined;
  readonly query: Record<string, string | number | undefined> | undefined;
}

export function shapeRequest(
  route: ToolRoute,
  input: Readonly<Record<string, unknown>>,
): ShapedRequest {
  let body: Record<string, unknown> | undefined;
  if (route.bodyKeys && route.bodyKeys.length > 0) {
    body = {};
    for (const k of route.bodyKeys) {
      if (input[k] !== undefined) body[k] = input[k];
    }
    if (Object.keys(body).length === 0) body = undefined;
  }
  let query: Record<string, string | number | undefined> | undefined;
  if (route.queryKeys && route.queryKeys.length > 0) {
    query = {};
    for (const k of route.queryKeys) {
      const v = input[k];
      if (v === undefined) continue;
      if (typeof v === 'string' || typeof v === 'number') {
        query[k] = v;
      } else {
        query[k] = String(v);
      }
    }
    if (Object.keys(query).length === 0) query = undefined;
  }
  return Object.freeze({ body, query });
}
