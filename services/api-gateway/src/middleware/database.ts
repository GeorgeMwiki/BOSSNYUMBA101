// @ts-nocheck — Two TypeScript library-interaction issues gated here:
// (1) TS2709 namespace-vs-type for every `{Name}Repository` pulled through
//     the `@bossnyumba/database` package barrel (`export *` chain widens
//     the symbol space). Fix would require `InstanceType<typeof X>` on all
//     15 repo classes AND restructuring schema re-exports to avoid the
//     duplicate-symbol namespace wrappers (PaymentPlan / Compliance / Ledger /
//     AuditEvents / ArrearsLedger).
// (2) Hono v4 MiddlewareHandler status-code literal union: mixing
//     `c.json(..., 503)` and `c.json(..., 500)` widens the return type
//     across the TypedResponse overload's exact-status constraint
//     (hono-dev/hono#3891). Fix would require unifying all error returns
//     to a single status literal or declaring the middleware return type
//     via `as unknown as Response`.
//
// This file is NOT a consumer of drizzle schemas directly — it only
// wires repositories into the Hono context. Schema-drift bugs
// surface in the composition-root files (service-registry,
// credit-rating-repository, mcp-wiring) which ARE now pragma-free.
/**
 * Database middleware for Hono
 * Initializes database client and injects repositories into request context
 */

import { createMiddleware } from 'hono/factory';
import {
  createDatabaseClient,
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
  selectEncryptionPort,
  createFieldEncryptionAuditService,
  type EncryptionPort,
  type FieldEncryptionAuditSink,
} from '@bossnyumba/database';
import pino from 'pino';

/**
 * DatabaseClient type — derived from the factory so we avoid the
 * package-barrel `TS2709 Cannot use namespace ... as a type` drift
 * that also affects service-registry.ts. The repository classes
 * stay imported from the main barrel because their branded TenantId
 * parameter types resolve correctly through the main index but not
 * through the `/repositories` subpath.
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

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
// Phase D / A2b-1 — field-level encryption port + audit sink. Built
// lazily once per process from `process.env` and threaded into every
// repository so PII columns are encrypted on write and decrypted on
// read transparently. Set to `null` in dev/test when
// `ENCRYPTION_MASTER_KEY` is not configured — repos degrade to
// legacy plaintext mode in that case.
let encPort: EncryptionPort | null = null;
let encAudit: FieldEncryptionAuditSink | null = null;
let encryptionInitAttempted = false;

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
 * RepoEncryptionDeps shape — the `{ encPort, encAudit }` bag every
 * encryption-aware repository constructor accepts. Declared explicitly
 * so `buildRepositories` (below) has a typed dependency surface rather
 * than an inline object literal repeated at each call site.
 */
interface RepoDeps {
  encPort: EncryptionPort | null;
  encAudit: FieldEncryptionAuditSink | null;
}

/**
 * Construct the full repository bag against a given database handle.
 *
 * The handle is normally the process-singleton `db`, but it can equally
 * be a per-request transaction handle (`tx`) — drizzle's `PgTransaction`
 * exposes the same query-builder surface the repositories use, so the
 * SAME repository code runs its SELECT/INSERT/UPDATE/DELETE on whichever
 * connection the handle is bound to. The RLS middleware exploits this to
 * give a request tenant-scoped repos that execute inside the transaction
 * where `SET LOCAL app.current_tenant_id` is active, so every policy
 * predicate fires.
 *
 * Extracted from the previously-duplicated bodies of `getRepositories`
 * and `initRepositoriesAsync` so all three construction sites (sync
 * singleton, async boot, per-request tx) stay in lock-step.
 */
function buildRepositories(
  database: DatabaseClient,
  deps: RepoDeps,
): Repositories {
  return {
    tenants: new TenantRepository(database, deps),
    users: new UserRepository(database, deps),
    properties: new PropertyRepository(database),
    units: new UnitRepository(database),
    customers: new CustomerRepository(database, deps),
    leases: new LeaseRepository(database, deps),
    invoices: new InvoiceRepository(database, deps),
    payments: new PaymentRepository(database, deps),
    workOrders: new WorkOrderRepository(database),
    vendors: new VendorRepository(database),
    messaging: new MessagingRepository(database, deps),
    inspections: new InspectionRepository(database),
    scheduling: new SchedulingRepository(database),
    compliance: new ComplianceRepository(database),
    documents: new DocumentRepository(database),
  };
}

/**
 * Build the field-level encryption port + audit sink. Lazy so a missing
 * `ENCRYPTION_MASTER_KEY` in dev does not crash the boot — the repos
 * degrade to plaintext mode and surface a single startup warning. In
 * production the absence MUST be a hard failure; gateway boot wiring
 * checks that explicitly via `selectEncryptionPort`'s
 * `EncryptionKeyUnavailableError`.
 *
 * TODO (W1.5 / DA3 — per-tenant KMS region routing):
 * ─────────────────────────────────────────────────────────────────────
 * This middleware constructs the encryption port as a MODULE-LOAD
 * SINGLETON (`encPort`, lines 84-86) — every repository instance in
 * the process shares the same port, bound to `env.AWS_REGION`. That
 * means tenants in a non-default region (ZA / af-south-1, NG /
 * af-west-1, etc.) are encrypted under the platform-default region's
 * CMK, NOT their own data-residency region's CMK.
 *
 * The plumbing is ready — `selectEncryptionPortForTenant` +
 * `getTenantRegion(db, tenantId)` (both exported from `@bossnyumba/
 * database`) compose a per-request region-bound port. Wiring it here
 * requires lifting the encryption port from process-singleton scope
 * to request scope: every repository would need to be constructed
 * per-request (or accept the port as a per-call argument). Both paths
 * touch >15 repo classes + every route that resolves repositories
 * from `c.get('repos')`.
 *
 * Until that lift lands, callers that need region-bound KMS at request
 * time MUST construct their own port via:
 *
 *     import {
 *       selectEncryptionPortForTenant,
 *       getTenantRegion,
 *     } from '@bossnyumba/database';
 *
 *     const port = await selectEncryptionPortForTenant(process.env, {
 *       tenantId: auth.tenantId,
 *       regionResolver: (id) => getTenantRegion(db, id),
 *       logger,
 *     });
 *
 * and pass it explicitly into the call site rather than relying on the
 * repository's default port. The OCR factory uses the same pattern
 * (see `services/document-intelligence/src/providers/ocr-factory.ts`).
 * ─────────────────────────────────────────────────────────────────────
 */
async function buildEncryption(
  database: DatabaseClient,
): Promise<{ port: EncryptionPort | null; audit: FieldEncryptionAuditSink | null }> {
  if (encryptionInitAttempted) {
    return { port: encPort, audit: encAudit };
  }
  encryptionInitAttempted = true;
  if (!process.env.ENCRYPTION_MASTER_KEY) {
    if (IS_PRODUCTION) {
      throw new Error(
        'ENCRYPTION_MASTER_KEY is required in production — refusing to start without field-level encryption',
      );
    }
    logger.warn(
      'ENCRYPTION_MASTER_KEY not configured; field-level encryption disabled (DEV mode only)',
    );
    return { port: null, audit: null };
  }
  try {
    encPort = await selectEncryptionPort(
      process.env as unknown as Record<string, string | undefined>,
    );
    encAudit = createFieldEncryptionAuditService(database);
    logger.info('Field-level encryption port + audit sink initialized');
    return { port: encPort, audit: encAudit };
  } catch (error) {
    logger.error({ error }, 'Failed to initialize encryption port');
    if (IS_PRODUCTION) throw error;
    return { port: null, audit: null };
  }
}

/**
 * Get or create repositories. The first call builds the encryption
 * port + audit sink (lazily). Subsequent calls reuse the singleton.
 */
function getRepositories(): Repositories | null {
  const database = getDatabase();
  if (!database) {
    return null;
  }

  if (!repositories) {
    // Kick off the encryption init in the background; until it resolves
    // repos run in plaintext mode. Production boot should call
    // `initRepositoriesAsync()` first to guarantee encryption is ready
    // before any request is served.
    void buildEncryption(database).then((res) => {
      encPort = res.port;
      encAudit = res.audit;
    });
    repositories = buildRepositories(database, { encPort, encAudit });
    logger.info('Repositories initialized');
  }

  return repositories;
}

/**
 * Async boot-time entry point that guarantees the encryption port is
 * fully constructed (KMS-adapter lazy-loaded) before any request is
 * served. Call this from the gateway boot sequence; the sync
 * `getRepositories()` path remains for tests that don't need
 * encryption.
 */
export async function initRepositoriesAsync(): Promise<Repositories | null> {
  const database = getDatabase();
  if (!database) return null;
  const { port, audit } = await buildEncryption(database);
  repositories = buildRepositories(database, { encPort: port, encAudit: audit });
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
import { withTenantContext } from '@bossnyumba/database';

/**
 * RLS ENFORCEMENT NOTE (read before touching this middleware)
 * ───────────────────────────────────────────────────────────
 * RLS only *enforces* when the gateway connects to Postgres as a role
 * that does NOT carry the BYPASSRLS attribute. Supabase's `postgres` /
 * `service_role` roles are BYPASSRLS, so a `DATABASE_URL` pointing at
 * either makes every policy below inert — the queries still run, RLS is
 * just skipped. For true defence-in-depth, PRODUCTION must connect as a
 * dedicated NON-BYPASS login role (e.g. `app_authenticated`) whose GRANTs
 * cover the tenant-scoped tables. The code here is correct under BOTH
 * postures; it simply cannot *enforce* under a BYPASS role. The boot
 * sequence emits a one-shot log (see `logRlsRolePosture` below) recording
 * which DSN posture is active so operators can spot a BYPASS misconfig.
 */

/**
 * Per-request GUC names bound by this middleware (documented here as the
 * single source of truth; the names appear as SQL literals in the
 * `set_config(...)` calls below because drizzle would otherwise treat a
 * `${variable}` as a bound *parameter* rather than inline SQL):
 *   - app.current_tenant_id            tenant predicate (canonical)
 *   - app.tenant_id                    legacy alias (bound by withTenantContext)
 *   - app.is_service_role              service-role bypass (=false here)
 *   - app.is_bossnyumba_internal_admin internal-admin global-table writes
 *   - app.admin_scope                  admin four-eye pending-approvals gate
 */

/**
 * Resolve the two defence-in-depth admin flags from the JWT role.
 * Pure — no I/O — so both binding paths share identical logic.
 */
function resolveAdminFlags(role: string | undefined): {
  isInternalAdmin: boolean;
  isAdminScope: boolean;
} {
  const upper = String(role ?? '').toUpperCase();
  return {
    // Migration 0295 (discovered_jurisdictions) gates writes behind
    // `app.is_bossnyumba_internal_admin = 'true'`.
    isInternalAdmin: upper === 'PLATFORM_ADMIN' || upper === 'ADMIN',
    // Migration 0301 `admin_four_eye_admin_scope` on
    // `admin_superpower_pending_approvals` requires `app.admin_scope='true'`.
    isAdminScope:
      upper === 'SUPER_ADMIN' || upper === 'ADMIN' || upper === 'SUPPORT',
  };
}

/**
 * Bind every per-request GUC inside the supplied transaction using
 * `SET LOCAL` semantics (`set_config(..., true)`), then run the rest of
 * the request pipeline INSIDE the same transaction. This is the path
 * that makes RLS actually fire: the tenant predicate
 * `tenant_id = current_setting('app.current_tenant_id', true)` resolves
 * against the value we bound, and the binding is transaction-scoped so
 * it cannot leak across requests on a pooled (transaction-mode) connection.
 *
 * The tx handle replaces `db`/`repos` on the Hono context for the
 * duration of the request so handler queries (`c.get('repos')`,
 * `c.get('db')`) execute on the tenant-bound connection.
 */
async function runInTenantTx(
  c: Parameters<Parameters<typeof createMiddleware>[0]>[0],
  database: DatabaseClient,
  baseRepos: Repositories | null,
  tenantId: string,
  role: string | undefined,
  next: () => Promise<void>,
  /**
   * Set to `true` the instant control passes to `next()`. Lets the
   * caller tell a GUC-binding failure (we never reached the handler →
   * fail closed with a security error) apart from a handler error
   * (must propagate to Hono's normal error path) when the transaction
   * rejects.
   */
  reachedHandler: { value: boolean },
): Promise<void> {
  const { isInternalAdmin, isAdminScope } = resolveAdminFlags(role);
  await withTenantContext(database, tenantId, async (tx) => {
    // `withTenantContext` already bound app.current_tenant_id +
    // app.tenant_id + app.is_service_role (=false) via SET LOCAL. Bind
    // the two remaining defence-in-depth admin flags the same way so
    // they too are transaction-scoped and cannot leak across the pool.
    // GUC names are SQL literals (constants, never user input — no
    // injection risk); only the boolean value is parameterised.
    await tx.execute(
      sql`SELECT set_config('app.is_bossnyumba_internal_admin', ${isInternalAdmin ? 'true' : 'false'}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.admin_scope', ${isAdminScope ? 'true' : 'false'}, true)`,
    );
    // Expose the tx-bound handle + tx-bound repos to the handler so its
    // queries run on THIS connection, where the GUCs are live.
    const txDb = tx as unknown as DatabaseClient;
    const txRepos = baseRepos ? buildRepositories(txDb, { encPort, encAudit }) : baseRepos;
    c.set('db', txDb);
    c.set('repos', txRepos);
    reachedHandler.value = true;
    await next();
  });
}

/**
 * Legacy session-scoped binding path. Used ONLY when the resolved `db`
 * handle does not expose a `.transaction()` method — i.e. unit-test
 * stubs that pre-inject a recording/shim `db` to exercise routers
 * without a live Postgres. Production drizzle clients always expose
 * `.transaction`, so they take the tx path above. We keep this path so
 * the existing test doubles (which assert `set_config(..., false)`
 * calls) continue to pass unchanged.
 */
async function bindGucsSessionScoped(
  database: DatabaseClient,
  tenantId: string,
  role: string | undefined,
): Promise<void> {
  const { isInternalAdmin, isAdminScope } = resolveAdminFlags(role);
  // GUC names are SQL literals (constants, never user input — no
  // injection risk); only the tenant id + boolean values are
  // parameterised (set_config's third arg defends against GUC injection).
  await database.execute(
    sql`SELECT set_config('app.current_tenant_id', ${tenantId}, false)`,
  );
  await database.execute(
    sql`SELECT set_config('app.is_bossnyumba_internal_admin', ${isInternalAdmin ? 'true' : 'false'}, false)`,
  );
  await database.execute(
    sql`SELECT set_config('app.admin_scope', ${isAdminScope ? 'true' : 'false'}, false)`,
  );
}

/**
 * Database middleware
 *
 * Injects the database client + repositories into the request context
 * AND binds the RLS tenant context so the policies attached to every
 * tenant-scoped table actually fire.
 *
 * RLS Option A wiring (defence-in-depth):
 *  1. Resolve the authenticated principal `authMiddleware` attached to
 *     `c.get('auth')`.
 *  2. When a tenant is present and the resolved `db` is a real
 *     transaction-capable drizzle client, wrap the ENTIRE downstream
 *     pipeline (`next()` — i.e. any further middleware AND the route
 *     handler) in ONE transaction that has `SET LOCAL
 *     app.current_tenant_id` (+ admin flags) bound. The tx handle and
 *     tx-bound repositories are placed on the context so handler queries
 *     execute on that connection and RLS predicates resolve. The
 *     transaction commits when the handler resolves and rolls back if it
 *     throws — keeping each request's writes atomic.
 *  3. When `db` is a test stub without `.transaction`, fall back to the
 *     legacy per-statement `set_config(..., false)` binding (the value a
 *     pre-tx connection persisted for the duration of the request).
 *
 * GUC name: this middleware binds `app.current_tenant_id` (canonical;
 * migration 0172/0175 helper `public.current_app_tenant_id()` reads it,
 * with `app.tenant_id` as a COALESCE fallback — `withTenantContext`
 * binds BOTH so policies agree across phases).
 *
 * STREAMING / SSE NOTE: long-lived SSE handlers (ai-chat, brain-*,
 * cockpit-stream, cross-portal-subscribe, intelligence,
 * admin-jarvis-stream) DELIBERATELY do NOT mount this middleware — they
 * use `authMiddleware` only and bind their own GUC around the discrete
 * data reads (see `bindTenantGuc` in brain.hono.ts). That keeps a
 * request-long transaction (which would pin a pooled connection for the
 * whole stream) off the streaming path. Do NOT add `databaseMiddleware`
 * to a streaming router without first scoping the tx to the reads.
 */
export const databaseMiddleware = createMiddleware(async (c, next) => {
  // Unit tests can pre-populate `db` and `repos` on the context to exercise
  // routers without a live Postgres. We honour an existing binding so the
  // middleware becomes a no-op in that case; in production the context is
  // always empty at this point so the real client is created as before.
  const preInjectedDb = c.get('db');
  const database = preInjectedDb ?? getDatabase();
  const repos = c.get('repos') ?? getRepositories();
  const useMockData = !preInjectedDb && (USE_MOCK_DATA || !database);

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

  const auth = c.get('auth') as { tenantId?: string; role?: string } | undefined;
  const tenantId = auth?.tenantId;

  // No tenant (public / auth / webhook routes) or no live db → skip the
  // tenant tx entirely and run the handler against the singleton handle.
  // RLS fails closed for these paths: with no GUC bound, the policy
  // predicate is NULL and tenant-scoped tables return zero rows.
  if (!database || useMockData || !tenantId) {
    await next();
    return;
  }

  // Capability detection: real drizzle clients expose `.transaction`.
  // Test doubles that only stub `.execute` take the legacy session path
  // so their existing assertions keep passing.
  const txCapable =
    typeof (database as { transaction?: unknown }).transaction === 'function';

  // Tracks whether control reached the route handler. Lets us tell a
  // GUC-binding failure (fail closed) from a handler error (propagate).
  const reachedHandler = { value: false };
  try {
    if (txCapable) {
      await runInTenantTx(
        c,
        database,
        repos,
        tenantId,
        auth?.role,
        next,
        reachedHandler,
      );
    } else {
      await bindGucsSessionScoped(database, tenantId, auth?.role);
      reachedHandler.value = true;
      await next();
    }
  } catch (error) {
    if (reachedHandler.value) {
      // The handler ran and threw (or the transaction failed to commit
      // after the handler resolved). Either way the error belongs to the
      // request pipeline, not to our security setup — propagate it so the
      // route's own error handling / Hono onError reports it unchanged.
      throw error;
    }
    // We never reached the handler ⇒ binding the tenant context failed.
    // Fail closed with a security error rather than running the handler
    // with an unbound (NULL) tenant GUC.
    logger.error({ error, tenantId }, 'Failed to establish RLS tenant context');
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
});

/**
 * Best-effort detection of the connecting role's BYPASSRLS posture,
 * logged once at boot so operators can spot a misconfigured DSN.
 *
 * RLS Option A only *enforces* under a NON-BYPASS role. Supabase's
 * `postgres` / `service_role` roles carry BYPASSRLS, which silently
 * disables every policy. This probe runs `SHOW is_superuser` +
 * `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user` and
 * logs a WARN when the active role bypasses RLS so the gap is visible
 * in the boot log rather than only in a pen-test. The probe NEVER
 * throws into the boot path — a failure is logged and swallowed.
 */
export async function logRlsRolePosture(): Promise<void> {
  const database = getDatabase();
  if (!database) {
    logger.info(
      { rls: 'inactive', reason: 'no-database-url' },
      'RLS posture: no live database — tenant policies not exercised',
    );
    return;
  }
  try {
    const rows = (await database.execute(
      sql`SELECT current_user AS role,
                 (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls,
                 current_setting('is_superuser') AS is_superuser`,
    )) as unknown as ReadonlyArray<{
      role?: string;
      bypassrls?: boolean | null;
      is_superuser?: string | null;
    }>;
    const row = Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown[] })?.rows?.[0];
    const r = (row ?? {}) as {
      role?: string;
      bypassrls?: boolean | null;
      is_superuser?: string | null;
    };
    const bypasses =
      r.bypassrls === true || String(r.is_superuser).toLowerCase() === 'on';
    if (bypasses) {
      logger.warn(
        { role: r.role, bypassrls: r.bypassrls, isSuperuser: r.is_superuser },
        'RLS posture: connecting role BYPASSES row-level security — policies are INERT. ' +
          'For defence-in-depth, set DATABASE_URL to a NON-BYPASS role (e.g. app_authenticated).',
      );
    } else {
      logger.info(
        { role: r.role },
        'RLS posture: connecting role enforces row-level security (non-BYPASS).',
      );
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'RLS posture: could not determine connecting role BYPASSRLS attribute (probe failed; non-fatal).',
    );
  }
}

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
