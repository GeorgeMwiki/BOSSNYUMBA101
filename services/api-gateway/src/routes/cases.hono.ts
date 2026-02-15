/**
 * Cases API routes - Dispute and Legal Case Management (Module Q)
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { idParamSchema, paginationQuerySchema, validationErrorHook } from './validators';
import { getByTenant, getById, paginate, DEMO_CUSTOMERS, DEMO_LEASES, DEMO_INVOICES, DEMO_PROPERTIES, DEMO_UNITS } from '../data/mock-data';

export const CaseStatus = {
  OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', PENDING_RESPONSE: 'PENDING_RESPONSE',
  ESCALATED: 'ESCALATED', RESOLVED: 'RESOLVED', CLOSED: 'CLOSED',
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export const CaseType = {
  RENT_ARREARS: 'RENT_ARREARS', DEPOSIT_DISPUTE: 'DEPOSIT_DISPUTE', PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  LEASE_VIOLATION: 'LEASE_VIOLATION', NOISE_COMPLAINT: 'NOISE_COMPLAINT', MAINTENANCE_DISPUTE: 'MAINTENANCE_DISPUTE',
  EVICTION: 'EVICTION', OTHER: 'OTHER',
} as const;
export type CaseType = (typeof CaseType)[keyof typeof CaseType];

export const CaseSeverity = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' } as const;
export type CaseSeverity = (typeof CaseSeverity)[keyof typeof CaseSeverity];

export const NoticeType = {
  REMINDER: 'REMINDER', WARNING: 'WARNING', FINAL_NOTICE: 'FINAL_NOTICE',
  EVICTION_NOTICE: 'EVICTION_NOTICE', LEGAL_SUMMONS: 'LEGAL_SUMMONS',
} as const;
export type NoticeType = (typeof NoticeType)[keyof typeof NoticeType];

export interface CaseTimelineEvent {
  id: string; type: string; description: string; metadata?: Record<string, unknown>;
  createdAt: Date; createdBy: string;
}

export interface CaseNotice {
  id: string; type: NoticeType; title: string; content: string;
  sentAt?: Date; sentVia?: string[]; deliveryConfirmed?: boolean; deliveryConfirmedAt?: Date;
  createdAt: Date; createdBy: string;
}

export interface CaseEvidence {
  id: string; type: string; name: string; description?: string;
  url: string; mimeType?: string; uploadedAt: Date; uploadedBy: string;
}

export interface CaseResolution {
  outcome: string; summary: string; agreedAmount?: number;
  paymentPlan?: { installments: number; amount: number; frequency: string; startDate: Date };
  terms?: string; resolvedAt: Date; resolvedBy: string;
}

export interface Case {
  id: string; tenantId: string; caseNumber: string; type: CaseType; severity: CaseSeverity;
  status: CaseStatus; title: string; description: string; customerId: string;
  leaseId?: string; propertyId?: string; unitId?: string; relatedInvoiceIds?: string[];
  amountInDispute?: number; currency?: string; assignedTo?: string;
  timeline: CaseTimelineEvent[]; notices: CaseNotice[]; evidence: CaseEvidence[];
  resolution?: CaseResolution; escalatedAt?: Date; escalationLevel: number;
  dueDate?: Date; closedAt?: Date; closedBy?: string; closureReason?: string;
  createdAt: Date; createdBy: string; updatedAt: Date; updatedBy: string;
}

const DEMO_CASES: Case[] = [];

const caseStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'PENDING_RESPONSE', 'ESCALATED', 'RESOLVED', 'CLOSED']);
const caseTypeSchema = z.enum(['RENT_ARREARS', 'DEPOSIT_DISPUTE', 'PROPERTY_DAMAGE', 'LEASE_VIOLATION', 'NOISE_COMPLAINT', 'MAINTENANCE_DISPUTE', 'EVICTION', 'OTHER']);
const caseSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const noticeTypeSchema = z.enum(['REMINDER', 'WARNING', 'FINAL_NOTICE', 'EVICTION_NOTICE', 'LEGAL_SUMMONS']);

const listCasesQuerySchema = paginationQuerySchema.extend({
  status: caseStatusSchema.optional(), type: caseTypeSchema.optional(),
  severity: caseSeveritySchema.optional(), customerId: z.string().optional(),
  assignedTo: z.string().optional(), propertyId: z.string().optional(),
});

const createCaseSchema = z.object({
  type: caseTypeSchema, severity: caseSeveritySchema.default('MEDIUM'),
  title: z.string().min(1).max(200), description: z.string().min(1).max(2000),
  customerId: z.string().min(1), leaseId: z.string().optional(), propertyId: z.string().optional(),
  unitId: z.string().optional(), relatedInvoiceIds: z.array(z.string()).optional(),
  amountInDispute: z.number().min(0).optional(), currency: z.string().length(3).default('TZS'),
  assignedTo: z.string().optional(), dueDate: z.string().optional(),
});

const updateCaseSchema = z.object({
  title: z.string().min(1).max(200).optional(), description: z.string().max(2000).optional(),
  severity: caseSeveritySchema.optional(), assignedTo: z.string().optional(),
  dueDate: z.string().optional(), amountInDispute: z.number().min(0).optional(),
});

const addTimelineEventSchema = z.object({ type: z.string().min(1), description: z.string().min(1).max(1000), metadata: z.record(z.unknown()).optional() });
const createNoticeSchema = z.object({ type: noticeTypeSchema, title: z.string().min(1).max(200), content: z.string().min(1).max(5000) });
const sendNoticeSchema = z.object({ channels: z.array(z.enum(['EMAIL', 'SMS', 'WHATSAPP'])).min(1) });
const addEvidenceSchema = z.object({ type: z.string().min(1), name: z.string().min(1).max(200), description: z.string().max(1000).optional(), url: z.string().url(), mimeType: z.string().optional() });
const resolveCaseSchema = z.object({ outcome: z.string().min(1), summary: z.string().min(1).max(2000), agreedAmount: z.number().min(0).optional(), terms: z.string().max(5000).optional() });
const escalateCaseSchema = z.object({ reason: z.string().min(1).max(1000) });
const closeCaseSchema = z.object({ reason: z.string().min(1).max(1000) });

function generateId(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function generateCaseNumber(): string { return `CASE-${new Date().getFullYear()}-${String(DEMO_CASES.length + 1).padStart(3, '0')}`; }
function errorResponse(c: { json: (body: unknown, status?: number) => Response }, status: 400 | 403 | 404 | 409, code: string, message: string) { return c.json({ success: false, error: { code, message } }, status); }

function enrichCase(caseItem: Case) {
  const customer = getById(DEMO_CUSTOMERS, caseItem.customerId);
  const lease = caseItem.leaseId ? getById(DEMO_LEASES, caseItem.leaseId) : null;
  const property = caseItem.propertyId ? getById(DEMO_PROPERTIES, caseItem.propertyId) : null;
  const unit = caseItem.unitId ? getById(DEMO_UNITS, caseItem.unitId) : null;
  return {
    ...caseItem,
    customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}`, email: customer.email } : null,
    lease: lease ? { id: lease.id, status: lease.status } : null,
    property: property ? { id: property.id, name: property.name } : null,
    unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
  };
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/stats', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const result = await repos.compliance.getCases(auth.tenantId, { limit: 1000, offset: 0 });
      const cases = result.items as any[];
      return c.json({ success: true, data: {
        total: cases.length,
        byStatus: {
          open: cases.filter((cs: any) => cs.status === 'open').length,
          inProgress: cases.filter((cs: any) => cs.status === 'in_progress').length,
          escalated: cases.filter((cs: any) => cs.status === 'escalated').length,
          resolved: cases.filter((cs: any) => cs.status === 'resolved').length,
          closed: cases.filter((cs: any) => cs.status === 'closed').length,
        },
        totalAmountInDispute: cases.reduce((sum: number, cs: any) => sum + (cs.amountInDispute ?? 0), 0),
      }});
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const cases = getByTenant(DEMO_CASES, auth.tenantId);
  return c.json({ success: true, data: {
    total: cases.length,
    byStatus: { open: cases.filter(cs => cs.status === CaseStatus.OPEN).length, inProgress: cases.filter(cs => cs.status === CaseStatus.IN_PROGRESS).length, escalated: cases.filter(cs => cs.status === CaseStatus.ESCALATED).length, resolved: cases.filter(cs => cs.status === CaseStatus.RESOLVED).length, closed: cases.filter(cs => cs.status === CaseStatus.CLOSED).length },
    totalAmountInDispute: cases.reduce((sum, cs) => sum + (cs.amountInDispute ?? 0), 0),
  }});
});

app.get('/', zValidator('query', listCasesQuerySchema), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize, status, type, severity, customerId, assignedTo, propertyId } = c.req.valid('query');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const offset = (page - 1) * pageSize;
      const result = await repos.compliance.getCases(auth.tenantId, {
        status: status?.toLowerCase(),
        customerId,
        propertyId,
        limit: pageSize,
        offset,
      });

      return c.json({
        success: true,
        data: result.items,
        pagination: {
          page,
          pageSize,
          totalItems: result.total,
          totalPages: Math.ceil(result.total / pageSize),
          hasNextPage: page < Math.ceil(result.total / pageSize),
          hasPreviousPage: page > 1,
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  let cases = getByTenant(DEMO_CASES, auth.tenantId);
  if (status) cases = cases.filter(cs => cs.status === status);
  if (type) cases = cases.filter(cs => cs.type === type);
  if (severity) cases = cases.filter(cs => cs.severity === severity);
  if (customerId) cases = cases.filter(cs => cs.customerId === customerId);
  if (assignedTo) cases = cases.filter(cs => cs.assignedTo === assignedTo);
  if (propertyId) cases = cases.filter(cs => cs.propertyId === propertyId);
  cases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const result = paginate(cases, page, pageSize);
  return c.json({ success: true, data: result.data.map(enrichCase), pagination: result.pagination });
});

app.post('/', zValidator('json', createCaseSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const customer = await repos.customers.findById(body.customerId, auth.tenantId);
      if (!customer) return errorResponse(c, 404, 'NOT_FOUND', 'Customer not found');

      const created = await repos.compliance.createCase({
        tenantId: auth.tenantId,
        type: body.type.toLowerCase(),
        severity: body.severity.toLowerCase(),
        status: 'open',
        title: body.title,
        description: body.description,
        customerId: body.customerId,
        leaseId: body.leaseId,
        propertyId: body.propertyId,
        unitId: body.unitId,
        amountInDispute: body.amountInDispute ? String(body.amountInDispute) : undefined,
        assignedTo: body.assignedTo,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        createdBy: auth.userId,
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const customer = getById(DEMO_CUSTOMERS, body.customerId);
  if (!customer || customer.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Customer not found');
  const now = new Date();
  const newCase: Case = {
    id: generateId('case'), tenantId: auth.tenantId, caseNumber: generateCaseNumber(),
    type: body.type as CaseType, severity: body.severity as CaseSeverity, status: CaseStatus.OPEN,
    title: body.title, description: body.description, customerId: body.customerId,
    leaseId: body.leaseId, propertyId: body.propertyId, unitId: body.unitId,
    relatedInvoiceIds: body.relatedInvoiceIds, amountInDispute: body.amountInDispute, currency: body.currency,
    assignedTo: body.assignedTo,
    timeline: [{ id: generateId('event'), type: 'CASE_CREATED', description: `Case created: ${body.title}`, createdAt: now, createdBy: auth.userId }],
    notices: [], evidence: [], escalationLevel: 0, dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    createdAt: now, createdBy: auth.userId, updatedAt: now, updatedBy: auth.userId,
  };
  DEMO_CASES.push(newCase);
  return c.json({ success: true, data: enrichCase(newCase) }, 201);
});

app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const casesResult = await repos.compliance.getCases(auth.tenantId, { limit: 1, offset: 0 });
      // getCases doesn't have findById, so we fetch and filter
      const allCases = await repos.compliance.getCases(auth.tenantId, { limit: 1000, offset: 0 });
      const caseItem = (allCases.items as any[]).find((cs: any) => cs.id === id);
      if (!caseItem) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
      return c.json({ success: true, data: caseItem });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  const relatedInvoices = caseItem.relatedInvoiceIds?.map(invoiceId => getById(DEMO_INVOICES, invoiceId)).filter(Boolean);
  return c.json({ success: true, data: { ...enrichCase(caseItem), relatedInvoices } });
});

app.put('/:id', zValidator('param', idParamSchema), zValidator('json', updateCaseSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const updated = await repos.compliance.updateCase(id, auth.tenantId, {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        updatedBy: auth.userId,
      });
      if (!updated) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  if (caseItem.status === CaseStatus.CLOSED) return errorResponse(c, 409, 'CONFLICT', 'Cannot update a closed case');
  const now = new Date();
  const idx = DEMO_CASES.findIndex(cs => cs.id === id);
  if (idx >= 0) DEMO_CASES[idx] = { ...caseItem, ...body, dueDate: body.dueDate ? new Date(body.dueDate) : caseItem.dueDate, updatedAt: now, updatedBy: auth.userId };
  return c.json({ success: true, data: enrichCase(DEMO_CASES[idx]) });
});

app.post('/:id/timeline', zValidator('param', idParamSchema), zValidator('json', addTimelineEventSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  const now = new Date();
  const event: CaseTimelineEvent = { id: generateId('event'), type: body.type, description: body.description, metadata: body.metadata, createdAt: now, createdBy: auth.userId };
  caseItem.timeline.push(event);
  caseItem.updatedAt = now;
  caseItem.updatedBy = auth.userId;
  return c.json({ success: true, data: event }, 201);
});

app.post('/:id/notices', zValidator('param', idParamSchema), zValidator('json', createNoticeSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const notice = await repos.compliance.createNotice({
        tenantId: auth.tenantId,
        caseId: id,
        type: body.type.toLowerCase(),
        title: body.title,
        content: body.content,
        createdBy: auth.userId,
      });
      return c.json({ success: true, data: notice }, 201);
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  const now = new Date();
  const notice: CaseNotice = { id: generateId('notice'), type: body.type as NoticeType, title: body.title, content: body.content, createdAt: now, createdBy: auth.userId };
  caseItem.notices.push(notice);
  caseItem.timeline.push({ id: generateId('event'), type: 'NOTICE_CREATED', description: `${body.type} notice created: ${body.title}`, createdAt: now, createdBy: auth.userId });
  caseItem.updatedAt = now;
  caseItem.updatedBy = auth.userId;
  return c.json({ success: true, data: notice }, 201);
});

app.post('/:id/evidence', zValidator('param', idParamSchema), zValidator('json', addEvidenceSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  const now = new Date();
  const evidence: CaseEvidence = { id: generateId('evidence'), type: body.type, name: body.name, description: body.description, url: body.url, mimeType: body.mimeType, uploadedAt: now, uploadedBy: auth.userId };
  caseItem.evidence.push(evidence);
  caseItem.timeline.push({ id: generateId('event'), type: 'EVIDENCE_ADDED', description: `Evidence added: ${body.name}`, createdAt: now, createdBy: auth.userId });
  caseItem.updatedAt = now;
  caseItem.updatedBy = auth.userId;
  return c.json({ success: true, data: evidence }, 201);
});

app.post('/:id/escalate', zValidator('param', idParamSchema), zValidator('json', escalateCaseSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const updated = await repos.compliance.updateCase(id, auth.tenantId, {
        status: 'escalated',
        updatedBy: auth.userId,
      });
      if (!updated) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  if (caseItem.status === CaseStatus.CLOSED || caseItem.status === CaseStatus.RESOLVED) return errorResponse(c, 409, 'CONFLICT', 'Cannot escalate');
  const now = new Date();
  const idx = DEMO_CASES.findIndex(cs => cs.id === id);
  if (idx >= 0) {
    DEMO_CASES[idx] = { ...caseItem, status: CaseStatus.ESCALATED, escalatedAt: now, escalationLevel: caseItem.escalationLevel + 1, updatedAt: now, updatedBy: auth.userId };
    DEMO_CASES[idx].timeline.push({ id: generateId('event'), type: 'CASE_ESCALATED', description: `Escalated to level ${caseItem.escalationLevel + 1}: ${body.reason}`, metadata: { reason: body.reason }, createdAt: now, createdBy: auth.userId });
  }
  return c.json({ success: true, data: enrichCase(DEMO_CASES[idx]) });
});

app.post('/:id/resolve', zValidator('param', idParamSchema), zValidator('json', resolveCaseSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const updated = await repos.compliance.updateCase(id, auth.tenantId, {
        status: 'resolved',
        updatedBy: auth.userId,
      });
      if (!updated) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  if (caseItem.status === CaseStatus.CLOSED) return errorResponse(c, 409, 'CONFLICT', 'Already closed');
  const now = new Date();
  const resolution: CaseResolution = { outcome: body.outcome, summary: body.summary, agreedAmount: body.agreedAmount, terms: body.terms, resolvedAt: now, resolvedBy: auth.userId };
  const idx = DEMO_CASES.findIndex(cs => cs.id === id);
  if (idx >= 0) {
    DEMO_CASES[idx] = { ...caseItem, status: CaseStatus.RESOLVED, resolution, updatedAt: now, updatedBy: auth.userId };
    DEMO_CASES[idx].timeline.push({ id: generateId('event'), type: 'CASE_RESOLVED', description: `Resolved: ${body.outcome}`, metadata: { outcome: body.outcome, agreedAmount: body.agreedAmount }, createdAt: now, createdBy: auth.userId });
  }
  return c.json({ success: true, data: enrichCase(DEMO_CASES[idx]) });
});

app.post('/:id/close', zValidator('param', idParamSchema), zValidator('json', closeCaseSchema, validationErrorHook), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const updated = await repos.compliance.updateCase(id, auth.tenantId, {
        status: 'closed',
        updatedBy: auth.userId,
      });
      if (!updated) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  if (caseItem.status === CaseStatus.CLOSED) return errorResponse(c, 409, 'CONFLICT', 'Already closed');
  const now = new Date();
  const idx = DEMO_CASES.findIndex(cs => cs.id === id);
  if (idx >= 0) {
    DEMO_CASES[idx] = { ...caseItem, status: CaseStatus.CLOSED, closedAt: now, closedBy: auth.userId, closureReason: body.reason, updatedAt: now, updatedBy: auth.userId };
    DEMO_CASES[idx].timeline.push({ id: generateId('event'), type: 'CASE_CLOSED', description: `Closed: ${body.reason}`, createdAt: now, createdBy: auth.userId });
  }
  return c.json({ success: true, data: enrichCase(DEMO_CASES[idx]) });
});

app.get('/:id/evidence-pack', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const caseItem = getById(DEMO_CASES, id);
  if (!caseItem || caseItem.tenantId !== auth.tenantId) return errorResponse(c, 404, 'NOT_FOUND', 'Case not found');
  const customer = getById(DEMO_CUSTOMERS, caseItem.customerId);
  const lease = caseItem.leaseId ? getById(DEMO_LEASES, caseItem.leaseId) : null;
  const relatedInvoices = caseItem.relatedInvoiceIds?.map(invId => getById(DEMO_INVOICES, invId)).filter(Boolean);
  return c.json({ success: true, data: {
    caseNumber: caseItem.caseNumber, generatedAt: new Date().toISOString(),
    summary: { type: caseItem.type, severity: caseItem.severity, status: caseItem.status, title: caseItem.title, amountInDispute: caseItem.amountInDispute },
    customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone } : null,
    lease: lease ? { id: lease.id, startDate: lease.startDate, endDate: lease.endDate, rentAmount: lease.rentAmount } : null,
    relatedInvoices, timeline: caseItem.timeline, notices: caseItem.notices, evidence: caseItem.evidence, resolution: caseItem.resolution,
  }, meta: { downloadUrl: `/api/v1/cases/${id}/evidence-pack/download`, expiresAt: new Date(Date.now() + 3600000).toISOString() }});
});

export const casesRouter = app;
