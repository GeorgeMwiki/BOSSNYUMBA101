
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { paginateArray } from './db-mappers';

import { withSecurityEvents } from '@bossnyumba/observability';
// Document uploads are metadata records; the blob itself is uploaded to
// object storage beforehand and referenced by `url`. We cap size at 50MB
// (matches most WhatsApp/document gateway limits) and enforce a mime
// allowlist server-side so clients can't sneak executables past the UI.
const MAX_DOC_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
];
const DocumentCreateSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().refine((m) => ALLOWED_MIMES.includes(m), 'mime type not allowed'),
  size: z.number().int().positive().max(MAX_DOC_SIZE_BYTES),
  url: z.string().url(),
  type: z.string().max(50).optional(),
  customerId: z.string().optional(),
  relatedEntityType: z.string().max(50).optional(),
  relatedEntityId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
const DocumentUpdateSchema = z.object({
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.string().optional(),
  relatedEntityType: z.string().max(50).optional(),
  relatedEntityId: z.string().optional(),
});

// E-sign capture. The renter's mobile client posts an opaque attestation
// (a biometric token, a drawn-signature blob reference, or a typed/otp/click
// confirmation). We accept either `signaturePayload` (canonical) or the
// `biometricToken` alias the tenant-mobile client historically sent, and
// normalise to a single non-empty payload. Signer identity is taken from the
// JWT, NEVER the body.
const DocumentSignSchema = z
  .object({
    signaturePayload: z.string().min(1).max(4096).optional(),
    biometricToken: z.string().min(1).max(4096).optional(),
    signatureMethod: z
      .enum(['biometric', 'drawn', 'typed', 'otp', 'click'])
      .optional(),
  })
  .refine((b) => Boolean(b.signaturePayload) || Boolean(b.biometricToken), {
    message: 'signaturePayload (or biometricToken) is required',
  });

// Normalise drizzle `.execute()` results — pg returns `{ rows: [...] }`,
// other drivers return the array directly.
function rowsOf(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = raw.rows;
    if (Array.isArray(r)) return r;
  }
  return [];
}

function mapDocumentStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'validated':
      return 'VERIFIED';
    case 'rejected':
      return 'REJECTED';
    default:
      return 'PENDING';
  }
}

function mapDocumentType(type) {
  switch (String(type || '').toLowerCase()) {
    case 'lease_agreement':
      return 'LEASE';
    case 'move_in_report':
    case 'move_out_report':
      return 'INSPECTION_REPORT';
    case 'receipt':
      return 'RECEIPT';
    case 'notice':
      return 'NOTICE';
    case 'national_id':
    case 'passport':
    case 'driving_license':
    case 'work_permit':
    case 'residence_permit':
      return 'ID_DOCUMENT';
    default:
      return String(type || 'OTHER').toUpperCase();
  }
}

function mapCategory(type) {
  switch (type) {
    case 'LEASE':
      return 'leases';
    case 'RECEIPT':
    case 'INVOICE':
    case 'STATEMENT':
      return 'financial';
    case 'NOTICE':
      return 'compliance';
    case 'INSPECTION_REPORT':
      return 'reports';
    case 'ID_DOCUMENT':
      return 'identity';
    default:
      return 'other';
  }
}

function mapDocumentRow(row) {
  const type = mapDocumentType(row.documentType);
  const metadata = row.metadata || {};
  return {
    id: row.id,
    type,
    category: mapCategory(type),
    name: row.fileName,
    mimeType: row.mimeType,
    size: row.fileSize,
    url: row.fileUrl,
    verificationStatus: mapDocumentStatus(row.status),
    verifiedAt: row.verifiedAt,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    property: metadata.propertyId
      ? { id: metadata.propertyId, name: metadata.propertyName || metadata.propertyId }
      : undefined,
    unit: metadata.unitId
      ? { id: metadata.unitId, unitNumber: metadata.unitNumber || metadata.unitId }
      : undefined,
    customer: row.customerId
      ? {
          id: row.customerId,
          name: metadata.customerName || row.customerId,
        }
      : undefined,
    requiresSignature: Boolean(metadata.requiresSignature),
    signatureStatus: metadata.signedAt ? 'SIGNED' : metadata.requiresSignature ? 'PENDING' : undefined,
    signedAt: metadata.signedAt,
    signedBy: metadata.signedBy,
  };
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const type = c.req.query('type');
  const status = c.req.query('status');
  const relatedEntityType = c.req.query('relatedEntityType');
  const relatedEntityId = c.req.query('relatedEntityId');
  const customerId = c.req.query('customerId');

  const result = await repos.documents.findMany(auth.tenantId, {
    documentType:
      type === 'LEASE'
        ? 'lease_agreement'
        : type === 'ID_DOCUMENT'
        ? 'national_id'
        : type?.toLowerCase(),
    status:
      status === 'VERIFIED'
        ? 'validated'
        : status === 'REJECTED'
        ? 'rejected'
        : status
        ? 'uploaded'
        : undefined,
    entityType: relatedEntityType,
    entityId: relatedEntityId,
    customerId,
    limit: 2000,
    offset: 0,
  });

  const paginated = paginateArray(result.items.map(mapDocumentRow), page, pageSize);
  return c.json({ success: true, data: paginated.data, pagination: paginated.pagination });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const row = await repos.documents.findById(c.req.param('id'), auth.tenantId);

  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  return c.json({ success: true, data: mapDocumentRow(row) });
});

app.post('/', zValidator('json', DocumentCreateSchema), withSecurityEvents({ action: 'document.create', resource: 'document', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');
  const documentType =
    body.type === 'LEASE'
      ? 'lease_agreement'
      : body.type === 'ID_DOCUMENT'
      ? 'national_id'
      : String(body.type || 'other').toLowerCase();

  const row = await repos.documents.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    customerId: body.customerId,
    documentType,
    status: 'uploaded',
    source: 'api',
    fileName: body.name,
    fileSize: body.size,
    mimeType: body.mimeType,
    fileUrl: body.url,
    entityType: body.relatedEntityType,
    entityId: body.relatedEntityId,
    tags: body.tags || [],
    metadata: body.metadata || {},
    createdBy: auth.userId,
    updatedBy: auth.userId,
  });

  return c.json({ success: true, data: mapDocumentRow(row) }, 201);
}));

app.put('/:id', zValidator('json', DocumentUpdateSchema), withSecurityEvents({ action: 'document.update', resource: 'document', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = c.req.valid('json');
  const existing = await repos.documents.findById(c.req.param('id'), auth.tenantId);

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const row = await repos.documents.update(c.req.param('id'), auth.tenantId, {
    fileName: body.name ?? existing.fileName,
    tags: body.tags ?? existing.tags,
    status:
      body.verificationStatus === 'VERIFIED'
        ? 'validated'
        : body.verificationStatus === 'REJECTED'
        ? 'rejected'
        : existing.status,
    verifiedAt: body.verificationStatus === 'VERIFIED' ? new Date() : existing.verifiedAt,
    verifiedBy: body.verificationStatus === 'VERIFIED' ? auth.userId : existing.verifiedBy,
    rejectedAt: body.verificationStatus === 'REJECTED' ? new Date() : existing.rejectedAt,
    rejectedBy: body.verificationStatus === 'REJECTED' ? auth.userId : existing.rejectedBy,
    updatedBy: auth.userId,
  });

  return c.json({ success: true, data: mapDocumentRow(row) });
}));

// ----------------------------------------------------------------------------
// POST /:id/sign — capture a renter's e-signature on a document.
//
// Identity comes from the JWT (signer_id = userId, signer_role = role), NEVER
// the body. Uniform-404 when the document is not the caller's (RLS-scoped
// findById returns null → 404; this is the anti-IDOR guard). Idempotent: the
// FIRST signature for (tenant, document, signer) wins and is immutable — a
// double-submit / retry returns the existing signature unchanged (200) rather
// than minting a duplicate or mutating the original.
// ----------------------------------------------------------------------------
app.post(
  '/:id/sign',
  zValidator('json', DocumentSignSchema),
  withSecurityEvents(
    { action: 'document.sign', resource: 'document', severity: 'notice' },
    async (c) => {
      const auth = c.get('auth');
      const repos = c.get('repos');
      const db = c.get('db') as
        | { execute(q: unknown): Promise<unknown> }
        | null
        | undefined;
      const documentId = c.req.param('id');
      const body = c.req.valid('json');

      // Degrade honestly when no live DB is configured (mock mode / tests):
      // we cannot persist a signature, so surface 503 rather than fake success.
      if (!db || !repos) {
        return c.json(
          {
            success: false,
            error: {
              code: 'LIVE_DATA_NOT_CONFIGURED',
              message: 'A live database connection is required to sign.',
            },
          },
          503,
        );
      }

      // Anti-IDOR: findById is RLS + tenant scoped. A document that is not the
      // caller's (or does not exist) returns null → uniform 404. We never leak
      // existence of another tenant's / customer's document.
      const document = await repos.documents.findById(documentId, auth.tenantId);
      if (!document) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Document not found' },
          },
          404,
        );
      }

      const signaturePayload = String(
        body.signaturePayload ?? body.biometricToken ?? '',
      );
      const signatureMethod = body.signatureMethod ?? 'biometric';
      const signerId = auth.userId;
      const signerRole = String(auth.role ?? 'tenant');
      const signedAtIso = new Date().toISOString();

      // Tamper-evident audit hash over the canonical signed fields.
      const auditHash = createHash('sha256')
        .update(
          [
            auth.tenantId,
            documentId,
            signerId,
            signedAtIso,
            signaturePayload,
          ].join('|'),
        )
        .digest('hex');

      const ipAddress =
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
      const userAgent = c.req.header('user-agent') ?? null;

      // Idempotent insert: the first signature wins (DO NOTHING preserves the
      // original signed_at / payload / hash). We then SELECT the canonical row
      // so a retry returns the SAME signature, never a duplicate.
      const rows = rowsOf(
        await db.execute(sql`
          WITH ins AS (
            INSERT INTO document_signatures (
              tenant_id, document_id, signer_id, signer_role,
              signature_payload, signature_method, signed_at,
              audit_hash, ip_address, user_agent
            ) VALUES (
              ${auth.tenantId}, ${documentId}, ${signerId}, ${signerRole},
              ${signaturePayload}, ${signatureMethod}, ${signedAtIso}::timestamptz,
              ${auditHash}, ${ipAddress}, ${userAgent}
            )
            ON CONFLICT (tenant_id, document_id, signer_id) DO NOTHING
            RETURNING id::text AS id, signer_id, signer_role, signature_method,
                      signed_at, audit_hash
          )
          SELECT id, signer_id, signer_role, signature_method, signed_at,
                 audit_hash, true AS created
            FROM ins
          UNION ALL
          SELECT id::text AS id, signer_id, signer_role, signature_method,
                 signed_at, audit_hash, false AS created
            FROM document_signatures
           WHERE tenant_id = ${auth.tenantId}
             AND document_id = ${documentId}
             AND signer_id = ${signerId}
             AND NOT EXISTS (SELECT 1 FROM ins)
          LIMIT 1
        `),
      );

      const row = rows[0];
      if (!row) {
        // The insert was dropped (RLS) AND no prior row is visible — surface
        // honestly rather than faking success.
        return c.json(
          {
            success: false,
            error: {
              code: 'SIGN_FAILED',
              message: 'Signature could not be recorded.',
            },
          },
          500,
        );
      }

      const created = row.created === true || row.created === 't';

      // Stamp the document's own signature mirror so list/detail reads reflect
      // the signed state (the mapper reads metadata.signedAt / signedBy).
      const mergedMetadata = {
        ...(document.metadata && typeof document.metadata === 'object'
          ? (document.metadata as Record<string, unknown>)
          : {}),
        requiresSignature: true,
        signedAt: row.signed_at ?? signedAtIso,
        signedBy: signerId,
      };
      let signedDocument = document;
      try {
        signedDocument =
          (await repos.documents.update(documentId, auth.tenantId, {
            metadata: mergedMetadata,
            updatedBy: signerId,
          })) ?? document;
      } catch {
        // Mirror-stamp is best-effort: the canonical signature record already
        // landed in document_signatures. Do not fail the request if the
        // convenience mirror update faults.
        signedDocument = document;
      }

      return c.json(
        {
          success: true,
          data: {
            ...mapDocumentRow(signedDocument),
            signature: {
              id: String(row.id),
              signerId: String(row.signer_id),
              signerRole: String(row.signer_role),
              method: String(row.signature_method),
              signedAt: row.signed_at ?? signedAtIso,
              auditHash: String(row.audit_hash),
            },
          },
        },
        created ? 201 : 200,
      );
    },
  ),
);

app.delete('/:id', withSecurityEvents({ action: 'document.delete', resource: 'document', severity: 'notice' }, async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  await repos.documents.delete(c.req.param('id'), auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Document deleted' } });
}));

export const documentsHonoRouter = app;
