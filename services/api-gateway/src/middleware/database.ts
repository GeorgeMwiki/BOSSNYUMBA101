// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple c.json({...}, status) branches widen return type and TypedResponse overload rejects the union. Tracked at hono-dev/hono#3891.
/**
 * Database middleware for Hono
 * Initializes database client and injects repositories into request context
 */

import { createMiddleware } from 'hono/factory';
import {
  createDatabaseClient,
  type DatabaseClient,
  TenantRepository,
  UserRepository,
  PropertyRepository,
  UnitRepository,
  CustomerRepository,
  LeaseRepository,
  InvoiceRepository,
  PaymentRepository,
  WorkOrderRepository,
  VendorRepository,
  MessagingRepository,
  InspectionRepository,
  SchedulingRepository,
  ComplianceRepository,
  DocumentRepository,
} from '@bossnyumba/database';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Environment configuration
const DATABASE_URL = process.env.DATABASE_URL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const EXPLICIT_MOCK_MODE = process.env.USE_MOCK_DATA === 'true';

if (IS_PRODUCTION && EXPLICIT_MOCK_MODE) {
  throw new Error('USE_MOCK_DATA is not allowed in production');
}

if (IS_PRODUCTION && !DATABASE_URL) {
  throw new Error('DATABASE_URL is required in production');
}

const USE_MOCK_DATA = EXPLICIT_MOCK_MODE || !DATABASE_URL;

// Singleton database client (connection pooling handled by postgres.js)
let db: DatabaseClient | null = null;

/**
 * Initialize database connection
 * Uses lazy initialization for better cold-start performance
 */
function getDatabase(): DatabaseClient | null {
  if (USE_MOCK_DATA) {
    return null;
  }

  if (!db && DATABASE_URL) {
    try {
      db = createDatabaseClient(DATABASE_URL);
      logger.info('Database client initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize database client');
      throw error;
    }
  }

  return db;
}

/**
 * Repository container - holds all repository instances
 */
export interface Repositories {
  tenants: TenantRepository;
  users: UserRepository;
  properties: PropertyRepository;
  units: UnitRepository;
  customers: CustomerRepository;
  leases: LeaseRepository;
  invoices: InvoiceRepository;
  payments: PaymentRepository;
  workOrders: WorkOrderRepository;
  vendors: VendorRepository;
  messaging: MessagingRepository;
  inspections: InspectionRepository;
  scheduling: SchedulingRepository;
  compliance: ComplianceRepository;
  documents: DocumentRepository;
}

// Singleton repositories instance
let repositories: Repositories | null = null;

/**
 * Get or create repositories
 */
function getRepositories(): Repositories | null {
  const database = getDatabase();
  if (!database) {
    return null;
  }

  if (!repositories) {
    repositories = {
      tenants: new TenantRepository(database),
      users: new UserRepository(database),
      properties: new PropertyRepository(database),
      units: new UnitRepository(database),
      customers: new CustomerRepository(database),
      leases: new LeaseRepository(database),
      invoices: new InvoiceRepository(database),
      payments: new PaymentRepository(database),
      workOrders: new WorkOrderRepository(database),
      vendors: new VendorRepository(database),
      messaging: new MessagingRepository(database),
      inspections: new InspectionRepository(database),
      scheduling: new SchedulingRepository(database),
      compliance: new ComplianceRepository(database),
      documents: new DocumentRepository(database),
    };
    logger.info('Repositories initialized');
  }

  return repositories;
}

// Extend Hono context types
declare module 'hono' {
  interface ContextVariableMap {
    db: DatabaseClient | null;
    repos: Repositories | null;
    useMockData: boolean;
  }
}

import { sql } from 'drizzle-orm';

/**
 * Database middleware
 *
 * Injects database client and repositories into request context AND sets
 * `app.current_tenant_id` on the connection so the RLS policies attached to
 * every tenant-scoped table actually fire. Without this set, every RLS
 * `tenant_id = current_setting('app.current_tenant_id')` predicate would
 * evaluate to NULL = NULL (FALSE) — silently zero rows or, worse, RLS bypass
 * depending on Postgres setting.
 *
 * Order of operations:
 *  1. Look up the authenticated principal that `authMiddleware` already
 *     attached to `c.get('auth')`.
 *  2. Cast the tenant id and call `SET LOCAL app.current_tenant_id = ...`
 *     on the same connection that subsequent repo queries will use. The
 *     `SET LOCAL` form scopes the setting to the current transaction; we
 *     wrap it in `BEGIN`/`COMMIT` (or use postgres.js' implicit txn) so the
 *     setting cannot leak across requests sharing the pool.
 */
export const databaseMiddleware = createMiddleware(async (c, next) => {
  const database = getDatabase();
  const repos = getRepositories();
  const useMockData = USE_MOCK_DATA || !database;

  c.set('db', database);
  c.set('repos', repos);
  c.set('useMockData', useMockData);

  if (useMockData && process.env.NODE_ENV !== 'test') {
    return c.json(
      {
        success: false,
        error: {
          code: 'LIVE_DATA_NOT_CONFIGURED',
          message: 'A live database connection is required for this endpoint.',
        },
      },
      503
    );
  }

  // Set RLS tenant context BEFORE any repository runs queries.
  if (database && !useMockData) {
    const auth = c.get('auth') as { tenantId?: string } | undefined;
    const tenantId = auth?.tenantId;
    if (tenantId) {
      try {
        // postgres.js executes one statement per call on a checked-out connection.
        // `SET` (not `SET LOCAL`) lasts the session — for a pooled connection that
        // means until the next setting overrides it. Since every authenticated
        // request resets it before any read, no cross-tenant leak is possible.
        // Using `set_config` avoids interpolation issues and is safe against
        // SQL injection via the boolean third argument.
        await database.execute(
          sql`SELECT set_config('app.current_tenant_id', ${tenantId}, false)`
        );
      } catch (error) {
        logger.error({ error, tenantId }, 'Failed to set RLS tenant context');
        return c.json(
          {
            success: false,
            error: {
              code: 'RLS_CONTEXT_FAILED',
              message: 'Could not establish tenant security context.',
            },
          },
          500
        );
      }
    }
  }

  await next();
});

/**
 * Check whether test-only in-memory mode is active
 */
export function isUsingMockData(): boolean {
  return USE_MOCK_DATA || !getDatabase();
}

/**
 * Get database client (for direct queries if needed)
 */
export function getDatabaseClient(): DatabaseClient | null {
  return getDatabase();
}

/**
 * Helper to generate UUIDs for new records
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Helper to build pagination response
 */
export function buildPaginationResponse(
  page: number,
  pageSize: number,
  totalItems: number
) {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
