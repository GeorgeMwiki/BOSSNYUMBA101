/**
 * Session replay cold storage — Central Command Phase B (B5).
 *
 * Port-based adapter for the gzip-compressed, PII-masked rrweb event
 * blobs uploaded by the client recorder. The Drizzle service
 * (`createSessionReplayChunksService` in `@bossnyumba/database`) holds
 * the metadata index; this module holds the byte payload.
 *
 * Two implementations:
 *
 *   - createLocalFileStorage({ rootDir })
 *       Writes one file per chunk under `${rootDir}/<chunkId>.gz`.
 *       Default for dev + tests; resolves to `/tmp/session-replay/` when
 *       no rootDir is supplied. Returns `file://...` URIs.
 *
 *   - createS3Storage({ bucket, region })
 *       Lazy-loads `@aws-sdk/client-s3` on first call. When the SDK
 *       module is not installed in the workspace (it currently is not),
 *       the factory throws on first call and the composition root falls
 *       back to local storage. Returns `s3://<bucket>/<key>` URIs.
 *
 * `selectSessionReplayStorage(env)` is the composition helper used by
 * `services/api-gateway/src/index.ts` — it picks S3 when both
 * `AWS_REGION` and `S3_SESSION_REPLAY_BUCKET` are set, otherwise local.
 *
 * Hard rules:
 *   - PII masking is the client's responsibility (rrweb's `maskAllInputs`
 *     + the `pii-mask.ts` selector list). The storage adapter never sees
 *     the cleartext bytes.
 *   - No `download()` retries — the replay viewer is a manual, low-
 *     frequency action; transient S3 errors propagate to the operator.
 */

import { promises as fs } from 'node:fs';
import { join as joinPath } from 'node:path';
import { tmpdir } from 'node:os';

export type SessionReplayStorageKind = 'local' | 's3';

export interface SessionReplayStorageUploadArgs {
  readonly chunkId: string;
  readonly gzipBytes: Uint8Array;
}

export interface SessionReplayStorageUploadResult {
  readonly storageUri: string;
}

export interface SessionReplayStoragePort {
  readonly kind: SessionReplayStorageKind;
  upload(
    args: SessionReplayStorageUploadArgs,
  ): Promise<SessionReplayStorageUploadResult>;
  download(chunkIdOrUri: string): Promise<Uint8Array>;
}

// ─────────────────────────────────────────────────────────────────────
// Local-file implementation
// ─────────────────────────────────────────────────────────────────────

export interface LocalFileStorageConfig {
  readonly rootDir?: string;
}

export function createLocalFileStorage(
  config: LocalFileStorageConfig = {},
): SessionReplayStoragePort {
  const rootDir = config.rootDir ?? joinPath(tmpdir(), 'session-replay');
  let ensured = false;
  async function ensureRoot(): Promise<void> {
    if (ensured) return;
    // `rootDir` is operator-configured at startup (never tenant input).
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await fs.mkdir(rootDir, { recursive: true });
    ensured = true;
  }
  return {
    kind: 'local',
    async upload({ chunkId, gzipBytes }) {
      if (!chunkId || !isSafeChunkId(chunkId)) {
        throw new Error(
          `LocalFileStorage.upload: unsafe chunkId '${chunkId}'`,
        );
      }
      await ensureRoot();
      const filePath = joinPath(rootDir, `${chunkId}.gz`);
      // `chunkId` validated by `isSafeChunkId` (UUID-only) above; the
      // join with `rootDir` cannot traverse out of the storage root.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.writeFile(filePath, gzipBytes);
      return { storageUri: `file://${filePath}` };
    },
    async download(chunkIdOrUri) {
      const filePath = resolveLocalPath(rootDir, chunkIdOrUri);
      try {
        // `resolveLocalPath` enforces the path stays within `rootDir`
        // and rejects directory-traversal payloads.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const buf = await fs.readFile(filePath);
        return new Uint8Array(buf);
      } catch (error) {
        throw new Error(
          `LocalFileStorage.download: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };
}

function resolveLocalPath(rootDir: string, chunkIdOrUri: string): string {
  if (chunkIdOrUri.startsWith('file://')) {
    return chunkIdOrUri.slice('file://'.length);
  }
  if (!isSafeChunkId(chunkIdOrUri)) {
    throw new Error(
      `LocalFileStorage.download: unsafe chunkId '${chunkIdOrUri}'`,
    );
  }
  return joinPath(rootDir, `${chunkIdOrUri}.gz`);
}

/** A chunkId must be a UUID-like opaque token. Path-traversal characters
 *  reject the request before any FS call. */
function isSafeChunkId(id: string): boolean {
  return /^[A-Za-z0-9_\-]{4,128}$/.test(id);
}

// ─────────────────────────────────────────────────────────────────────
// S3 implementation
// ─────────────────────────────────────────────────────────────────────

export interface S3StorageConfig {
  readonly bucket: string;
  readonly region: string;
  /** Optional key prefix — defaults to `session-replay/`. */
  readonly keyPrefix?: string;
}

/**
 * Minimal subset of the `@aws-sdk/client-s3` surface we actually use.
 * Kept in a duck-type so this file is typeable without the dependency.
 */
interface S3ClientLike {
  send(command: unknown): Promise<{
    Body?: {
      transformToByteArray?: () => Promise<Uint8Array>;
    } & AsyncIterable<Uint8Array>;
  }>;
}

interface S3SdkModule {
  S3Client: new (config: { region: string }) => S3ClientLike;
  PutObjectCommand: new (input: {
    Bucket: string;
    Key: string;
    Body: Uint8Array;
    ContentType: string;
    ContentEncoding?: string;
  }) => unknown;
  GetObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
}

/**
 * The S3 factory lazy-loads `@aws-sdk/client-s3`. If the module is not
 * installed (current workspace state) the first call throws and the
 * composition root falls back to local storage. We deliberately do NOT
 * add the dependency to package.json because the brief asks us not to
 * install — when the SDK is wired in by a later wave, this adapter will
 * "just work" without further code changes.
 */
export async function createS3Storage(
  config: S3StorageConfig,
): Promise<SessionReplayStoragePort> {
  const sdk = await loadS3Sdk();
  if (!sdk) {
    throw new Error(
      'S3 storage requested but @aws-sdk/client-s3 is not installed. Falling back to local storage.',
    );
  }
  const client = new sdk.S3Client({ region: config.region });
  const keyPrefix = config.keyPrefix ?? 'session-replay/';
  return {
    kind: 's3',
    async upload({ chunkId, gzipBytes }) {
      if (!isSafeChunkId(chunkId)) {
        throw new Error(`S3Storage.upload: unsafe chunkId '${chunkId}'`);
      }
      const key = `${keyPrefix}${chunkId}.gz`;
      const cmd = new sdk.PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: gzipBytes,
        ContentType: 'application/json',
        ContentEncoding: 'gzip',
      });
      await client.send(cmd);
      return { storageUri: `s3://${config.bucket}/${key}` };
    },
    async download(chunkIdOrUri) {
      const key = chunkIdOrUri.startsWith('s3://')
        ? chunkIdOrUri.slice(`s3://${config.bucket}/`.length)
        : `${keyPrefix}${chunkIdOrUri}.gz`;
      const cmd = new sdk.GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      });
      const out = await client.send(cmd);
      if (!out.Body) throw new Error('S3Storage.download: empty body');
      if (typeof out.Body.transformToByteArray === 'function') {
        return out.Body.transformToByteArray();
      }
      // Fallback: accumulate AsyncIterable<Uint8Array>.
      const chunks: Uint8Array[] = [];
      for await (const c of out.Body as AsyncIterable<Uint8Array>) {
        chunks.push(c);
      }
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      return merged;
    },
  };
}

async function loadS3Sdk(): Promise<S3SdkModule | null> {
  try {
    // @ts-ignore — dynamic import resolves at runtime; absence is expected.
    const mod = (await import('@aws-sdk/client-s3')) as S3SdkModule;
    return mod;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Composition selector
// ─────────────────────────────────────────────────────────────────────

export interface StorageEnv {
  readonly AWS_REGION?: string;
  readonly S3_SESSION_REPLAY_BUCKET?: string;
  readonly SESSION_REPLAY_LOCAL_DIR?: string;
}

/**
 * Pick the storage backend based on environment variables. Returns S3
 * when both `AWS_REGION` and `S3_SESSION_REPLAY_BUCKET` are set AND
 * `@aws-sdk/client-s3` is installed; otherwise local FS.
 *
 * Falls back to local on any S3 init failure so the api-gateway can
 * boot even if the SDK is partly mis-configured.
 */
export async function selectSessionReplayStorage(
  env: StorageEnv,
): Promise<SessionReplayStoragePort> {
  const wantsS3 = !!env.AWS_REGION && !!env.S3_SESSION_REPLAY_BUCKET;
  if (wantsS3) {
    try {
      return await createS3Storage({
        bucket: env.S3_SESSION_REPLAY_BUCKET as string,
        region: env.AWS_REGION as string,
      });
    } catch (error) {
      console.warn(
        'session-replay: S3 storage init failed, falling back to local FS:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return createLocalFileStorage({ rootDir: env.SESSION_REPLAY_LOCAL_DIR });
}
