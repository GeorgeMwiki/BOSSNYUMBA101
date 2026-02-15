/**
 * Documents API routes - Hono with Zod validation
 * Database-first with mock data fallback
 * POST /, GET /, GET /:id, DELETE /:id, GET /:id/url
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware, generateId, buildPaginationResponse } from '../middleware/database';
import {
  idParamSchema,
  paginationQuerySchema,
  validationErrorHook,
} from './validators';
import { DEMO_DOCUMENTS, getByTenant, getById, paginate } from '../data/mock-data';
import { z } from 'zod';

const app = new Hono();

const uploadDocumentSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  name: z.string().min(1, 'Name is required').max(255),
  relatedEntityType: z.enum(['property', 'unit', 'lease', 'customer', 'work_order', 'invoice']).optional(),
  relatedEntityId: z.string().optional(),
  url: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listDocumentsQuerySchema = paginationQuerySchema.extend({
  type: z.string().optional(),
  status: z.string().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
});

app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function errorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  status: 404,
  code: string,
  message: string
) {
  return c.json({ success: false, error: { code, message } }, status);
}

// POST /documents - Upload document
app.post(
  '/',
  zValidator('json', uploadDocumentSchema, validationErrorHook),
  async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const id = generateId();
        const fileUrl = body.url ?? `https://storage.example.com/docs/${Date.now()}`;

        const document = await repos.documents.create({
          id,
          tenantId: auth.tenantId,
          documentType: body.type as any,
          status: 'uploaded' as any,
          source: 'app_upload' as any,
          fileName: body.name,
          fileSize: 0,
          mimeType: 'application/octet-stream',
          fileUrl,
          entityType: body.relatedEntityType,
          entityId: body.relatedEntityId,
          metadata: body.metadata ?? {},
          createdBy: auth.userId,
          updatedBy: auth.userId,
        });

        return c.json({
          success: true,
          data: {
            id: document.id,
            tenantId: document.tenantId,
            type: document.documentType,
            name: document.fileName,
            relatedEntityType: document.entityType,
            relatedEntityId: document.entityId,
            url: document.fileUrl,
            verificationStatus: document.status,
            metadata: document.metadata,
            createdAt: document.createdAt,
            createdBy: document.createdBy,
          },
        }, 201);
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const document = {
      id: `doc-${Date.now()}`,
      tenantId: auth.tenantId,
      type: body.type,
      name: body.name,
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
      url: body.url ?? `https://storage.example.com/docs/${Date.now()}`,
      verificationStatus: 'PENDING',
      metadata: body.metadata ?? {},
      createdAt: new Date().toISOString(),
      createdBy: auth.userId,
    };

    return c.json({ success: true, data: document }, 201);
  }
);

// GET /documents - List documents
app.get('/', zValidator('query', listDocumentsQuerySchema), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize, type, status, relatedEntityType, relatedEntityId } = c.req.valid('query');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const offset = (page - 1) * pageSize;
      const result = await repos.documents.findMany(auth.tenantId, {
        documentType: type,
        status,
        entityType: relatedEntityType,
        entityId: relatedEntityId,
        limit: pageSize,
        offset,
      });

      // Map DB rows to expected response shape
      const data = result.items.map((doc) => ({
        id: doc.id,
        tenantId: doc.tenantId,
        type: doc.documentType,
        name: doc.fileName,
        relatedEntityType: doc.entityType,
        relatedEntityId: doc.entityId,
        url: doc.fileUrl,
        verificationStatus: doc.status,
        metadata: doc.metadata,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy,
      }));

      return c.json({
        success: true,
        data,
        pagination: buildPaginationResponse(page, pageSize, result.total),
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  let documents = getByTenant(DEMO_DOCUMENTS, auth.tenantId);

  if (type) documents = documents.filter((d) => d.type === type);
  if (status) documents = documents.filter((d) => d.verificationStatus === status);
  if (relatedEntityType) documents = documents.filter((d) => d.relatedEntityType === relatedEntityType);
  if (relatedEntityId) documents = documents.filter((d) => d.relatedEntityId === relatedEntityId);

  documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const result = paginate(documents, page, pageSize);

  return c.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

// GET /documents/:id/url - Get signed URL (must be before /:id)
app.get('/:id/url', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const document = await repos.documents.findById(id, auth.tenantId);
      if (!document) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Document not found');
      }

      const signedUrl = `${document.fileUrl}?token=signed-${Date.now()}&expires=3600`;

      return c.json({
        success: true,
        data: {
          url: signedUrl,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const document = getById(DEMO_DOCUMENTS, id);

  if (!document || document.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Document not found');
  }

  const signedUrl = `https://storage.example.com/docs/${id}?token=signed-${Date.now()}&expires=3600`;

  return c.json({
    success: true,
    data: {
      url: signedUrl,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    },
  });
});

// GET /documents/:id - Get document
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const doc = await repos.documents.findById(id, auth.tenantId);
      if (!doc) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Document not found');
      }

      return c.json({
        success: true,
        data: {
          id: doc.id,
          tenantId: doc.tenantId,
          type: doc.documentType,
          name: doc.fileName,
          relatedEntityType: doc.entityType,
          relatedEntityId: doc.entityId,
          url: doc.fileUrl,
          verificationStatus: doc.status,
          metadata: doc.metadata,
          createdAt: doc.createdAt,
          createdBy: doc.createdBy,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const document = getById(DEMO_DOCUMENTS, id);

  if (!document || document.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Document not found');
  }

  return c.json({
    success: true,
    data: document,
  });
});

// DELETE /documents/:id - Delete document
app.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const document = await repos.documents.findById(id, auth.tenantId);
      if (!document) {
        return errorResponse(c, 404, 'NOT_FOUND', 'Document not found');
      }

      await repos.documents.delete(id, auth.tenantId, auth.userId);

      return c.json({
        success: true,
        data: { id, message: 'Document deleted' },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const document = getById(DEMO_DOCUMENTS, id);

  if (!document || document.tenantId !== auth.tenantId) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Document not found');
  }

  return c.json({
    success: true,
    data: { id, message: 'Document deleted' },
  });
});

export const documentsHonoRouter = app;
