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

/**
 * Database middleware
 * Injects database client and repositories into request context
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
