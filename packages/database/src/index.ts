/**
 * BOSSNYUMBA Database Package
 * Database client, schemas, and repositories
 */

export { createDatabaseClient, type DatabaseClient } from './client.js';
export * from './schemas/index.js';
export * from './repositories/index.js';
export * from './services/index.js';
export * from './security/data-classification.js';
// Phase D / A2b-1 — field-level encryption-at-rest composition entry
// point. Composition roots call `selectEncryptionPort(process.env)` and
// pass the returned port into every repository constructor.
export {
  selectEncryptionPort,
  encryptRow,
  decryptRow,
  decryptRows,
  ENCRYPTED_BLOB_PREFIX,
  EncryptionAuthenticationError,
  EncryptionKeyUnavailableError,
  type EncryptionPort,
  type FieldEncryptionAuditSink,
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
