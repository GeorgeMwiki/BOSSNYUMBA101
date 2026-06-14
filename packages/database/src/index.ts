/**
 * BOSSNYUMBA Database Package
 * Database client, schemas, and repositories
 */

export {
  createDatabaseClient,
  createReadonlyDatabaseClient,
  type DatabaseClient,
} from './client.js';
export * from './schemas/index.js';
export * from './repositories/index.js';
export * from './services/index.js';
// RLS Option A — per-request tenant-context binding. `withTenantContext`
// wraps a callback in a transaction with `SET LOCAL app.current_tenant_id`
// (+ `app.is_service_role`) bound, so the RLS policies on every
// tenant-scoped table fire. The api-gateway `databaseMiddleware` uses this
// to give each request tenant-scoped repos; crons/reconciliation use
// `withServiceRoleContext` for legitimate cross-tenant access.
export {
  withTenantContext,
  withServiceRoleContext,
  withWorkerTenantContext,
  withWorkerServiceRoleContext,
  type WithTenantContextOpts,
  type WorkerExecLike,
} from './rls/index.js';
export * from './security/data-classification.js';
// Phase D / A2b-1 — field-level encryption-at-rest composition entry
// point. Composition roots call `selectEncryptionPort(process.env)` and
// pass the returned port into every repository constructor.
export {
  selectEncryptionPort,
  selectEncryptionPortForTenant,
  encryptRow,
  decryptRow,
  decryptRows,
  getTenantRegion,
  ENCRYPTED_BLOB_PREFIX,
  EncryptionAuthenticationError,
  EncryptionKeyUnavailableError,
  type EncryptionPort,
  type FieldEncryptionAuditSink,
  type GetTenantRegionDb,
  type TenantRegionResolver,
} from './security/encryption/index.js';
export {
  createFieldEncryptionAuditService,
  type FieldEncryptionAuditService,
} from './services/field-encryption-audit.service.js';
// Phase D / A2b-1 — master-key rotation soak window guard.
export {
  recordKeyRotationStart,
  assertSafeToDropPreviousKey,
  loadMasterKeySnapshotWithSoakGuard,
  ROTATION_SOAK_WINDOW_MS,
  type RotationGuardDeps,
} from './security/encryption/key-rotation-soak-window.js';
