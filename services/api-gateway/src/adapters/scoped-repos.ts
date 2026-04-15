// @ts-nocheck
/**
 * Tenant-scoped repository accessor.
 *
 * Wraps the global `Repositories` container so that callers cannot accidentally
 * reach across tenants. Each method auto-injects the tenant id derived from the
 * request's auth context.
 */

import type { Repositories } from '../middleware/database';

export interface ScopedRepos {
  readonly tenantId: string;

  tenant: {
    findCurrent: () => Promise<any>;
    update: (input: Record<string, unknown>, updatedBy: string) => Promise<any>;
  };

  users: {
    findById: (id: string) => Promise<any>;
    findByEmail: (email: string) => Promise<any>;
    findMany: (limit?: number, offset?: number, filters?: Record<string, unknown>) => Promise<any>;
    create: (data: Record<string, unknown>) => Promise<any>;
    update: (id: string, data: Record<string, unknown>) => Promise<any>;
    delete: (id: string, deletedBy: string) => Promise<void>;
  };

  properties: {
    findById: (id: string) => Promise<any>;
    findMany: (pagination?: { limit: number; offset: number }) => Promise<any>;
    create: (input: Record<string, unknown>, createdBy: string) => Promise<any>;
    update: (id: string, input: Record<string, unknown>, updatedBy: string) => Promise<any>;
    delete: (id: string, deletedBy: string) => Promise<void>;
  };

  units: {
    findById: (id: string) => Promise<any>;
    findByProperty: (propertyId: string, pagination?: { limit: number; offset: number }) => Promise<any>;
    findMany: (pagination?: { limit: number; offset: number }) => Promise<any>;
    create: (input: Record<string, unknown>, createdBy: string) => Promise<any>;
    update: (id: string, input: Record<string, unknown>, updatedBy: string) => Promise<any>;
    delete: (id: string, deletedBy: string) => Promise<void>;
  };

  customers: {
    findById: (id: string) => Promise<any>;
    findMany: (pagination?: { limit: number; offset: number }, filters?: Record<string, unknown>) => Promise<any>;
    create: (input: Record<string, unknown>, createdBy: string) => Promise<any>;
    update: (id: string, input: Record<string, unknown>, updatedBy: string) => Promise<any>;
    delete: (id: string, deletedBy: string) => Promise<void>;
  };

  leases: {
    findById: (id: string) => Promise<any>;
    findMany: (
      pagination?: { limit: number; offset: number },
      filters?: Record<string, unknown>
    ) => Promise<any>;
    create: (input: Record<string, unknown>, createdBy: string) => Promise<any>;
    update: (id: string, input: Record<string, unknown>, updatedBy: string) => Promise<any>;
    delete: (id: string, deletedBy: string) => Promise<void>;
  };

  invoices: {
    findById: (id: string) => Promise<any>;
    findMany: (limit?: number, offset?: number) => Promise<any>;
  };

  payments: {
    findById: (id: string) => Promise<any>;
    findMany: (limit?: number, offset?: number) => Promise<any>;
  };
}

const NOT_AVAILABLE = (label: string) => () => {
  throw new Error(`Repository not available: ${label}`);
};

/**
 * Build a tenant-scoped facade from the shared repositories instance.
 */
export function buildScopedRepos(
  repos: Repositories | null,
  tenantId: string
): ScopedRepos {
  if (!repos || !tenantId) {
    return {
      tenantId,
      tenant: {
        findCurrent: NOT_AVAILABLE('tenant.findCurrent'),
        update: NOT_AVAILABLE('tenant.update'),
      },
      users: {
        findById: NOT_AVAILABLE('users.findById'),
        findByEmail: NOT_AVAILABLE('users.findByEmail'),
        findMany: NOT_AVAILABLE('users.findMany'),
        create: NOT_AVAILABLE('users.create'),
        update: NOT_AVAILABLE('users.update'),
        delete: NOT_AVAILABLE('users.delete'),
      },
      properties: {
        findById: NOT_AVAILABLE('properties.findById'),
        findMany: NOT_AVAILABLE('properties.findMany'),
        create: NOT_AVAILABLE('properties.create'),
        update: NOT_AVAILABLE('properties.update'),
        delete: NOT_AVAILABLE('properties.delete'),
      },
      units: {
        findById: NOT_AVAILABLE('units.findById'),
        findByProperty: NOT_AVAILABLE('units.findByProperty'),
        findMany: NOT_AVAILABLE('units.findMany'),
        create: NOT_AVAILABLE('units.create'),
        update: NOT_AVAILABLE('units.update'),
        delete: NOT_AVAILABLE('units.delete'),
      },
      customers: {
        findById: NOT_AVAILABLE('customers.findById'),
        findMany: NOT_AVAILABLE('customers.findMany'),
        create: NOT_AVAILABLE('customers.create'),
        update: NOT_AVAILABLE('customers.update'),
        delete: NOT_AVAILABLE('customers.delete'),
      },
      leases: {
        findById: NOT_AVAILABLE('leases.findById'),
        findMany: NOT_AVAILABLE('leases.findMany'),
        create: NOT_AVAILABLE('leases.create'),
        update: NOT_AVAILABLE('leases.update'),
        delete: NOT_AVAILABLE('leases.delete'),
      },
      invoices: {
        findById: NOT_AVAILABLE('invoices.findById'),
        findMany: NOT_AVAILABLE('invoices.findMany'),
      },
      payments: {
        findById: NOT_AVAILABLE('payments.findById'),
        findMany: NOT_AVAILABLE('payments.findMany'),
      },
    };
  }

  return {
    tenantId,
    tenant: {
      findCurrent: () => repos.tenants.findById(tenantId),
      update: (input, updatedBy) => repos.tenants.update(tenantId, input, updatedBy),
    },
    users: {
      findById: (id) => repos.users.findById(id, tenantId),
      findByEmail: (email) => repos.users.findByEmail(email, tenantId),
      findMany: (limit = 50, offset = 0, filters) =>
        repos.users.findMany(tenantId, limit, offset, filters as any),
      create: (data) => repos.users.create({ ...data, tenantId }),
      update: (id, data) => repos.users.update(id, tenantId, data),
      delete: (id, deletedBy) => repos.users.delete(id, tenantId, deletedBy),
    },
    properties: {
      findById: (id) => repos.properties.findById(id, tenantId),
      findMany: (pagination) => repos.properties.findMany(tenantId, pagination),
      create: (input, createdBy) =>
        repos.properties.create({ ...input, tenantId }, createdBy),
      update: (id, input, updatedBy) =>
        repos.properties.update(id, tenantId, input, updatedBy),
      delete: (id, deletedBy) => repos.properties.delete(id, tenantId, deletedBy),
    },
    units: {
      findById: (id) => repos.units.findById(id, tenantId),
      findByProperty: (propertyId, pagination) =>
        repos.units.findByProperty(propertyId, tenantId, pagination),
      findMany: (pagination) => repos.units.findMany(tenantId, pagination),
      create: (input, createdBy) =>
        repos.units.create({ ...input, tenantId }, createdBy),
      update: (id, input, updatedBy) =>
        repos.units.update(id, tenantId, input, updatedBy),
      delete: (id, deletedBy) => repos.units.delete(id, tenantId, deletedBy),
    },
    customers: {
      findById: (id) => repos.customers.findById(id, tenantId),
      findMany: (pagination, filters) =>
        repos.customers.findMany(tenantId, pagination, filters as any),
      create: (input, createdBy) =>
        repos.customers.create({ ...input, tenantId }, createdBy),
      update: (id, input, updatedBy) =>
        repos.customers.update(id, tenantId, input, updatedBy),
      delete: (id, deletedBy) => repos.customers.delete(id, tenantId, deletedBy),
    },
    leases: {
      findById: (id) => repos.leases.findById(id, tenantId),
      findMany: (pagination, filters) =>
        repos.leases.findMany(tenantId, pagination, filters as any),
      create: (input, createdBy) =>
        repos.leases.create({ ...input, tenantId }, createdBy),
      update: (id, input, updatedBy) =>
        repos.leases.update(id, tenantId, input, updatedBy),
      delete: (id, deletedBy) => repos.leases.delete(id, tenantId, deletedBy),
    },
    invoices: {
      findById: (id) => repos.invoices.findById(id, tenantId),
      findMany: (limit, offset) => repos.invoices.findMany(tenantId, limit, offset),
    },
    payments: {
      findById: (id) => repos.payments.findById(id, tenantId),
      findMany: (limit, offset) => repos.payments.findMany(tenantId, limit, offset),
    },
  };
}
