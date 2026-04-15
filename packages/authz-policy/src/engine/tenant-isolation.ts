/**
 * Tenant Isolation Enforcer
 * 
 * Provides type-safe tenant isolation guarantees for all data access operations.
 * This is a critical security component that ensures tenant boundary violations
 * cannot occur even in the presence of bugs in application code.
 */

import type {
  TenantId,
  TenantScoped,
} from '@bossnyumba/domain-models';

/** Error thrown when tenant isolation is violated */
export class TenantIsolationError extends Error {
  readonly code = 'TENANT_ISOLATION_VIOLATION';
  readonly expectedTenantId: TenantId;
  readonly actualTenantId: TenantId | undefined;
  
  constructor(expectedTenantId: TenantId, actualTenantId?: TenantId) {
    super(
      actualTenantId
        ? `Tenant isolation violation: expected ${expectedTenantId}, got ${actualTenantId}`
        : `Tenant isolation violation: resource does not belong to tenant ${expectedTenantId}`
    );
    this.name = 'TenantIsolationError';
    this.expectedTenantId = expectedTenantId;
    this.actualTenantId = actualTenantId;
  }
}

/** Context for the current tenant scope */
export interface TenantContext {
  readonly tenantId: TenantId;
  readonly isSuperAdmin: boolean;
  /** Identifier of the acting principal (used for audit trail when super-admin crosses tenants). */
  readonly actorId?: string;
  /** Optional reason that justifies a super-admin cross-tenant action. */
  readonly superAdminReason?: string;
  /** Correlation/request identifier propagated with the context. */
  readonly requestId?: string;
}

/**
 * Audit event emitted every time a super-admin performs a cross-tenant operation.
 * Downstream code (e.g. authz-policy audit logger / observability) subscribes via
 * {@link onSuperAdminCrossTenantAccess}.
 */
export interface SuperAdminCrossTenantAuditEvent {
  readonly actorId: string | undefined;
  readonly requestId: string | undefined;
  readonly contextTenantId: TenantId;
  readonly accessedTenantId: TenantId;
  readonly operation: 'assertTenantMatch' | 'assertTenantId' | 'validateEntity' | 'filterTenantEntities';
  readonly reason: string | undefined;
  readonly timestamp: string;
}

type SuperAdminAuditListener = (event: SuperAdminCrossTenantAuditEvent) => void;

const superAdminAuditListeners = new Set<SuperAdminAuditListener>();

/**
 * Register a listener for super-admin cross-tenant audit events.
 * Returns an unregister function.
 */
export function onSuperAdminCrossTenantAccess(
  listener: SuperAdminAuditListener
): () => void {
  superAdminAuditListeners.add(listener);
  return () => {
    superAdminAuditListeners.delete(listener);
  };
}

function emitSuperAdminAudit(event: SuperAdminCrossTenantAuditEvent): void {
  for (const listener of superAdminAuditListeners) {
    try {
      listener(event);
    } catch {
      // Listener failures must never break authz flow.
    }
  }
}

/**
 * Tenant isolation enforcer that ensures all operations are scoped to a single tenant.
 */
export class TenantIsolationEnforcer {
  private readonly context: TenantContext;
  
  constructor(context: TenantContext) {
    this.context = context;
  }
  
  /**
   * Get the current tenant ID.
   */
  get tenantId(): TenantId {
    return this.context.tenantId;
  }
  
  /**
   * Check if current context allows cross-tenant access.
   */
  get allowsCrossTenant(): boolean {
    return this.context.isSuperAdmin;
  }
  
  /**
   * Assert that an entity belongs to the current tenant.
   * Throws TenantIsolationError if not.
   */
  assertTenantMatch<T extends TenantScoped>(entity: T): T {
    if (entity.tenantId !== this.context.tenantId) {
      if (!this.context.isSuperAdmin) {
        throw new TenantIsolationError(this.context.tenantId, entity.tenantId);
      }
      this.auditSuperAdmin('assertTenantMatch', entity.tenantId);
    }
    return entity;
  }

  /**
   * Assert that a tenant ID matches the current context.
   * Throws TenantIsolationError if not.
   */
  assertTenantId(tenantId: TenantId): void {
    if (tenantId !== this.context.tenantId) {
      if (!this.context.isSuperAdmin) {
        throw new TenantIsolationError(this.context.tenantId, tenantId);
      }
      this.auditSuperAdmin('assertTenantId', tenantId);
    }
  }

  /**
   * Emit a super-admin cross-tenant audit event.
   */
  private auditSuperAdmin(
    operation: SuperAdminCrossTenantAuditEvent['operation'],
    accessedTenantId: TenantId
  ): void {
    emitSuperAdminAudit({
      actorId: this.context.actorId,
      requestId: this.context.requestId,
      contextTenantId: this.context.tenantId,
      accessedTenantId,
      operation,
      reason: this.context.superAdminReason,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Filter an array of entities to only those belonging to the current tenant.
   * If not super admin, throws if any entity doesn't match.
   * If super admin, returns all entities.
   */
  filterTenantEntities<T extends TenantScoped>(entities: readonly T[]): readonly T[] {
    if (this.context.isSuperAdmin) {
      const crossed = new Set<TenantId>();
      for (const entity of entities) {
        if (entity.tenantId !== this.context.tenantId) {
          crossed.add(entity.tenantId);
        }
      }
      for (const crossedTenantId of crossed) {
        this.auditSuperAdmin('filterTenantEntities', crossedTenantId);
      }
      return entities;
    }

    const filtered: T[] = [];
    for (const entity of entities) {
      if (entity.tenantId === this.context.tenantId) {
        filtered.push(entity);
      }
    }
    return filtered;
  }
  
  /**
   * Validate and return entity if it belongs to current tenant.
   * Returns null if entity doesn't exist or doesn't belong to tenant.
   */
  validateEntity<T extends TenantScoped>(entity: T | null | undefined): T | null {
    if (!entity) {
      return null;
    }
    
    if (entity.tenantId !== this.context.tenantId) {
      if (!this.context.isSuperAdmin) {
        return null;
      }
      this.auditSuperAdmin('validateEntity', entity.tenantId);
    }

    return entity;
  }
  
  /**
   * Create a scoped query builder that automatically adds tenant filter.
   */
  scopeQuery<T extends Record<string, unknown>>(baseQuery: T): T & { tenantId: TenantId } {
    return {
      ...baseQuery,
      tenantId: this.context.tenantId,
    };
  }
  
  /**
   * Wrap a data access function to ensure tenant isolation.
   */
  wrapDataAccess<TArgs extends unknown[], TReturn extends TenantScoped | null>(
    fn: (...args: TArgs) => Promise<TReturn>
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      const result = await fn(...args);
      if (result) {
        return this.validateEntity(result) as TReturn;
      }
      return result;
    };
  }
  
  /**
   * Wrap a data access function that returns an array to ensure tenant isolation.
   */
  wrapArrayDataAccess<TArgs extends unknown[], TReturn extends TenantScoped>(
    fn: (...args: TArgs) => Promise<readonly TReturn[]>
  ): (...args: TArgs) => Promise<readonly TReturn[]> {
    return async (...args: TArgs): Promise<readonly TReturn[]> => {
      const results = await fn(...args);
      return this.filterTenantEntities(results);
    };
  }
}

/**
 * Async local storage for tenant context.
 * Allows automatic propagation of tenant context through async operations.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Run a function within a tenant context.
 */
export function runWithTenantContext<T>(
  context: TenantContext,
  fn: () => T
): T {
  return tenantContextStorage.run(context, fn);
}

/**
 * Run an async function within a tenant context.
 */
export async function runWithTenantContextAsync<T>(
  context: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  return tenantContextStorage.run(context, fn);
}

/**
 * Get the current tenant context from async local storage.
 * Returns undefined if not in a tenant context.
 */
export function getCurrentTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

/**
 * Get the current tenant context, throwing if not available.
 */
export function requireTenantContext(): TenantContext {
  const context = tenantContextStorage.getStore();
  if (!context) {
    throw new Error('No tenant context available. Ensure operation is running within runWithTenantContext.');
  }
  return context;
}

/**
 * Create a tenant isolation enforcer for the current context.
 */
export function createTenantEnforcer(): TenantIsolationEnforcer {
  const context = requireTenantContext();
  return new TenantIsolationEnforcer(context);
}

/**
 * Decorator-style function to enforce tenant isolation on a service method.
 */
export function enforceTenantIsolation<TThis, TArgs extends unknown[], TReturn extends TenantScoped | null>(
  method: (this: TThis, ...args: TArgs) => Promise<TReturn>
): (this: TThis, ...args: TArgs) => Promise<TReturn> {
  return async function (this: TThis, ...args: TArgs): Promise<TReturn> {
    const result = await method.apply(this, args);
    if (result) {
      const enforcer = createTenantEnforcer();
      return enforcer.validateEntity(result) as TReturn;
    }
    return result;
  };
}

/**
 * SQL query helper that ensures tenant ID is always included.
 */
export interface TenantScopedQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
}

/**
 * Build a tenant-scoped WHERE clause.
 */
export function buildTenantWhereClause(
  tenantColumn = 'tenant_id',
  paramIndex = 1
): TenantScopedQuery {
  const context = requireTenantContext();
  return {
    sql: `${tenantColumn} = $${paramIndex}`,
    params: [context.tenantId],
  };
}

/**
 * Append tenant filter to an existing WHERE clause.
 */
export function appendTenantFilter(
  existingWhere: string,
  existingParams: readonly unknown[],
  tenantColumn = 'tenant_id'
): TenantScopedQuery {
  const context = requireTenantContext();
  const paramIndex = existingParams.length + 1;
  
  const sql = existingWhere
    ? `${existingWhere} AND ${tenantColumn} = $${paramIndex}`
    : `${tenantColumn} = $${paramIndex}`;
  
  return {
    sql,
    params: [...existingParams, context.tenantId],
  };
}
