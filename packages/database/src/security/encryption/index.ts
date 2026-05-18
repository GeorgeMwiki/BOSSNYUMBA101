/**
 * Field-level encryption-at-rest — Phase D D1 barrel.
 *
 * Closes the audit-surfaced gap: `data-classification.ts` DECLARES
 * `encryptAtRest: true` on ~30 PII columns but no app-layer
 * middleware actually encrypts/decrypts them. This module is the
 * middleware.
 *
 * Composition entry point: `selectEncryptionPort(env)` — picks the
 * KMS adapter when `AWS_KMS_KEY_ID` is set (with `AWS_REGION`), the
 * libsodium adapter otherwise. Both adapters require
 * `ENCRYPTION_MASTER_KEY`; absent that they throw
 * `EncryptionKeyUnavailableError` at construction time so misconfigured
 * services fail loudly at boot rather than silently dropping PII in
 * plaintext.
 *
 * See `Docs/SECURITY/ENCRYPTION_AT_REST.md` for the operator runbook
 * (env vars, KMS configuration, rotation procedure).
 */

export {
  ENCRYPTED_BLOB_PREFIX,
  EncryptionAuthenticationError,
  EncryptionKeyUnavailableError,
  deserializeBlob,
  serializeBlob,
  type DecryptArgs,
  type EncryptArgs,
  type EncryptedBlob,
  type EncryptionAlgorithm,
  type EncryptionPort,
  type RotateArgs,
} from './encryption-port.js';

export {
  DEK_LENGTH_BYTES,
  deriveDek,
  loadMasterKeySnapshot,
  type EncryptionEnv,
  type MasterKeySnapshot,
} from './tenant-key-derivation.js';

export {
  createLibsodiumAdapter,
  type LibsodiumAdapterDeps,
} from './libsodium-adapter.js';

export {
  createKmsAdapter,
  type KmsAdapterConfig,
  type KmsClientLike,
  type KmsLogger,
} from './kms-adapter.js';

export {
  __resetTableCacheForTests,
  decryptRow,
  decryptRows,
  encryptRow,
  toSnakeCase,
  type DecryptRowArgs,
  type EncryptRowArgs,
  type FieldEncryptionAuditSink,
} from './drizzle-encryption-middleware.js';

// ─────────────────────────────────────────────────────────────────────
// selectEncryptionPort — composition entry point
// ─────────────────────────────────────────────────────────────────────

import {
  createKmsAdapter,
  type KmsLogger,
} from './kms-adapter.js';
import { createLibsodiumAdapter } from './libsodium-adapter.js';
import type { EncryptionPort } from './encryption-port.js';
import {
  loadMasterKeySnapshot,
  type EncryptionEnv,
} from './tenant-key-derivation.js';

export interface SelectEncryptionPortEnv extends EncryptionEnv {
  readonly AWS_KMS_KEY_ID?: string;
  readonly AWS_REGION?: string;
}

export interface SelectEncryptionPortOptions {
  readonly logger?: KmsLogger;
}

/**
 * Pick the encryption adapter based on the supplied environment.
 *
 *   - When `AWS_KMS_KEY_ID` AND `AWS_REGION` are set → KMS adapter
 *     (envelope encryption; CMK rotation handled by AWS).
 *   - Otherwise → libsodium adapter (XChaCha20-Poly1305 when the
 *     dependency is installed, AES-256-GCM Node built-in fallback
 *     otherwise).
 *
 * `ENCRYPTION_MASTER_KEY` is required in both branches — the KMS
 * adapter also needs it for the fallback path when `@aws-sdk/client-
 * kms` cannot be loaded at runtime.
 */
export async function selectEncryptionPort(
  env: SelectEncryptionPortEnv,
  options: SelectEncryptionPortOptions = {},
): Promise<EncryptionPort> {
  const snapshot = loadMasterKeySnapshot(env);
  const wantsKms = !!env.AWS_KMS_KEY_ID && !!env.AWS_REGION;
  if (wantsKms) {
    return createKmsAdapter({
      kmsKeyId: env.AWS_KMS_KEY_ID as string,
      region: env.AWS_REGION as string,
      fallbackSnapshot: snapshot,
      ...(options.logger ? { logger: options.logger } : {}),
    });
  }
  return createLibsodiumAdapter({ snapshot });
}
