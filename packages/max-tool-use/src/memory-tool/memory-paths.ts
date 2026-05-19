/**
 * Memory path policy.
 *
 * Per-tenant memory directory layout:
 *
 *   /mnt/memory/<tenantId>/<scope>/<note>.md
 *
 * scope ∈ playbooks | vendors | tenants | properties | learned-heuristics
 *
 * Path inputs are sanitized to prevent traversal.
 */

const SCOPES = [
  'playbooks',
  'vendors',
  'tenants',
  'properties',
  'learned-heuristics',
] as const;
export type MemoryScope = (typeof SCOPES)[number];

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export class MemoryPathError extends Error {
  override readonly name = 'MemoryPathError';
}

export function resolveMemoryPath(
  rootPrefix: string,
  tenantId: string,
  relative: string,
): string {
  assertSafeTenantId(tenantId);
  const segments = relative.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) {
    throw new MemoryPathError('path is empty');
  }
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || !SAFE_SEGMENT.test(seg)) {
      throw new MemoryPathError(`invalid path segment "${seg}"`);
    }
  }
  return `${rootPrefix}/${tenantId}/${segments.join('/')}`;
}

export function resolveMemoryDir(rootPrefix: string, tenantId: string, scope: MemoryScope | ''): string {
  assertSafeTenantId(tenantId);
  if (scope === '') return `${rootPrefix}/${tenantId}`;
  if (!SCOPES.includes(scope)) {
    throw new MemoryPathError(`unknown scope "${scope}"`);
  }
  return `${rootPrefix}/${tenantId}/${scope}`;
}

function assertSafeTenantId(tenantId: string): void {
  if (!tenantId || !SAFE_SEGMENT.test(tenantId)) {
    throw new MemoryPathError(`invalid tenantId "${tenantId}"`);
  }
}

export const SUPPORTED_SCOPES = SCOPES;
