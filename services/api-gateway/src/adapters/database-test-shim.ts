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

// ---------------------------------------------------------------------------
// Repository base - all methods return empty / throw "not available in tests"
// ---------------------------------------------------------------------------

function notAvailable(method: string): never {
  throw new Error(
    `[database-test-shim] ${method} is not implemented in test shim. ` +
      `Routes should use in-memory mock data for NODE_ENV=test.`,
  );
}

class ShimRepository {
  constructor(public db: unknown) {}

  async findById(): Promise<null> {
    return null;
  }
  async findMany(): Promise<unknown[]> {
    return [];
  }
  async findAll(): Promise<unknown[]> {
    return [];
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
}

export class TenantRepository extends ShimRepository {}
export class UserRepository extends ShimRepository {}
export class PropertyRepository extends ShimRepository {}
export class UnitRepository extends ShimRepository {}
export class CustomerRepository extends ShimRepository {}
export class LeaseRepository extends ShimRepository {}
export class InvoiceRepository extends ShimRepository {}
export class PaymentRepository extends ShimRepository {}
export class WorkOrderRepository extends ShimRepository {}
export class VendorRepository extends ShimRepository {}
export class MessagingRepository extends ShimRepository {}
export class InspectionRepository extends ShimRepository {}
export class SchedulingRepository extends ShimRepository {}
export class ComplianceRepository extends ShimRepository {}
export class DocumentRepository extends ShimRepository {}

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
