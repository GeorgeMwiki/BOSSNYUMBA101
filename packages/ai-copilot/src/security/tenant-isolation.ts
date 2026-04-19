/**
 * BOSSNYUMBA AI tenant isolation — Wave-11 AI security hardening.
 *
 * Hard boundary per AI call. Validates that every tool result, memory
 * fragment, and record being assembled into the prompt belongs to the
 * CURRENT tenantId. Throws TenantBoundaryError on breach — never silently
 * returns cross-tenant data.
 *
 * In BOSSNYUMBA, tenants are organisations; fields named `tenant_id` /
 * `tenantId` are authoritative. We recognise a handful of parallel fields
 * (`org_id`, `organizationId`) for forward-compat with any legacy rows.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantContext {
  readonly tenantId: string;
  readonly actorId?: string;
  readonly personaId?: string;
}

export interface IsolationViolation {
  readonly type:
    | 'cross_tenant_record'
    | 'missing_tenant_filter'
    | 'unscoped_query';
  readonly path: string;
  readonly foreignTenantId?: string;
  readonly severity: 'critical' | 'high' | 'medium';
  readonly detail: string;
}

export interface IsolationCheckResult {
  readonly safe: boolean;
  readonly violations: readonly IsolationViolation[];
}

export class TenantBoundaryError extends Error {
  readonly code = 'TENANT_BOUNDARY_VIOLATION' as const;
  readonly tenantId: string;
  readonly violations: readonly IsolationViolation[];

  constructor(params: {
    tenantId: string;
    violations: readonly IsolationViolation[];
  }) {
    const firstPath = params.violations[0]?.path ?? '<unknown>';
    super(
      `Tenant boundary violation for ${params.tenantId}: ${params.violations.length} breach(es), first at ${firstPath}`,
    );
    this.name = 'TenantBoundaryError';
    this.tenantId = params.tenantId;
    this.violations = Object.freeze([...params.violations]);
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TENANT_FIELD_KEYS = [
  'tenant_id',
  'tenantId',
  'org_id',
  'organization_id',
  'orgId',
  'organizationId',
] as const;

function isForeignTenantValue(
  value: unknown,
  expected: string,
): string | null {
  if (value === null || value === undefined) return null;
  const asString = String(value).trim();
  if (!asString || asString === 'null' || asString === 'undefined') return null;
  return asString === expected ? null : asString;
}

function walk(
  data: unknown,
  expected: string,
  path: string,
  out: IsolationViolation[],
): void {
  if (data === null || data === undefined) return;

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      walk(data[i], expected, `${path}[${i}]`, out);
    }
    return;
  }

  if (typeof data !== 'object') return;

  const record = data as Record<string, unknown>;
  for (const key of TENANT_FIELD_KEYS) {
    if (key in record) {
      const foreign = isForeignTenantValue(record[key], expected);
      if (foreign !== null) {
        out.push({
          type: 'cross_tenant_record',
          path: `${path}.${key}`,
          foreignTenantId: foreign,
          severity: 'critical',
          detail: `Field "${key}" has tenant "${foreign}" but current tenant is "${expected}"`,
        });
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    walk(value, expected, `${path}.${key}`, out);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deep scan an object graph for cross-tenant records. Safe to pass tool
 * results, memory fragments, or user-facing payloads.
 */
export function validateTenantScope(
  value: unknown,
  ctx: TenantContext,
): IsolationCheckResult {
  if (!ctx.tenantId) {
    return {
      safe: false,
      violations: [
        {
          type: 'missing_tenant_filter',
          path: '<context>',
          severity: 'high',
          detail: 'TenantContext.tenantId is empty; refusing to evaluate',
        },
      ],
    };
  }
  const violations: IsolationViolation[] = [];
  walk(value, ctx.tenantId, 'root', violations);
  return { safe: violations.length === 0, violations };
}

/**
 * Guard variant — throws TenantBoundaryError on breach. Use inside the AI
 * call path where silent redaction is not acceptable.
 */
export function assertTenantScope(value: unknown, ctx: TenantContext): void {
  const result = validateTenantScope(value, ctx);
  if (!result.safe) {
    throw new TenantBoundaryError({
      tenantId: ctx.tenantId,
      violations: result.violations,
    });
  }
}

/**
 * Best-effort scrubber: replaces cross-tenant subtrees with a sentinel so the
 * LLM still receives a structurally-valid payload. Use at the OUTER edge (for
 * example, before rendering to the user) where you prefer degraded over crash.
 */
export function scrubForeignTenantData(
  value: unknown,
  ctx: TenantContext,
): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    const mapped = value
      .map((item) => scrubForeignTenantData(item, ctx))
      .filter((item) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          'redacted' in (item as Record<string, unknown>)
        ) {
          return false;
        }
        return true;
      });
    return mapped;
  }
  if (typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  for (const key of TENANT_FIELD_KEYS) {
    if (key in record) {
      const foreign = isForeignTenantValue(record[key], ctx.tenantId);
      if (foreign !== null) {
        return { redacted: true, reason: 'cross_tenant_isolation' };
      }
    }
  }
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    cleaned[k] = scrubForeignTenantData(v, ctx);
  }
  return cleaned;
}

/**
 * Helper for the query-planning layer: reject filter objects that do not
 * carry an explicit tenant clause.
 */
export function assertQueryHasTenantFilter(
  description: string,
  filters: Readonly<Record<string, unknown>>,
  ctx: TenantContext,
): void {
  if (!ctx.tenantId) {
    throw new TenantBoundaryError({
      tenantId: '<empty>',
      violations: [
        {
          type: 'missing_tenant_filter',
          path: description,
          severity: 'critical',
          detail: 'tenantId missing from context',
        },
      ],
    });
  }
  const hasFilter = TENANT_FIELD_KEYS.some((k) => k in filters);
  if (!hasFilter) {
    throw new TenantBoundaryError({
      tenantId: ctx.tenantId,
      violations: [
        {
          type: 'missing_tenant_filter',
          path: description,
          severity: 'high',
          detail: `Query "${description}" missing tenant filter`,
        },
      ],
    });
  }
}
