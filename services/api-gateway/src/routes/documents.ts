import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { DEMO_DOCUMENTS, getByTenant, getById, paginate } from '../data/mock-data';

export const documentsRouter = Router();

// GET /documents - List documents
documentsRouter.get('/', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { page = '1', pageSize = '10', type, status, relatedEntityType, relatedEntityId } = req.query;

  let documents = getByTenant(DEMO_DOCUMENTS, auth.tenantId);

  // Filter by type
  if (type) {
    documents = documents.filter((d) => d.type === type);
  }

  // Filter by verification status
  if (status) {
    documents = documents.filter((d) => d.verificationStatus === status);
  }

  // Filter by related entity
  if (relatedEntityType) {
    documents = documents.filter((d) => d.relatedEntityType === relatedEntityType);
  }
  if (relatedEntityId) {
    documents = documents.filter((d) => d.relatedEntityId === relatedEntityId);
  }

  // Sort by creation date
  documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const result = paginate(documents, Number(page), Number(pageSize));

  res.json({
    success: true,
    ...result,
  });
});

// GET /documents/:id - Get document by ID
documentsRouter.get('/:id', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { id } = req.params;

  const document = getById(DEMO_DOCUMENTS, id);

  if (!document || document.tenantId !== auth.tenantId) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Document not found' },
    });
  }

  res.json({
    success: true,
    data: document,
  });
});
