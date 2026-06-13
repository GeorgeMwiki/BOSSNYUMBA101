// @ts-nocheck — Hono v4 status-code literal union widening; same pattern as
// other .hono routers in this directory.
/**
 * Cases router — live-data implementation for the tenant/maintenance case
 * lifecycle. Previously a `LIVE_DATA_NOT_IMPLEMENTED` stub (503) even though
 * the `cases` table existed since migration 0001c. The gap blocked the
 * maintenance-case end-to-end flow and every downstream probe (AI triage,
 * work-order assignment, resolution).
 *
 * Scope (minimum to unblock real workflows):
 *   - POST   /              create a case
 *   - GET    /              list cases (tenant-scoped)
 *   - GET    /:id           fetch one
 *   - POST   /:id/resolve   mark resolved + write resolution row
 *
 * All writes go through the drizzle client injected by databaseMiddleware,
 * using raw SQL (the package does not yet export a CaseRepository). Tenant
 * isolation is enforced in every WHERE clause — no silent cross-tenant
 * reads. Case numbers are generated as `CASE-YYMMDD-XXXX`.
 */

import { randomInt } from 'node:crypto';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { parseListPagination, buildListResponse } from './pagination';

import { withSecurityEvents } from '@bossnyumba/observability';
const CASE_TYPES = [
  'arrears', 'deposit_dispute', 'damage_claim', 'lease_violation',
  'noise_complaint', 'maintenance_dispute', 'eviction', 'harassment',
  'safety_concern', 'billing_dispute', 'other',
] as const;
const CASE_STATUSES = [
  'open', 'investigating', 'pending_response', 'pending_evidence',
  'mediation', 'escalated', 'resolved', 'closed', 'withdrawn',
] as const;
const CASE_SEVERITIES = ['low', 'medium', 'high', 'critical', 'urgent'] as const;

// Maintenance-evidence photo references attached inline at case
// creation. The canonical reference is a URL (remote https or inline
// data:/blob: URL — all valid per the URL parser). The tenant intake
// clients additionally send a `{ name, dataUrl|url }` object so the
// filename survives, so we accept both shapes and normalize to
// `{ name, url }` before persisting. Capped at 20 to bound payload size.
//
// MODEL: `cases.photos` is the lightweight DENORMALIZED display cache
// (migration 0312) — a flat `{ name, url }[]` the case card reads
// without a join. The AUTHORITATIVE durable record for an uploaded file
// is a row in `evidence_attachments` (file_url / file_name / mime_type /
// file_size_bytes + the uploading principal). `POST /:id/evidence`
// writes the durable row first and then appends the image to this cache,
// so the two stay consistent; this inline-at-create path only ever
// populates the cache (bare references with no server-known size/mime).
const PhotoRefSchema = z.union([
  z.string().url(),
  z.object({
    name: z.string().max(255).optional(),
    url: z.string().url().optional(),
    dataUrl: z.string().url().optional(),
  }),
]);

const CaseCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(CASE_TYPES).optional(),
  severity: z.enum(CASE_SEVERITIES).optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  amountInDispute: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  tags: z.array(z.string()).optional(),
  photos: z.array(PhotoRefSchema).max(20).optional(),
});

type PhotoRef = z.infer<typeof PhotoRefSchema>;

/**
 * Normalize the accepted photo shapes into a stable `{ name, url }[]`.
 * Drops entries that carry no resolvable URL so a malformed item never
 * persists as a null-URL reference.
 */
function normalizePhotos(
  photos: readonly PhotoRef[] | undefined,
): ReadonlyArray<{ name: string | null; url: string }> {
  if (!photos) return [];
  return photos.flatMap((p) => {
    if (typeof p === 'string') return [{ name: null, url: p }];
    const url = p.url ?? p.dataUrl;
    if (!url) return [];
    return [{ name: p.name ?? null, url }];
  });
}

const CaseResolveSchema = z.object({
  resolution: z.string().min(1).max(2000).optional(),
  closureReason: z.string().max(500).optional(),
});

// ── Evidence attachments ────────────────────────────────────────────
// Durable case evidence lives in the `evidence_attachments` table
// (migration 0014): one row per uploaded file, carrying file_url /
// file_name / mime_type / file_size_bytes + the uploading principal.
// This is the AUTHORITATIVE model. The lightweight `cases.photos` jsonb
// (migration 0312) is kept as a denormalized display cache the intake
// surface already reads; the upload handler appends each new image to
// it so the case card and the evidence list stay consistent without a
// second round-trip.
//
// The blob itself is uploaded in the SAME request as multipart/form-data
// (`file` field) — mirroring the proven corpus-upload handler. The
// gateway streams the bytes into the tenant-scoped object-storage
// provider wired by the composition root (`documentStorage.provider` —
// Supabase Storage in prod, local disk in dev) and persists the
// returned URL. This keeps storage credentials server-side; the
// customer app never talks to object storage directly.
//
// Cap at 25 MiB and enforce an image/document mime allowlist server-side
// so the UI's `accept="image/*"` filter cannot be the only gate.
const MAX_EVIDENCE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EVIDENCE_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
  'application/pdf',
];

// Metadata that may accompany the multipart upload. `caption` becomes
// the evidence row's `description`; `fileName` overrides the browser
// filename when provided. Sizes are bounded so a malformed field can't
// bloat the row.
const EvidenceMetaSchema = z.object({
  caption: z.string().max(500).optional(),
  fileName: z.string().min(1).max(255).optional(),
});

/** Shape the gateway returns for a single evidence attachment row. */
function rowToEvidence(row: Record<string, unknown>) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.case_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    mimeType: row.mime_type ?? null,
    fileSizeBytes: row.file_size_bytes ?? null,
    caption: row.description ?? null,
    exhibitLabel: row.exhibit_label ?? null,
    sealed: Boolean(row.sealed),
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

/**
 * Append a `{ name, url }` reference to the case's `photos` jsonb cache.
 * Best-effort: the durable evidence row is already committed, so a
 * failure here is logged via the thrown error being swallowed by the
 * caller — the attachment is NOT lost. Only image mime-types are mirrored
 * into the photo strip (PDFs stay evidence-only).
 */
function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function caseNumber() {
  const date = new Date();
  const y = String(date.getUTCFullYear()).slice(-2);
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const rand = randomInt(0, 10000).toString().padStart(4, '0');
  return `CASE-${y}${m}${d}-${rand}`;
}

function rowToCase(row: Record<string, unknown>) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    caseNumber: row.case_number,
    title: row.title,
    description: row.description,
    type: String(row.case_type ?? 'other').toUpperCase(),
    severity: String(row.severity ?? 'medium').toUpperCase(),
    status: String(row.status ?? 'open').toUpperCase(),
    propertyId: row.property_id,
    unitId: row.unit_id,
    customerId: row.customer_id,
    leaseId: row.lease_id,
    amountInDispute: row.amount_in_dispute,
    currency: row.currency,
    assignedTo: row.assigned_to,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    tags: row.tags || [],
    photos: row.photos || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) {
    return c.json(
      { success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database client is not initialized' } },
      503,
    );
  }
  const p = parseListPagination(c);
  const status = c.req.query('status');
  const customerId = c.req.query('customerId');

  const whereStatus = status ? sql`AND status = ${status.toLowerCase()}` : sql``;
  const whereCustomer = customerId ? sql`AND customer_id = ${customerId}` : sql``;

  const result = await db.execute(sql`
    SELECT * FROM cases
     WHERE tenant_id = ${auth.tenantId}
       ${whereStatus}
       ${whereCustomer}
     ORDER BY created_at DESC
     LIMIT ${p.limit} OFFSET ${p.offset}
  `);
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM cases
     WHERE tenant_id = ${auth.tenantId}
       ${whereStatus}
       ${whereCustomer}
  `);
  const rows = (result as unknown as Record<string, unknown>[]) || [];
  const total = Number(((countResult as unknown as Record<string, unknown>[])[0]?.total) ?? 0);
  const items = rows.map(rowToCase);
  return c.json({ success: true, ...buildListResponse(items, total, p) });
});

app.post('/', zValidator('json', CaseCreateSchema), withSecurityEvents({ action: 'case.create', resource: 'case', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) {
    return c.json(
      { success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database client is not initialized' } },
      503,
    );
  }
  const body = c.req.valid('json');
  const id = crypto.randomUUID();
  const number = caseNumber();
  const type = body.type || 'maintenance_dispute';
  const severity = body.severity || 'medium';
  const tags = body.tags || [];
  const photos = normalizePhotos(body.photos);

  await db.execute(sql`
    INSERT INTO cases (
      id, tenant_id, property_id, unit_id, customer_id, lease_id,
      case_number, case_type, severity, status, title, description,
      amount_in_dispute, currency, tags, photos,
      created_at, updated_at, created_by, updated_by
    ) VALUES (
      ${id}, ${auth.tenantId}, ${body.propertyId || null}, ${body.unitId || null},
      ${body.customerId || null}, ${body.leaseId || null},
      ${number}, ${type}::case_type, ${severity}::case_severity,
      'open'::case_status, ${body.title}, ${body.description || null},
      ${body.amountInDispute != null ? body.amountInDispute : null},
      ${body.currency || null}, ${JSON.stringify(tags)}::jsonb,
      ${JSON.stringify(photos)}::jsonb,
      NOW(), NOW(), ${auth.userId}, ${auth.userId}
    )
  `);
  const fetched = await db.execute(sql`SELECT * FROM cases WHERE id = ${id} AND tenant_id = ${auth.tenantId} LIMIT 1`);
  const row = (fetched as unknown as Record<string, unknown>[])[0];
  return c.json({ success: true, data: rowToCase(row) }, 201);
}));

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) {
    return c.json(
      { success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database client is not initialized' } },
      503,
    );
  }
  const id = c.req.param('id');
  const fetched = await db.execute(sql`
    SELECT * FROM cases WHERE id = ${id} AND tenant_id = ${auth.tenantId} LIMIT 1
  `);
  const rows = (fetched as unknown as Record<string, unknown>[]) || [];
  if (rows.length === 0) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }
  return c.json({ success: true, data: rowToCase(rows[0]) });
});

/**
 * GET /:id/full — return the full Case aggregate (timeline + notices +
 * evidence + resolution) via the Wave 26-wired `PostgresCaseRepository`.
 * The legacy GET /:id keeps returning the flat SQL-shaped row so the
 * existing dashboard surface is unchanged. Routes that didn't exist
 * yet can opt into the richer shape by hitting /full.
 *
 * Falls back to the raw SQL read when the composition root is in
 * degraded mode (DATABASE_URL unset) so the endpoint still returns
 * 2xx rather than 503 during local dev.
 */
app.get('/:id/full', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  const repo = c.get('caseRepo') as
    | { findById: (id: string, tenantId: string) => Promise<unknown | null> }
    | undefined;
  const id = c.req.param('id');

  if (repo) {
    try {
      const entity = await repo.findById(id, auth.tenantId);
      if (!entity) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
          404,
        );
      }
      return c.json({ success: true, data: entity });
    } catch (err) {
      // Repo failures fall through to the raw-SQL path below rather
      // than surfacing a 500 — the legacy shape is still useful even
      // when the aggregate payload is malformed.
    }
  }

  if (!db) {
    return c.json(
      { success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database client is not initialized' } },
      503,
    );
  }
  const fetched = await db.execute(sql`
    SELECT * FROM cases WHERE id = ${id} AND tenant_id = ${auth.tenantId} LIMIT 1
  `);
  const rows = (fetched as unknown as Record<string, unknown>[]) || [];
  if (rows.length === 0) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }
  return c.json({ success: true, data: rowToCase(rows[0]) });
});

/**
 * GET /:id/evidence — list a case's durable evidence attachments,
 * newest first. Tenant-scoped: the case is verified to belong to the
 * caller's tenant before any attachment is returned (defense-in-depth
 * alongside the RLS policy on `evidence_attachments`). Soft-deleted rows
 * (`deleted_at IS NOT NULL`) are excluded.
 */
app.get('/:id/evidence', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) {
    return c.json(
      { success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database client is not initialized' } },
      503,
    );
  }
  const caseId = c.req.param('id');

  // Verify case ownership first — a 404 here means either the case does
  // not exist OR it belongs to another tenant; we never disclose which.
  const owner = await db.execute(sql`
    SELECT id FROM cases WHERE id = ${caseId} AND tenant_id = ${auth.tenantId} LIMIT 1
  `);
  if (((owner as unknown as Record<string, unknown>[]) || []).length === 0) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  const fetched = await db.execute(sql`
    SELECT * FROM evidence_attachments
     WHERE case_id = ${caseId} AND tenant_id = ${auth.tenantId}
       AND deleted_at IS NULL
     ORDER BY created_at DESC
  `);
  const rows = (fetched as unknown as Record<string, unknown>[]) || [];
  return c.json({ success: true, data: rows.map(rowToEvidence) });
});

/**
 * POST /:id/evidence — attach one pre-captured photo / document to a
 * case. Accepts multipart/form-data:
 *   file     (required)  the image / pdf bytes
 *   metadata (optional)  JSON string { caption?, fileName? }
 *
 * Flow: verify the case is the caller's tenant → validate mime + size →
 * stream the bytes into the tenant-scoped storage provider → insert the
 * durable `evidence_attachments` row → best-effort mirror the URL into
 * the `cases.photos` jsonb display cache. Returns the created row.
 *
 * `pending_evidence` status semantics are intentionally left untouched:
 * adding evidence never auto-advances a case's status — that transition
 * is owned by the case-management workflow, not the intake upload.
 */
app.post('/:id/evidence', withSecurityEvents({ action: 'case.create', resource: 'case', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) {
    return c.json(
      { success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database client is not initialized' } },
      503,
    );
  }
  const caseId = c.req.param('id');

  // ── 1. Tenant-scoped case ownership check ──────────────────────────
  const owner = await db.execute(sql`
    SELECT id FROM cases WHERE id = ${caseId} AND tenant_id = ${auth.tenantId} LIMIT 1
  `);
  if (((owner as unknown as Record<string, unknown>[]) || []).length === 0) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }

  // ── 2. Parse multipart body ────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await c.req.parseBody({ all: false });
  } catch {
    return c.json(
      { success: false, error: { code: 'INVALID_FILE', message: 'Could not parse multipart body' } },
      400,
    );
  }

  const fileField = body.file;
  if (!(fileField instanceof File)) {
    return c.json(
      { success: false, error: { code: 'INVALID_FILE', message: 'Missing required field: file' } },
      400,
    );
  }
  const file: File = fileField;

  // ── 3. Mime allowlist ──────────────────────────────────────────────
  const mimeType = (file.type || '').toLowerCase();
  if (!ALLOWED_EVIDENCE_MIMES.includes(mimeType)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNSUPPORTED_MIME',
          message: `Unsupported file type. Allowed: ${ALLOWED_EVIDENCE_MIMES.join(', ')}`,
        },
      },
      400,
    );
  }

  // ── 4. Size guard (pre-read) ───────────────────────────────────────
  if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
    return c.json(
      { success: false, error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${MAX_EVIDENCE_SIZE_BYTES} byte limit` } },
      413,
    );
  }

  // ── 5. Optional metadata ───────────────────────────────────────────
  let caption: string | null = null;
  let overrideName: string | null = null;
  const rawMeta = body.metadata;
  if (typeof rawMeta === 'string' && rawMeta.length > 0) {
    let metaJson: unknown;
    try {
      metaJson = JSON.parse(rawMeta);
    } catch {
      return c.json(
        { success: false, error: { code: 'INVALID_METADATA', message: 'metadata field must be valid JSON' } },
        400,
      );
    }
    const parsed = EvidenceMetaSchema.safeParse(metaJson);
    if (!parsed.success) {
      return c.json(
        { success: false, error: { code: 'INVALID_METADATA', message: 'metadata failed schema validation', issues: parsed.error.issues } },
        400,
      );
    }
    caption = parsed.data.caption ?? null;
    overrideName = parsed.data.fileName ?? null;
  }

  // ── 6. Resolve the storage provider ────────────────────────────────
  // The composition root wires `documentStorage.provider` onto the
  // service registry (Supabase Storage in prod, local disk in dev). We
  // structurally type the slice we use — `upload({ tenantId, key,
  // content, contentType, metadata }) → { url }` — rather than importing
  // the StorageProvider interface from the domain-services `dist` subpath
  // (keeps this router free of a build-order coupling).
  type EvidenceStorage = {
    upload(input: {
      tenantId: string;
      key: string;
      content: Buffer;
      contentType: string;
      metadata?: Record<string, string>;
    }): Promise<{ url: string }>;
  };
  const services = (c.get('services') ?? {}) as {
    documentStorage?: { provider?: EvidenceStorage };
  };
  const storage = services.documentStorage?.provider;
  if (!storage) {
    return c.json(
      { success: false, error: { code: 'STORAGE_UNAVAILABLE', message: 'Object storage is not configured' } },
      503,
    );
  }

  // ── 7. Read bytes + persist the blob ───────────────────────────────
  const fileName = (overrideName ?? file.name ?? 'evidence').toString();
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return c.json(
      { success: false, error: { code: 'INVALID_FILE', message: 'Could not read uploaded bytes' } },
      400,
    );
  }
  // Belt-and-braces: re-check the real byte length (the multipart parser
  // is allowed to under-report `file.size`).
  if (buffer.byteLength > MAX_EVIDENCE_SIZE_BYTES) {
    return c.json(
      { success: false, error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${MAX_EVIDENCE_SIZE_BYTES} byte limit` } },
      413,
    );
  }

  const attachmentId = crypto.randomUUID();
  // Tenant isolation in the storage key is enforced inside the provider
  // (`tenantScopedPath`); the case-scoped prefix keeps a case's evidence
  // grouped and the attachment id guarantees per-file uniqueness. The
  // filename is sanitised to a flat token so it can never traverse.
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
  const storageKey = `cases/${caseId}/evidence/${attachmentId}-${safeName}`;

  let storedUrl: string;
  try {
    const uploaded = await storage.upload({
      tenantId: auth.tenantId,
      key: storageKey,
      content: buffer,
      contentType: mimeType,
      metadata: { caseId, uploadedBy: auth.userId },
    });
    storedUrl = uploaded.url;
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'STORAGE_WRITE_FAILED',
          message: err instanceof Error ? err.message : 'Failed to store the uploaded file',
        },
      },
      502,
    );
  }

  // ── 8. Insert the durable evidence row ─────────────────────────────
  const inserted = await db.execute(sql`
    INSERT INTO evidence_attachments (
      id, tenant_id, case_id, uploaded_by, file_name, file_url,
      mime_type, file_size_bytes, description, created_at
    ) VALUES (
      ${attachmentId}, ${auth.tenantId}, ${caseId}, ${auth.userId},
      ${fileName}, ${storedUrl}, ${mimeType}, ${buffer.byteLength},
      ${caption}, NOW()
    )
    RETURNING *
  `);
  const row = (inserted as unknown as Record<string, unknown>[])[0];

  // ── 9. Mirror images into the cases.photos display cache ───────────
  // Best-effort only — the authoritative row is already committed. A
  // failure to update the cache must NOT fail the request (and must not
  // claim the upload failed). PDFs are evidence-only, not photos.
  if (isImageMime(mimeType)) {
    try {
      await db.execute(sql`
        UPDATE cases
           SET photos = COALESCE(photos, '[]'::jsonb) || ${JSON.stringify([{ name: fileName, url: storedUrl }])}::jsonb,
               updated_at = NOW()
         WHERE id = ${caseId} AND tenant_id = ${auth.tenantId}
      `);
    } catch {
      // Cache update is non-fatal; the evidence row remains the source of truth.
    }
  }

  return c.json({ success: true, data: rowToEvidence(row) }, 201);
}));

app.post('/:id/resolve', zValidator('json', CaseResolveSchema), withSecurityEvents({ action: 'case.create', resource: 'case', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!db) {
    return c.json(
      { success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database client is not initialized' } },
      503,
    );
  }
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const updated = await db.execute(sql`
    UPDATE cases
       SET status = 'resolved'::case_status,
           resolved_at = NOW(),
           resolved_by = ${auth.userId},
           closure_reason = ${body.closureReason || body.resolution || null},
           updated_at = NOW(),
           updated_by = ${auth.userId}
     WHERE id = ${id} AND tenant_id = ${auth.tenantId}
     RETURNING *
  `);
  const rows = (updated as unknown as Record<string, unknown>[]) || [];
  if (rows.length === 0) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
      404,
    );
  }
  return c.json({ success: true, data: rowToCase(rows[0]) });
}));

export const casesRouter = app;
