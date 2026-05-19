/**
 * Scope enforcement tests — internal-admin vs owner-customer-tenant.
 *
 * The matrix:
 *
 *   principal             platform scope          tenant scope
 *   ───────────────────── ─────────────────────── ───────────────────────────
 *   internal-admin        ALLOW                   ALLOW iff grant present
 *   tenant-user           DENY                    ALLOW iff tenantId match
 *   system                ALLOW                   ALLOW
 */

import { describe, it, expect } from 'vitest';
import {
  enforceScope,
  PLATFORM_OWNER_ID,
  ScopeViolationError,
  type CallerPrincipal,
} from '../types/scope.js';

const ALPHA = 't_alpha';
const BETA = 't_beta';

describe('enforceScope / internal-admin', () => {
  const admin: CallerPrincipal = {
    role: 'internal-admin',
    crossTenantGrants: [ALPHA],
  };

  it('allows platform scope', () => {
    expect(() =>
      enforceScope(admin, { ownerType: 'platform', ownerId: PLATFORM_OWNER_ID }),
    ).not.toThrow();
  });

  it('allows granted tenant scope', () => {
    expect(() =>
      enforceScope(admin, { ownerType: 'tenant', ownerId: ALPHA }),
    ).not.toThrow();
  });

  it('rejects ungranted tenant scope', () => {
    expect(() =>
      enforceScope(admin, { ownerType: 'tenant', ownerId: BETA }),
    ).toThrow(ScopeViolationError);
  });

  it('rejects ungranted tenant scope when grants array is missing', () => {
    expect(() =>
      enforceScope({ role: 'internal-admin' }, { ownerType: 'tenant', ownerId: ALPHA }),
    ).toThrow(ScopeViolationError);
  });
});

describe('enforceScope / tenant-user', () => {
  const owner: CallerPrincipal = { role: 'tenant-user', tenantId: ALPHA };

  it('rejects platform scope', () => {
    expect(() =>
      enforceScope(owner, { ownerType: 'platform', ownerId: PLATFORM_OWNER_ID }),
    ).toThrow(ScopeViolationError);
  });

  it('allows own tenant', () => {
    expect(() =>
      enforceScope(owner, { ownerType: 'tenant', ownerId: ALPHA }),
    ).not.toThrow();
  });

  it('rejects another tenant', () => {
    expect(() =>
      enforceScope(owner, { ownerType: 'tenant', ownerId: BETA }),
    ).toThrow(ScopeViolationError);
  });

  it('rejects tenant-user with no tenantId', () => {
    expect(() =>
      enforceScope({ role: 'tenant-user' }, { ownerType: 'tenant', ownerId: ALPHA }),
    ).toThrow(ScopeViolationError);
  });
});

describe('enforceScope / system', () => {
  const sys: CallerPrincipal = { role: 'system' };

  it('allows platform scope', () => {
    expect(() =>
      enforceScope(sys, { ownerType: 'platform', ownerId: PLATFORM_OWNER_ID }),
    ).not.toThrow();
  });

  it('allows tenant scope', () => {
    expect(() =>
      enforceScope(sys, { ownerType: 'tenant', ownerId: ALPHA }),
    ).not.toThrow();
  });
});

describe('ScopeViolationError', () => {
  it('carries the principal + attempt for ops debugging', () => {
    try {
      enforceScope(
        { role: 'tenant-user', tenantId: ALPHA },
        { ownerType: 'tenant', ownerId: BETA },
      );
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ScopeViolationError);
      const err = e as ScopeViolationError;
      expect(err.principal.role).toBe('tenant-user');
      expect(err.attemptedScope.ownerId).toBe(BETA);
    }
  });
});
