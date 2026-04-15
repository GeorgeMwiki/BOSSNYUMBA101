/**
 * Test-only shim for @bossnyumba/database
 *
 * This module provides the minimal exports required by the api-gateway
 * route modules (schemas, repositories) during vitest runs, where the
 * real @bossnyumba/database package source cannot be transformed due
 * to upstream build issues that are out-of-scope for this service.
 *
 * Only loaded when vitest is running (NODE_ENV === 'test'), via the
 * alias configured in vitest.config.ts. Production runtime uses the
 * real package compiled via tsup.
 */

// ---------------------------------------------------------------------------
// Drizzle-like table proxies
// ---------------------------------------------------------------------------

type TableProxy = Record<string, unknown> & {
  __shim: true;
  [key: string]: unknown;
};

function createTableProxy(name: string): TableProxy {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop: string) {
      if (prop === '__shim') return true;
      if (prop === 'name' || prop === '_') return name;
      if (prop in target) return target[prop];
      // Any column access returns another proxy column
      const col = { name: prop, table: name, __column: true };
      target[prop] = col;
      return col;
    },
  };
  return new Proxy({} as Record<string, unknown>, handler) as TableProxy;
}

// Known table names referenced in routes
export const tenants = createTableProxy('tenants');
export const users = createTableProxy('users');
export const roles = createTableProxy('roles');
export const userRoles = createTableProxy('userRoles');
export const properties = createTableProxy('properties');
export const units = createTableProxy('units');
export const customers = createTableProxy('customers');
export const leases = createTableProxy('leases');
export const invoices = createTableProxy('invoices');
export const payments = createTableProxy('payments');
export const workOrders = createTableProxy('workOrders');
export const vendors = createTableProxy('vendors');
export const messages = createTableProxy('messages');
export const conversations = createTableProxy('conversations');
export const inspections = createTableProxy('inspections');
export const schedulingSlots = createTableProxy('schedulingSlots');
export const documents = createTableProxy('documents');
export const complianceRecords = createTableProxy('complianceRecords');
export const auditLogs = createTableProxy('auditLogs');
export const outboxEvents = createTableProxy('outboxEvents');
export const auditEvents = createTableProxy('auditEvents');

// ---------------------------------------------------------------------------
// Repository base - returns empty results/paginated shells; mutations throw
// ---------------------------------------------------------------------------

function notAvailable(method: string): never {
  throw new Error(
    `[database-test-shim] ${method} is not implemented in test shim. ` +
      `Routes must use in-memory mock data when NODE_ENV=test.`,
  );
}

const EMPTY_PAGINATED = Object.freeze({
  items: [] as unknown[],
  total: 0,
  limit: 20,
  offset: 0,
  hasMore: false,
});

class ShimRepository {
  constructor(public db: unknown) {}

  async findById(): Promise<null> {
    return null;
  }
  async findMany(): Promise<typeof EMPTY_PAGINATED> {
    return EMPTY_PAGINATED;
  }
  async findAll(): Promise<unknown[]> {
    return [];
  }
  async findByProperty(): Promise<typeof EMPTY_PAGINATED> {
    return EMPTY_PAGINATED;
  }
  async findByCustomer(): Promise<typeof EMPTY_PAGINATED> {
    return EMPTY_PAGINATED;
  }
  async findByTenant(): Promise<typeof EMPTY_PAGINATED> {
    return EMPTY_PAGINATED;
  }
  async count(): Promise<number> {
    return 0;
  }
  async create(): Promise<unknown> {
    return notAvailable('create');
  }
  async update(): Promise<unknown> {
    return notAvailable('update');
  }
  async delete(): Promise<unknown> {
    return notAvailable('delete');
  }
  async softDelete(): Promise<unknown> {
    return notAvailable('softDelete');
  }
}

export class TenantRepository extends ShimRepository {}
export class UserRepository extends ShimRepository {}
export class PropertyRepository extends ShimRepository {}
export class UnitRepository extends ShimRepository {}
export class CustomerRepository extends ShimRepository {}
export class LeaseRepository extends ShimRepository {}
export class InvoiceRepository extends ShimRepository {}
export class PaymentRepository extends ShimRepository {}
export class TransactionRepository extends ShimRepository {}
export class WorkOrderRepository extends ShimRepository {}
export class VendorRepository extends ShimRepository {}
export class MessagingRepository extends ShimRepository {}
export class InspectionRepository extends ShimRepository {}
export class SchedulingRepository extends ShimRepository {}
export class UtilitiesRepository extends ShimRepository {}
export class ComplianceRepository extends ShimRepository {}
export class DocumentRepository extends ShimRepository {}

// ---------------------------------------------------------------------------
// Filter / result types (kept permissive for the test shim)
// ---------------------------------------------------------------------------

export type CustomerFilters = Record<string, unknown>;
export type LeaseFilters = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Pagination helpers (mirrors real base.repository surface)
// ---------------------------------------------------------------------------

export const DEFAULT_PAGINATION = { limit: 20, offset: 0 } as const;

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  limit = DEFAULT_PAGINATION.limit,
  offset = DEFAULT_PAGINATION.offset,
) {
  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

// ---------------------------------------------------------------------------
// Database client factory
// ---------------------------------------------------------------------------

export type DatabaseClient = {
  select: (...args: unknown[]) => unknown;
  insert: (...args: unknown[]) => unknown;
  update: (...args: unknown[]) => unknown;
  delete: (...args: unknown[]) => unknown;
  transaction: (...args: unknown[]) => unknown;
};

export function createDatabaseClient(_url: string): DatabaseClient {
  return {
    select: () => notAvailable('db.select'),
    insert: () => notAvailable('db.insert'),
    update: () => notAvailable('db.update'),
    delete: () => notAvailable('db.delete'),
    transaction: () => notAvailable('db.transaction'),
  };
}
