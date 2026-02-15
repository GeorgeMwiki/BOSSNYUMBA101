/**
 * Documents API routes - Module G (Enhanced)
 * POST /api/v1/documents/upload - Upload document
 * POST /api/v1/documents/verify - Verify document (OCR + fraud check)
 * GET  /api/v1/documents/:customerId - Get customer documents
 * POST /api/v1/evidence-packs - Generate evidence pack
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/hono-auth';
import { validationErrorHook } from '../validators';

const app = new Hono();

// Schemas
const uploadSchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(['id_document', 'proof_of_income', 'bank_statement', 'utility_bill', 'lease_agreement', 'insurance', 'employment_letter', 'reference_letter', 'photo', 'other']),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  url: z.string().url(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const verifySchema = z.object({
  documentId: z.string().min(1),
  verificationTypes: z.array(z.enum(['ocr', 'fraud_check', 'expiry_check', 'authenticity', 'face_match'])).min(1),
  referenceData: z.object({
    expectedName: z.string().optional(),
    expectedIdNumber: z.string().optional(),
    faceImageUrl: z.string().url().optional(),
  }).optional(),
});

const customerIdSchema = z.object({ customerId: z.string().min(1) });

const evidencePackSchema = z.object({
  customerId: z.string().min(1),
  caseId: z.string().optional(),
  packType: z.enum(['lease_application', 'eviction', 'deposit_dispute', 'maintenance_claim', 'insurance_claim', 'legal_proceedings', 'custom']),
  includeDocuments: z.array(z.string()).optional(),
  includePaymentHistory: z.boolean().default(true),
  includeMaintenanceHistory: z.boolean().default(false),
  includeCommunications: z.boolean().default(false),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }).optional(),
  notes: z.string().max(2000).optional(),
});

const idSchema = z.object({ id: z.string().min(1) });

// In-memory storage
interface Document {
  id: string;
  tenantId: string;
  customerId: string;
  type: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  metadata: Record<string, unknown>;
  tags: string[];
  verificationStatus: string;
  verificationResults?: VerificationResult;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

interface VerificationResult {
  status: string;
  confidence: number;
  checks: Array<{
    type: string;
    passed: boolean;
    confidence: number;
    details: Record<string, unknown>;
    checkedAt: string;
  }>;
  extractedData?: Record<string, unknown>;
  riskScore: number;
  verifiedAt: string;
  verifiedBy: string;
}

interface EvidencePack {
  id: string;
  tenantId: string;
  customerId: string;
  caseId?: string;
  packType: string;
  status: string;
  documents: Array<{ id: string; name: string; type: string; url: string }>;
  paymentHistory?: Array<{ date: string; amount: number; status: string; reference: string }>;
  maintenanceHistory?: Array<{ date: string; title: string; status: string; resolution?: string }>;
  communications?: Array<{ date: string; channel: string; summary: string }>;
  summary: { totalDocuments: number; dateRange: { from: string; to: string }; generatedAt: string };
  downloadUrl?: string;
  expiresAt?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

const documents = new Map<string, Document>();
const evidencePacks = new Map<string, EvidencePack>();

// Seed demo data
documents.set('doc-001', {
  id: 'doc-001', tenantId: 'tenant-001', customerId: 'customer-001', type: 'id_document',
  name: 'National ID - James Mkenda', mimeType: 'image/jpeg', size: 125000,
  url: 'https://storage.example.com/docs/id-001.jpg', metadata: {}, tags: ['id', 'verified'],
  verificationStatus: 'verified',
  verificationResults: {
    status: 'passed', confidence: 0.95, riskScore: 5,
    checks: [
      { type: 'ocr', passed: true, confidence: 0.98, details: { name: 'James Mkenda', idNumber: 'TZ-123456789' }, checkedAt: '2026-02-01T10:00:00Z' },
      { type: 'fraud_check', passed: true, confidence: 0.92, details: { tampering: false }, checkedAt: '2026-02-01T10:00:05Z' },
    ],
    extractedData: { name: 'James Mkenda', idNumber: 'TZ-123456789', dateOfBirth: '1985-06-15', expiryDate: '2028-12-31' },
    verifiedAt: '2026-02-01T10:00:10Z', verifiedBy: 'system',
  },
  createdAt: '2026-02-01T09:00:00Z', createdBy: 'user-002', updatedAt: '2026-02-01T10:00:10Z',
});

// Helpers
const genId = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;

app.use('*', authMiddleware);

// POST /upload - Upload document
app.post('/upload', zValidator('json', uploadSchema, validationErrorHook), (c) => {
  const auth = c.get('auth'), body = c.req.valid('json'), now = new Date().toISOString();
  
  const doc: Document = {
    id: genId('doc'),
    tenantId: auth.tenantId,
    customerId: body.customerId,
    type: body.type,
    name: body.name,
    mimeType: body.mimeType,
    size: body.size,
    url: body.url,
    metadata: body.metadata ?? {},
    tags: body.tags ?? [],
    verificationStatus: 'pending',
    createdAt: now,
    createdBy: auth.userId,
    updatedAt: now,
  };
  
  documents.set(doc.id, doc);
  
  return c.json({
    success: true,
    data: {
      ...doc,
      message: 'Document uploaded successfully',
      verificationRequired: ['id_document', 'proof_of_income', 'bank_statement'].includes(body.type),
    },
  }, 201);
});

// POST /verify - Verify document (OCR + fraud check)
app.post('/verify', zValidator('json', verifySchema, validationErrorHook), (c) => {
  const auth = c.get('auth'), body = c.req.valid('json'), now = new Date().toISOString();
  
  const doc = documents.get(body.documentId);
  if (!doc || doc.tenantId !== auth.tenantId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }
  
  // Simulate verification results
  const checks = body.verificationTypes.map(type => {
    const passed = Math.random() > 0.1; // 90% pass rate for demo
    const confidence = 0.85 + Math.random() * 0.15;
    
    let details: Record<string, unknown> = {};
    if (type === 'ocr') {
      details = { name: 'James Mkenda', idNumber: 'TZ-123456789', dateOfBirth: '1985-06-15' };
    } else if (type === 'fraud_check') {
      details = { tampering: false, photoManipulation: false, documentAgeConsistent: true };
    } else if (type === 'expiry_check') {
      details = { expiryDate: '2028-12-31', isExpired: false, daysUntilExpiry: 1051 };
    } else if (type === 'authenticity') {
      details = { securityFeatures: true, formatValid: true, issuerVerified: true };
    } else if (type === 'face_match') {
      details = { matchScore: confidence, matchThreshold: 0.80 };
    }
    
    return { type, passed, confidence, details, checkedAt: now };
  });
  
  const allPassed = checks.every(c => c.passed);
  const avgConfidence = checks.reduce((sum, c) => sum + c.confidence, 0) / checks.length;
  const riskScore = allPassed ? Math.round((1 - avgConfidence) * 100) : Math.round((1 - avgConfidence) * 100) + 50;
  
  const extractedData = checks.find(c => c.type === 'ocr')?.details ?? {};
  
  const verificationResult: VerificationResult = {
    status: allPassed ? 'passed' : 'failed',
    confidence: avgConfidence,
    checks,
    extractedData,
    riskScore,
    verifiedAt: now,
    verifiedBy: auth.userId,
  };
  
  doc.verificationStatus = allPassed ? 'verified' : 'failed';
  doc.verificationResults = verificationResult;
  doc.updatedAt = now;
  documents.set(doc.id, doc);
  
  return c.json({
    success: true,
    data: {
      documentId: doc.id,
      verificationResult,
      recommendation: allPassed ? 'APPROVE' : 'MANUAL_REVIEW',
      message: allPassed ? 'Document verification passed' : 'Document verification failed - manual review required',
    },
  });
});

// GET /:customerId - Get customer documents
app.get('/:customerId', zValidator('param', customerIdSchema), (c) => {
  const auth = c.get('auth'), { customerId } = c.req.valid('param');
  
  const customerDocs = [...documents.values()]
    .filter(d => d.tenantId === auth.tenantId && d.customerId === customerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const byType = customerDocs.reduce((acc, doc) => {
    acc[doc.type] = acc[doc.type] || [];
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);
  
  const verificationSummary = {
    total: customerDocs.length,
    verified: customerDocs.filter(d => d.verificationStatus === 'verified').length,
    pending: customerDocs.filter(d => d.verificationStatus === 'pending').length,
    failed: customerDocs.filter(d => d.verificationStatus === 'failed').length,
  };
  
  return c.json({
    success: true,
    data: {
      customerId,
      documents: customerDocs,
      byType,
      verificationSummary,
    },
  });
});

// GET /document/:id - Get single document
app.get('/document/:id', zValidator('param', idSchema), (c) => {
  const auth = c.get('auth'), { id } = c.req.valid('param');
  const doc = documents.get(id);
  
  if (!doc || doc.tenantId !== auth.tenantId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }
  
  return c.json({ success: true, data: doc });
});

export const documentsEnhancedRouter = app;

// Separate router for evidence packs
const evidenceApp = new Hono();
evidenceApp.use('*', authMiddleware);

// POST /evidence-packs - Generate evidence pack
evidenceApp.post('/', zValidator('json', evidencePackSchema, validationErrorHook), (c) => {
  const auth = c.get('auth'), body = c.req.valid('json'), now = new Date().toISOString();
  
  // Gather documents
  const customerDocs = [...documents.values()]
    .filter(d => d.tenantId === auth.tenantId && d.customerId === body.customerId);
  
  const includedDocs = body.includeDocuments 
    ? customerDocs.filter(d => body.includeDocuments!.includes(d.id))
    : customerDocs;
  
  // Build evidence pack
  const pack: EvidencePack = {
    id: genId('evpack'),
    tenantId: auth.tenantId,
    customerId: body.customerId,
    caseId: body.caseId,
    packType: body.packType,
    status: 'generated',
    documents: includedDocs.map(d => ({ id: d.id, name: d.name, type: d.type, url: d.url })),
    summary: {
      totalDocuments: includedDocs.length,
      dateRange: body.dateRange ?? { from: '2026-01-01', to: now.split('T')[0] },
      generatedAt: now,
    },
    notes: body.notes,
    createdAt: now,
    createdBy: auth.userId,
  };
  
  // Add payment history if requested
  if (body.includePaymentHistory) {
    pack.paymentHistory = [
      { date: '2026-02-03', amount: 2500000, status: 'completed', reference: 'PAY-2026-001' },
      { date: '2026-01-03', amount: 2500000, status: 'completed', reference: 'PAY-2026-000' },
    ];
  }
  
  // Add maintenance history if requested
  if (body.includeMaintenanceHistory) {
    pack.maintenanceHistory = [
      { date: '2026-02-10', title: 'Kitchen sink leak', status: 'in_progress' },
      { date: '2026-01-20', title: 'AC filter replacement', status: 'completed', resolution: 'Filter replaced' },
    ];
  }
  
  // Add communications if requested
  if (body.includeCommunications) {
    pack.communications = [
      { date: '2026-02-10', channel: 'whatsapp', summary: 'Maintenance request submitted' },
      { date: '2026-02-01', channel: 'email', summary: 'Invoice sent for February rent' },
    ];
  }
  
  // Generate download URL
  pack.downloadUrl = `https://storage.example.com/evidence-packs/${pack.id}.zip`;
  pack.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  
  evidencePacks.set(pack.id, pack);
  
  return c.json({
    success: true,
    data: {
      ...pack,
      message: 'Evidence pack generated successfully',
    },
  }, 201);
});

// GET /evidence-packs/:id - Get evidence pack
evidenceApp.get('/:id', zValidator('param', idSchema), (c) => {
  const auth = c.get('auth'), { id } = c.req.valid('param');
  const pack = evidencePacks.get(id);
  
  if (!pack || pack.tenantId !== auth.tenantId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Evidence pack not found' } }, 404);
  }
  
  return c.json({ success: true, data: pack });
});

export const evidencePacksRouter = evidenceApp;
