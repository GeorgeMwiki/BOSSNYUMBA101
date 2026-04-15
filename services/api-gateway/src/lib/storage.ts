/**
 * Object storage helper.
 *
 * In production this writes uploaded blobs to S3 (or any S3-compatible store
 * such as MinIO). In dev — when no `S3_ENDPOINT` env var is set — it falls
 * back to writing files under `/tmp/bossnyumba-uploads/{tenantId}/{key}` so
 * the gateway boots and serves uploads without any external dependency.
 *
 * Configuration (env):
 *   S3_ENDPOINT          e.g. "https://s3.amazonaws.com" or "http://minio:9000"
 *   S3_REGION            e.g. "us-east-1" (default)
 *   S3_BUCKET            target bucket name
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_FORCE_PATH_STYLE  optional, "true" forces path-style URLs (MinIO)
 *
 * Usage:
 *   const { url, key } = await uploadFile({
 *     tenantId, key: 'maintenance-tickets/.../uuid-photo.jpg',
 *     body: fileBuffer, contentType: 'image/jpeg',
 *   });
 *
 *   const presigned = await getPresignedUploadUrl({
 *     tenantId, key, contentType, expiresInSeconds: 900,
 *   });
 *
 * @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner are loaded lazily so the
 * dev / local-disk path never requires the SDK to be installed.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface StorageConfig {
  endpoint?: string;
  region: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
  localRoot: string;
}

export interface UploadFileInput {
  tenantId: string;
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export interface UploadFileResult {
  url: string;
  key: string;
}

export interface PresignedUploadInput {
  tenantId: string;
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  url: string;
  key: string;
  expiresInSeconds: number;
  method: 'PUT';
  headers: Record<string, string>;
}

const LOCAL_ROOT_DEFAULT = '/tmp/bossnyumba-uploads';

function loadConfig(): StorageConfig {
  return {
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || 'us-east-1',
    bucket: process.env.S3_BUCKET?.trim() || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || undefined,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || undefined,
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true',
    localRoot: process.env.LOCAL_UPLOAD_ROOT?.trim() || LOCAL_ROOT_DEFAULT,
  };
}

/** Tenant-scoped key. We always namespace by tenantId at the bucket-key root. */
function tenantKey(tenantId: string, key: string): string {
  // Defensive: never let `key` walk above its prefix.
  const safeKey = key.replace(/\.{2,}/g, '.').replace(/^\/+/, '');
  return `${tenantId}/${safeKey}`;
}

let cachedClient: any | null = null;
let cachedClientFailed = false;

async function getS3Client(cfg: StorageConfig): Promise<any | null> {
  if (cachedClientFailed) return null;
  if (cachedClient) return cachedClient;
  if (!cfg.endpoint || !cfg.bucket) return null;
  try {
    // Lazy import: dev environments without @aws-sdk/client-s3 still work.
    const mod = await import('@aws-sdk/client-s3');
    cachedClient = new mod.S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials:
        cfg.accessKeyId && cfg.secretAccessKey
          ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
          : undefined,
      forcePathStyle: cfg.forcePathStyle,
    });
    return cachedClient;
  } catch (err) {
    cachedClientFailed = true;
    // eslint-disable-next-line no-console
    console.warn('[storage] @aws-sdk/client-s3 unavailable, falling back to local disk', err);
    return null;
  }
}

function publicS3Url(cfg: StorageConfig, fullKey: string): string {
  const endpoint = (cfg.endpoint || '').replace(/\/+$/, '');
  if (cfg.forcePathStyle) {
    return `${endpoint}/${cfg.bucket}/${fullKey}`;
  }
  // Virtual-hosted style: bucket.host
  try {
    const u = new URL(endpoint);
    return `${u.protocol}//${cfg.bucket}.${u.host}/${fullKey}`;
  } catch {
    return `${endpoint}/${cfg.bucket}/${fullKey}`;
  }
}

async function writeLocal(cfg: StorageConfig, fullKey: string, body: Buffer | Uint8Array): Promise<string> {
  const filePath = path.join(cfg.localRoot, fullKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
  return `file://${filePath}`;
}

/**
 * Upload a file to object storage (or local disk in dev).
 * Returns the durable URL plus the canonical bucket key.
 */
export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  const cfg = loadConfig();
  const fullKey = tenantKey(input.tenantId, input.key);
  const client = await getS3Client(cfg);

  if (!client || !cfg.bucket) {
    const url = await writeLocal(cfg, fullKey, input.body);
    return { url, key: fullKey };
  }

  const mod = await import('@aws-sdk/client-s3');
  await client.send(
    new mod.PutObjectCommand({
      Bucket: cfg.bucket,
      Key: fullKey,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
  return { url: publicS3Url(cfg, fullKey), key: fullKey };
}

/**
 * Generate a presigned PUT URL the client can upload to directly.
 * Falls back to a `file://` placeholder when no S3 is configured — callers in
 * dev should use the `uploadFile` server-side path instead.
 */
export async function getPresignedUploadUrl(
  input: PresignedUploadInput,
): Promise<PresignedUploadResult> {
  const cfg = loadConfig();
  const fullKey = tenantKey(input.tenantId, input.key);
  const expiresInSeconds = Math.max(60, input.expiresInSeconds ?? 900);
  const client = await getS3Client(cfg);

  if (!client || !cfg.bucket) {
    return {
      url: `file://${path.join(cfg.localRoot, fullKey)}`,
      key: fullKey,
      expiresInSeconds,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
    };
  }

  const s3Mod = await import('@aws-sdk/client-s3');
  const presignerMod = await import('@aws-sdk/s3-request-presigner');
  const command = new s3Mod.PutObjectCommand({
    Bucket: cfg.bucket,
    Key: fullKey,
    ContentType: input.contentType,
  });
  const url = await presignerMod.getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return {
    url,
    key: fullKey,
    expiresInSeconds,
    method: 'PUT',
    headers: { 'Content-Type': input.contentType },
  };
}

// ---------------------------------------------------------------------------
// Upload-validation helpers shared by routes that accept multipart uploads
// ---------------------------------------------------------------------------

export const ALLOWED_IMAGE_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_REQUEST_BYTES = 40 * 1024 * 1024; // 40 MB total per request

export class UploadTooLargeError extends Error {
  constructor(
    message: string,
    public readonly scope: 'file' | 'request',
    public readonly limitBytes: number,
    public readonly actualBytes: number,
  ) {
    super(message);
    this.name = 'UploadTooLargeError';
  }
}

export class UnsupportedContentTypeError extends Error {
  constructor(
    message: string,
    public readonly contentType: string,
  ) {
    super(message);
    this.name = 'UnsupportedContentTypeError';
  }
}

/**
 * Sanitize a user-supplied filename:
 *   - strip path separators and leading dots
 *   - replace any non-alphanumeric/.-_ runs with `_`
 *   - lowercase the extension
 *   - cap base length at 80 chars (extension preserved)
 */
export function sanitizeFilename(input: string): string {
  const raw = String(input || '').trim() || 'upload';
  // Drop directory components.
  const justName = raw.split(/[\\/]/).pop() || 'upload';
  // Strip leading dots so we never produce hidden / dot-only files.
  const noLeadingDots = justName.replace(/^\.+/, '');
  const cleaned = noLeadingDots.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const dot = cleaned.lastIndexOf('.');
  let base: string;
  let ext: string;
  if (dot > 0 && dot < cleaned.length - 1) {
    base = cleaned.slice(0, dot);
    ext = cleaned.slice(dot).toLowerCase();
  } else {
    base = cleaned || 'upload';
    ext = '';
  }
  if (base.length > 80) base = base.slice(0, 80);
  if (ext.length > 16) ext = ext.slice(0, 16);
  return `${base}${ext}` || 'upload';
}

export interface FileLike {
  name?: string;
  type?: string;
  size?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Validate a single multipart `File` (Web API) against the allowlist + limits.
 * Throws `UnsupportedContentTypeError` or `UploadTooLargeError` for callers to
 * map to HTTP 415 / 413 responses.
 */
export async function readAndValidateUpload(
  file: FileLike,
  runningTotalBytes: number,
): Promise<{ buffer: Buffer; contentType: string; filename: string; size: number }> {
  const contentType = (file.type || 'application/octet-stream').toLowerCase();
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new UnsupportedContentTypeError(
      `Content type ${contentType} not allowed`,
      contentType,
    );
  }

  // Hint check before we materialize the buffer — short-circuit on metadata.
  if (typeof file.size === 'number' && file.size > MAX_FILE_BYTES) {
    throw new UploadTooLargeError(
      `File exceeds per-file limit of ${MAX_FILE_BYTES} bytes`,
      'file',
      MAX_FILE_BYTES,
      file.size,
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new UploadTooLargeError(
      `File exceeds per-file limit of ${MAX_FILE_BYTES} bytes`,
      'file',
      MAX_FILE_BYTES,
      buffer.byteLength,
    );
  }
  if (runningTotalBytes + buffer.byteLength > MAX_REQUEST_BYTES) {
    throw new UploadTooLargeError(
      `Request exceeds total upload limit of ${MAX_REQUEST_BYTES} bytes`,
      'request',
      MAX_REQUEST_BYTES,
      runningTotalBytes + buffer.byteLength,
    );
  }

  return {
    buffer,
    contentType,
    filename: sanitizeFilename(file.name || 'upload'),
    size: buffer.byteLength,
  };
}

/**
 * Map a thrown upload error to a Hono-friendly `{ status, body }` shape.
 * Returns `null` if the error isn't one we map (caller should rethrow).
 */
export function uploadErrorToResponse(
  err: unknown,
): { status: 413 | 415; body: { success: false; error: { code: string; message: string } } } | null {
  if (err instanceof UploadTooLargeError) {
    return {
      status: 413,
      body: {
        success: false,
        error: {
          code: err.scope === 'file' ? 'UPLOAD_FILE_TOO_LARGE' : 'UPLOAD_REQUEST_TOO_LARGE',
          message: err.message,
        },
      },
    };
  }
  if (err instanceof UnsupportedContentTypeError) {
    return {
      status: 415,
      body: {
        success: false,
        error: {
          code: 'UNSUPPORTED_CONTENT_TYPE',
          message: err.message,
        },
      },
    };
  }
  return null;
}
