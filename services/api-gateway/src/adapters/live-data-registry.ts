// @ts-nocheck
/**
 * Live Data Registry
 *
 * Maps logical entity names (used by the generic live-data routers) to
 * pagination-aware list functions backed by real repositories in
 * `@bossnyumba/database`.
 *
 * Each entry accepts a paginated/filter/sort request and returns a
 * tenant-scoped `PaginatedResult` shape. This registry is used by
 * `createLiveDataExpressRouter` and `createProtectedLiveDataRouter` so that
 * feature modules that have not yet been wired can still serve real listings
 * (read-only) until dedicated routes are implemented.
 */

import type { Repositories } from '../middleware/database';

export interface ListRequest {
  tenantId: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters: Record<string, string | undefined>;
}

export interface ListResponse<T = any> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export type ListHandler = (
  repos: Repositories,
  req: ListRequest
) => Promise<ListResponse>;

function buildPagination(page: number, pageSize: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    totalItems: total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function offsetOf(page: number, pageSize: number): number {
  return Math.max(0, (page - 1) * pageSize);
}

/**
 * Canonical list handlers keyed by entity name. Keys are case-insensitive
 * when looked up via `resolveListHandler`.
 */
const HANDLERS: Record<string, ListHandler> = {
  tenants: async (repos, req) => {
    const result = await repos.tenants.findMany({
      limit: req.pageSize,
      offset: offsetOf(req.page, req.pageSize),
    });
    return {
      items: result.items,
      pagination: buildPagination(req.page, req.pageSize, result.total),
    };
  },

  properties: async (repos, req) => {
    const result = await repos.properties.findMany(req.tenantId, {
      limit: req.pageSize,
      offset: offsetOf(req.page, req.pageSize),
    });
    return {
      items: result.items,
      pagination: buildPagination(req.page, req.pageSize, result.total),
    };
  },

  units: async (repos, req) => {
    const result = req.filters.propertyId
      ? await repos.units.findByProperty(req.filters.propertyId, req.tenantId, {
          limit: req.pageSize,
          offset: offsetOf(req.page, req.pageSize),
        })
      : await repos.units.findMany(req.tenantId, {
          limit: req.pageSize,
          offset: offsetOf(req.page, req.pageSize),
        });
    return {
      items: result.items,
      pagination: buildPagination(req.page, req.pageSize, result.total),
    };
  },

  customers: async (repos, req) => {
    const result = await repos.customers.findMany(
      req.tenantId,
      { limit: req.pageSize, offset: offsetOf(req.page, req.pageSize) },
      {
        status: req.filters.status,
        search: req.search,
      }
    );
    return {
      items: result.items,
      pagination: buildPagination(req.page, req.pageSize, result.total),
    };
  },

  leases: async (repos, req) => {
    const result = await repos.leases.findMany(
      req.tenantId,
      { limit: req.pageSize, offset: offsetOf(req.page, req.pageSize) },
      {
        status: req.filters.status,
        propertyId: req.filters.propertyId as any,
        unitId: req.filters.unitId as any,
        customerId: req.filters.customerId as any,
      }
    );
    return {
      items: result.items,
      pagination: buildPagination(req.page, req.pageSize, result.total),
    };
  },

  invoices: async (repos, req) => {
    const result = await repos.invoices.findMany(
      req.tenantId,
      req.pageSize,
      offsetOf(req.page, req.pageSize)
    );
    return {
      items: result.items,
      pagination: buildPagination(req.page, req.pageSize, result.total),
    };
  },

  payments: async (repos, req) => {
    const result = await repos.payments.findMany(
      req.tenantId,
      req.pageSize,
      offsetOf(req.page, req.pageSize)
    );
    return {
      items: result.items,
      pagination: buildPagination(req.page, req.pageSize, result.total),
    };
  },

  users: async (repos, req) => {
    const result = await repos.users.findMany(
      req.tenantId,
      req.pageSize,
      offsetOf(req.page, req.pageSize),
      { status: req.filters.status, search: req.search }
    );
    return {
      items: result.items,
      pagination: buildPagination(req.page, req.pageSize, result.total),
    };
  },
};

/**
 * Resolve a list handler by looking up the supplied feature label.
 * The feature string is tokenised (splits on spaces and case-insensitive),
 * and the first token that matches a known entity wins.
 */
export function resolveListHandler(feature: string): ListHandler | null {
  const normalized = feature.toLowerCase();

  for (const key of Object.keys(HANDLERS)) {
    if (normalized.includes(key)) {
      return HANDLERS[key];
    }
  }

  return null;
}

export function listHandlerFor(entity: string): ListHandler | null {
  const key = entity.toLowerCase();
  return HANDLERS[key] ?? null;
}

export function knownEntities(): string[] {
  return Object.keys(HANDLERS);
}
