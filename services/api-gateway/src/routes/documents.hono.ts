import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { paginateArray } from './db-mappers';

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

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
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
});

app.put('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const body = await c.req.json();
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
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  await repos.documents.delete(c.req.param('id'), auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'Document deleted' } });
});

export const documentsHonoRouter = app;
