/**
 * `renderTabInChat` — the LLM-facing tool that turns an entity_type
 * + query into a stream of ag-ui blocks.
 *
 * The MD calls this exactly like it calls any other tool. The
 * tool's behaviour:
 *
 *   1. Resolve the TabView by `viewKey` (if provided) OR by
 *      `(entity_type, view_kind?)` from the registry.
 *   2. Merge convenience query overrides (`sortBy`, `filterBy`,
 *      `limit`, `expandRow`) into the raw query.
 *   3. Look up the saved view preference for the requested scope.
 *   4. Call `view.validateQuery(rawQuery, ctx)`. Bail out on
 *      validation failure.
 *   5. Call the DataPort to fetch the materialised view data —
 *      scoped to `principal.tenantId`. cross-tenant only when
 *      principal is internal-admin AND `allowCrossTenant: true`.
 *   6. Call `view.renderToBlocks(data, ctx)` to get the ag-ui parts.
 *   7. Emit an audit-log entry.
 *   8. Return `{ ok: true, parts, citations, audit }`.
 *
 * The tool is permission-aware in the sense that the principal's
 * tenantId is the predicate the DataPort uses to scope every
 * query. There is no path by which an owner-customer principal
 * can render another tenant's data — `allowCrossTenant: true`
 * is silently refused (returns `forbidden`).
 */

import type { TabView, RenderContext, ViewKind } from '../types/tab-view.js';
import type { Principal } from '../types/principal.js';
import type { Citation } from '../types/citation.js';
import type { TabViewRegistry } from '../registry/tab-view-registry.js';
import type { CustomizationStore } from '../customization/preference-store.js';
import type { DataPort } from './data-port.js';
import { type AuditSink, nextAuditId } from './audit-sink.js';
import type {
  RenderTabRequest,
  RenderTabResult,
  RenderAuditEntry,
} from './types.js';

export interface RenderTabDeps {
  readonly registry: TabViewRegistry;
  readonly dataPort: DataPort;
  readonly audit: AuditSink;
  /** Optional preference store — when present, prefs are applied + saved. */
  readonly preferenceStore?: CustomizationStore;
  /** Optional injected clock for deterministic tests. */
  readonly now?: () => Date;
}

export interface RenderTabContext {
  readonly principal: Principal;
  readonly sessionId?: string;
  readonly conversationId?: string;
}

/**
 * Resolve the TabView the request points at.
 */
function resolveView(
  registry: TabViewRegistry,
  request: RenderTabRequest,
): TabView<unknown, unknown> | { error: { kind: 'view-not-found' | 'entity-type-unknown'; message: string } } {
  if (typeof request.viewKey === 'string') {
    const view = registry.get(request.viewKey);
    if (!view) {
      return {
        error: {
          kind: 'view-not-found',
          message: `no view registered with key "${request.viewKey}"`,
        },
      };
    }
    return view;
  }
  if (typeof request.entity_type !== 'string' || request.entity_type.length === 0) {
    return {
      error: {
        kind: 'entity-type-unknown',
        message: 'entity_type or viewKey is required',
      },
    };
  }
  const candidates = registry.forEntityType(request.entity_type);
  if (candidates.length === 0) {
    return {
      error: {
        kind: 'entity-type-unknown',
        message: `no views registered for entity_type "${request.entity_type}"`,
      },
    };
  }
  if (typeof request.view_kind === 'string') {
    const match = candidates.find((v) => v.view_kind === request.view_kind);
    if (match) return match;
    // Fall back to the lowest sort_order candidate if the requested
    // view_kind doesn't exist for this entity_type.
  }
  return candidates[0] as TabView<unknown, unknown>;
}

/**
 * Merge the convenience overrides into the raw query.
 *
 * The merge precedence is: explicit `query` fields win over
 * convenience overrides. So if the MD passes both `query.sortBy`
 * and `sortBy`, the inner one is kept.
 */
function mergeQueryOverrides(request: RenderTabRequest): unknown {
  const base =
    request.query !== undefined && request.query !== null
      ? (request.query as Record<string, unknown>)
      : {};
  const merged: Record<string, unknown> = { ...base };
  if (request.sortBy !== undefined && merged['sortBy'] === undefined) {
    merged['sortBy'] = request.sortBy;
  }
  if (request.sortDir !== undefined && merged['sortDir'] === undefined) {
    merged['sortDir'] = request.sortDir;
  }
  if (request.limit !== undefined && merged['limit'] === undefined) {
    merged['limit'] = request.limit;
  }
  if (
    request.filterBy !== undefined &&
    Array.isArray(request.filterBy) &&
    merged['filterBy'] === undefined
  ) {
    merged['filterBy'] = request.filterBy;
  }
  return merged;
}

/**
 * Check the cross-tenant gate. Refuse owner-customer principals
 * outright. Internal-admin must supply a reason.
 */
function evaluateCrossTenant(
  request: RenderTabRequest,
  principal: Principal,
): { ok: true; allow: boolean } | { ok: false; message: string } {
  if (request.allowCrossTenant !== true) {
    return { ok: true, allow: false };
  }
  if (principal.kind !== 'internal-admin') {
    return {
      ok: false,
      message:
        'cross-tenant render is restricted to internal-admin principals. ' +
        'owner-customer principals must remain scoped to their own tenant.',
    };
  }
  if (typeof request.crossTenantReason !== 'string' || request.crossTenantReason.length === 0) {
    return {
      ok: false,
      message:
        'cross-tenant render requires crossTenantReason (string). The reason is ' +
        'persisted in the audit log.',
    };
  }
  return { ok: true, allow: true };
}

/**
 * Run a single render.
 */
export async function renderTabInChat(
  request: RenderTabRequest,
  ctx: RenderTabContext,
  deps: RenderTabDeps,
): Promise<RenderTabResult> {
  const now = deps.now ?? (() => new Date());

  const viewOrError = resolveView(deps.registry, request);
  if ('error' in viewOrError) {
    return { ok: false, error: viewOrError.error };
  }
  const view = viewOrError;

  const crossTenantGate = evaluateCrossTenant(request, ctx.principal);
  if (!crossTenantGate.ok) {
    return {
      ok: false,
      error: { kind: 'forbidden', message: crossTenantGate.message },
    };
  }

  const rawQuery = mergeQueryOverrides(request);

  // Look up saved preference if the request didn't supply one.
  let preference = request.applyPreference;
  if (preference === undefined && deps.preferenceStore !== undefined) {
    const scope = request.preferenceScope ?? 'conversation';
    const found = await deps.preferenceStore.read({
      principal: ctx.principal,
      viewKey: view.key,
      scope,
      ...(ctx.conversationId !== undefined ? { conversationId: ctx.conversationId } : {}),
      ...(ctx.sessionId !== undefined ? { sessionId: ctx.sessionId } : {}),
    });
    if (found !== undefined) preference = found;
  }

  const renderCtx: RenderContext = {
    principal: ctx.principal,
    entityType: view.entity_type,
    now,
    ...(ctx.sessionId !== undefined ? { sessionId: ctx.sessionId } : {}),
    ...(ctx.conversationId !== undefined ? { conversationId: ctx.conversationId } : {}),
    ...(preference !== undefined ? { preference } : {}),
  };

  const validation = view.validateQuery(rawQuery, renderCtx);
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        kind: 'invalid-query',
        message: validation.reason.message,
        cause: validation.reason,
      },
    };
  }

  let fetched;
  try {
    fetched = await deps.dataPort.fetchViewData<unknown>({
      viewKey: view.key,
      entity_type: view.entity_type,
      query: validation.query,
      principal: ctx.principal,
      options: {
        ...(crossTenantGate.allow ? { allowCrossTenant: true } : {}),
        ...(request.crossTenantReason !== undefined
          ? { crossTenantReason: request.crossTenantReason }
          : {}),
        ...(request.expandRow !== undefined ? { expandRow: request.expandRow } : {}),
        ...(request.limit !== undefined ? { limit: request.limit } : {}),
      },
    });
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: 'fetch-failed',
        message: `data fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  let parts;
  try {
    parts = view.renderToBlocks(fetched.data, renderCtx);
  } catch (e) {
    return {
      ok: false,
      error: {
        kind: 'render-failed',
        message: `render failed: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  // Dedup citations by id — multiple parts may cite the same entity.
  const citationMap = new Map<string, Citation>();
  for (const c of fetched.citations) {
    if (!citationMap.has(c.id)) citationMap.set(c.id, c);
  }
  const citations = Object.freeze(Array.from(citationMap.values()));

  const audit: RenderAuditEntry = {
    auditId: nextAuditId(now),
    viewKey: view.key,
    entity_type: view.entity_type,
    principalId: ctx.principal.principalId,
    tenantId: ctx.principal.tenantId,
    crossTenant: fetched.crossTenant,
    ...(request.crossTenantReason !== undefined ? { reason: request.crossTenantReason } : {}),
    renderedAt: now().toISOString(),
    partKindsEmitted: parts.map((p) => p.kind),
    ...(fetched.rowCountHint !== undefined ? { rowCountHint: fetched.rowCountHint } : {}),
  };
  await deps.audit.emit(audit);

  return {
    ok: true,
    viewKey: view.key,
    entity_type: view.entity_type,
    view_kind: view.view_kind as ViewKind,
    parts,
    citations,
    audit,
  };
}
