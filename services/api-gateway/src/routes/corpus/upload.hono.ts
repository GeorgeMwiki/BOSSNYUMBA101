/**
 * /api/v1/corpus/upload — Company Brain HTTP corpus upload endpoint.
 *
 * Wave Dim-C / C10 — exposes the 5-stage brain-ingestion pipeline
 * (parser -> chunker -> embedder -> summarizer -> persistence) over
 * HTTP for landlord-facing surfaces (owner cockpit, admin console).
 *
 * Companion to:
 *   - services/api-gateway/src/services/brain-ingestion/*
 *   - packages/database/src/schemas/corpus-doc-uploads.schema.ts
 *   - migration 0280_corpus_doc_uploads.sql (table exists, schema reused)
 *
 * Routes:
 *   POST /        multipart/form-data upload + ingest
 *
 * Tenant scoping
 *   - The JWT-bound `tenantId` is the only source of truth.
 *   - `databaseMiddleware` binds `app.current_tenant_id` GUC so the
 *     RLS FORCE policy on `corpus_doc_uploads` / `corpus_doc_summaries`
 *     / `intelligence_corpus_chunks` filters writes to the caller's
 *     tenant.
 *
 * Accepted MIME types
 *   - application/pdf                          (.pdf  lease, condo bylaws)
 *   - application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *                                              (.docx deposit-handling rules)
 *   - text/plain                               (.txt  notes, raw rules)
 *
 * File size limit
 *   - Default 25 MiB. Overridable via `CORPUS_UPLOAD_MAX_BYTES` env var
 *     (bootstrap-loaded; this module reads from `process.env` only via
 *     a single module-load constant — no per-request env reads).
 *
 * Response shape
 *   201 { success: true, data: { upload_id, status, chunk_count } }
 *   400 { success: false, error: { code: 'INVALID_FILE', ... } }
 *   400 { success: false, error: { code: 'UNSUPPORTED_MIME', ... } }
 *   413 { success: false, error: { code: 'FILE_TOO_LARGE', ... } }
 *   401 { success: false, error: { code: 'UNAUTHORIZED', ... } }
 *   503 { success: false, error: { code: 'DB_UNAVAILABLE', ... } }
 *   500 { success: false, error: { code: 'INTERNAL_ERROR', ... } }
 *
 * Hard rules honoured
 *   - Pino logger only (no console.log).
 *   - No process.env reads outside the module-load constant.
 *   - Tenant-scoped via auth + databaseMiddleware GUC binding.
 *   - Append-only writes (ingest pipeline does not mutate).
 *   - No raw HTML interpolation, no @ts-ignore.
 */

// (hono-dev/hono#3891). Same pattern used by other *.hono.ts routes
// in this codebase (e.g. owner/pinned-items.hono.ts).

import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget';
import { createLogger } from '../../utils/logger';
import {
  ingest,
  createDrizzlePersistence,
  resolveEmbedder,
  createDefaultKnowledgeGraphGrower,
  type IngestionDeps,
} from '../../services/brain-ingestion/index';
import type {
  CorpusDocSourceKind,
  IncomingDoc,
} from '../../services/brain-ingestion/types';

const moduleLogger = createLogger('corpus-upload');

// ─── Configuration ───────────────────────────────────────────────────
// Module-load constant. Single env read at module init keeps the
// "no process.env outside bootstrap" rule satisfiable while still
// honouring an operator override. Fallback is a sensible 25 MiB default
// — large enough for a full property portfolio's lease + bylaws PDF,
// small enough that one upload can't blow a request worker's memory.
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = (() => {
  const raw = process.env['CORPUS_UPLOAD_MAX_BYTES'];
  if (!raw) return DEFAULT_MAX_UPLOAD_BYTES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_UPLOAD_BYTES;
  return parsed;
})();

// ─── MIME → sourceKind mapping ───────────────────────────────────────
// Only the three formats the dim-C audit requires: PDF, DOCX, TXT.
// Maps to the 9 sourceKind values declared in corpus_doc_uploads.
const MIME_TO_SOURCE_KIND: Readonly<Record<string, CorpusDocSourceKind>> =
  Object.freeze({
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'pdf', // DOCX -> 'pdf' bucket; parser dispatches by extension/mime
    'text/plain': 'text',
  });

const ALLOWED_MIME_TYPES = Object.freeze(Object.keys(MIME_TO_SOURCE_KIND));

// ─── Validation schemas ──────────────────────────────────────────────
const optionalMetadataSchema = z
  .object({
    languageHint: z.enum(['en', 'sw', 'auto']).optional(),
    docKind: z
      .enum([
        'lease_template',
        'deposit_rule',
        'condo_bylaw',
        'inspection_report',
        'maintenance_request',
        'other',
      ])
      .optional(),
  })
  .strict()
  .optional();

// ─── Router ──────────────────────────────────────────────────────────
const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);
app.use('*', getSharedPerTenantRateBudget({ surface: 'brain' }).handler);

/**
 * POST / — accept a single document upload, drive it through the
 *          5-stage brain-ingestion pipeline, return the upload receipt.
 *
 * multipart/form-data fields:
 *   file     (required)  the document bytes
 *   metadata (optional)  JSON string with { languageHint, docKind }
 */
app.post('/', async (c: any) => {
  const auth = c.get('auth') as { tenantId: string; userId: string };

  // ─── 1. Parse multipart body ────────────────────────────────────
  // We parse + validate (MIME, size) BEFORE the DB-availability check
  // so a misconfigured request fails fast with the most specific error
  // — even in degraded modes where the DB is offline.
  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody({ all: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    moduleLogger.warn('corpus-upload: multipart parse failed', {
      tenantId: auth.tenantId,
      error: message,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: 'Could not parse multipart body',
        },
      },
      400,
    );
  }

  const fileField = body['file'];
  if (!(fileField instanceof File)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: 'Missing required field: file',
        },
      },
      400,
    );
  }
  const file: File = fileField;

  // ─── 2. MIME validation ─────────────────────────────────────────
  const mimeType = (file.type || '').toLowerCase();
  const sourceKind = MIME_TO_SOURCE_KIND[mimeType];
  if (!sourceKind) {
    moduleLogger.info('corpus-upload: rejected wrong-mime', {
      tenantId: auth.tenantId,
      mimeType,
      allowedTypes: ALLOWED_MIME_TYPES,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'UNSUPPORTED_MIME',
          message: `Unsupported mime type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        },
      },
      400,
    );
  }

  // ─── 3. Size validation (pre-read defence-in-depth) ─────────────
  // file.size is the multipart-parsed length; we cap BEFORE reading
  // bytes into memory so an attacker cannot use the byte-read to blow
  // the request worker's heap.
  if (file.size > MAX_UPLOAD_BYTES) {
    moduleLogger.info('corpus-upload: rejected oversize', {
      tenantId: auth.tenantId,
      sizeBytes: file.size,
      limitBytes: MAX_UPLOAD_BYTES,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File exceeds ${MAX_UPLOAD_BYTES} byte limit`,
        },
      },
      413,
    );
  }

  // ─── 4. Optional metadata ───────────────────────────────────────
  let metadataParsed: z.infer<typeof optionalMetadataSchema> | undefined;
  const rawMeta = body['metadata'];
  if (typeof rawMeta === 'string' && rawMeta.length > 0) {
    let metaJson: unknown;
    try {
      metaJson = JSON.parse(rawMeta);
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_METADATA',
            message: 'metadata field must be valid JSON',
          },
        },
        400,
      );
    }
    const validation = optionalMetadataSchema.safeParse(metaJson);
    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INVALID_METADATA',
            message: 'metadata field failed schema validation',
            issues: validation.error.issues,
          },
        },
        400,
      );
    }
    metadataParsed = validation.data;
  }

  // ─── 5. DB-availability check ───────────────────────────────────
  // Now that we know the request is well-formed, ensure we actually
  // have a database client to persist into. The databaseMiddleware
  // binds it earlier in the chain; a `null` here means we are running
  // in mock-data mode (test bootstrap or misconfigured env).
  const db = c.get('db');
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Database not configured',
        },
      },
      503,
    );
  }

  // ─── 6. Read bytes ──────────────────────────────────────────────
  let bytes: Uint8Array;
  try {
    const ab = await file.arrayBuffer();
    bytes = new Uint8Array(ab);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    moduleLogger.warn('corpus-upload: byte-read failed', {
      tenantId: auth.tenantId,
      error: message,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_FILE',
          message: 'Could not read uploaded bytes',
        },
      },
      400,
    );
  }

  // Belt-and-braces: re-check size from the actual buffer in case the
  // multipart parser under-reported it (the spec allows it).
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    moduleLogger.info('corpus-upload: rejected oversize (post-read)', {
      tenantId: auth.tenantId,
      sizeBytes: bytes.byteLength,
      limitBytes: MAX_UPLOAD_BYTES,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File exceeds ${MAX_UPLOAD_BYTES} byte limit`,
        },
      },
      413,
    );
  }

  // ─── 7. Compose IncomingDoc & drive the pipeline ────────────────
  // For text/plain we hand the parser the decoded string. For PDF /
  // DOCX we hand it bytes (the parser dispatches on sourceKind).
  const filename = (file.name || 'unnamed-upload').toString();
  const isText = mimeType === 'text/plain';
  const incomingDoc: IncomingDoc = isText
    ? {
        originalFilename: filename,
        sourceKind: 'text',
        mimeType,
        text: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
        ...(metadataParsed?.languageHint
          ? { languageHint: metadataParsed.languageHint }
          : {}),
        metadata: metadataParsed?.docKind
          ? { docKind: metadataParsed.docKind }
          : {},
      }
    : {
        originalFilename: filename,
        sourceKind,
        mimeType,
        bytes,
        ...(metadataParsed?.languageHint
          ? { languageHint: metadataParsed.languageHint }
          : {}),
        metadata: metadataParsed?.docKind
          ? { docKind: metadataParsed.docKind }
          : {},
      };

  // Storage URL is the in-tenant convention used by intelligence_corpus_chunks
  // (see brain-ingestion/persistence.ts upsertChunks). We mint a stable
  // logical URI; the actual byte storage backend wiring is owned by the
  // composition root and orthogonal to the ingestion call.
  const storageUrl = `tenant://${auth.tenantId}/uploads/${encodeURIComponent(filename)}`;

  const deps: IngestionDeps = {
    persistence: createDrizzlePersistence(db),
    embedder: resolveEmbedder(),
    // RLS (#16 follow-up): pass the request-bound tenant tx (`c.get('db')`,
    // resolved above) into the grower so its entity_index /
    // entity_cross_references writes run inside the same transaction where
    // databaseMiddleware bound `app.current_tenant_id` — keeping the
    // knowledge-graph writes RLS-enforced end-to-end instead of escaping
    // to the raw singleton client.
    grower: createDefaultKnowledgeGraphGrower(db),
    logger: {
      info: (obj, msg) =>
        moduleLogger.info(msg ?? 'brain-ingest', obj as Record<string, unknown>),
      warn: (obj, msg) =>
        moduleLogger.warn(msg ?? 'brain-ingest', obj as Record<string, unknown>),
      error: (obj, msg) =>
        moduleLogger.error(msg ?? 'brain-ingest', obj as Record<string, unknown>),
    },
  };

  try {
    const receipt = await ingest(deps, {
      tenantId: auth.tenantId,
      userId: auth.userId,
      doc: incomingDoc,
      storageUrl,
    });

    moduleLogger.info('corpus-upload: ingest complete', {
      tenantId: auth.tenantId,
      uploadId: receipt.uploadId,
      status: receipt.status,
      chunksCount: receipt.chunksCount,
    });

    return c.json(
      {
        success: true,
        data: {
          upload_id: receipt.uploadId,
          status: receipt.status,
          chunk_count: receipt.chunksCount,
          warnings: receipt.warnings,
          ...(receipt.errorMessage
            ? { error_message: receipt.errorMessage }
            : {}),
        },
      },
      201,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    moduleLogger.error('corpus-upload: ingest threw', {
      tenantId: auth.tenantId,
      error: message,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Ingestion pipeline failed',
        },
      },
      500,
    );
  }
});

export const corpusUploadRouter = app;
export default corpusUploadRouter;
