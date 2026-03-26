/**
 * Financial Profiles API routes - Financial profiles CRUD + assessment
 * GET /customer/:customerId, GET /:id, POST /, PUT /:id, POST /:id/assess
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import {
  idParamSchema,
  validationErrorHook,
} from './validators';
import { z } from 'zod';

const app = new Hono();

// Schemas
const customerIdParamSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
});

const createFinancialProfileSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  employmentStatus: z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED', 'RETIRED', 'STUDENT']).optional(),
  employer: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  monthlyIncome: z.number().min(0).optional(),
  additionalIncome: z.number().min(0).optional(),
  incomeSource: z.string().max(200).optional(),
  monthlyExpenses: z.number().min(0).optional(),
  outstandingDebts: z.number().min(0).optional(),
  creditScore: z.number().int().min(0).max(999).optional(),
  creditProvider: z.string().max(100).optional(),
  bankName: z.string().max(200).optional(),
  bankAccountType: z.enum(['SAVINGS', 'CURRENT', 'CHEQUE']).optional(),
  hasBankAccount: z.boolean().optional(),
  previousLandlordReference: z.string().max(500).optional(),
  bankruptcyHistory: z.boolean().default(false),
  evictionHistory: z.boolean().default(false),
  guarantorName: z.string().max(200).optional(),
  guarantorContact: z.string().max(100).optional(),
  guarantorRelationship: z.string().max(100).optional(),
  documents: z.array(z.object({
    type: z.string(),
    name: z.string(),
    url: z.string().url(),
  })).default([]),
  metadata: z.record(z.unknown()).optional(),
});

const updateFinancialProfileSchema = createFinancialProfileSchema.partial().omit({ customerId: true });

const assessFinancialProfileSchema = z.object({
  assessmentType: z.enum(['AFFORDABILITY', 'CREDIT_CHECK', 'FULL_ASSESSMENT']).default('FULL_ASSESSMENT'),
  targetRentAmount: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

app.use('*', authMiddleware);

// GET /financial-profiles/customer/:customerId - Get profile by customer ID
app.get(
  '/customer/:customerId',
  zValidator('param', customerIdParamSchema),
  (c) => {
    const auth = c.get('auth');
    const { customerId } = c.req.valid('param');

    const profile = {
      id: '',
      tenantId: auth.tenantId,
      customerId,
      employmentStatus: null,
      monthlyIncome: null,
      creditScore: null,
      riskRating: null,
      lastAssessedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: profile });
  }
);

// POST /financial-profiles - Create financial profile
app.post(
  '/',
  zValidator('json', createFinancialProfileSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const profile = {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      ...body,
      riskRating: null,
      lastAssessedAt: null,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: profile }, 201);
  }
);

// GET /financial-profiles/:id - Get profile by ID
app.get('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const profile = {
    id,
    tenantId: auth.tenantId,
    customerId: '',
    employmentStatus: null,
    monthlyIncome: null,
    creditScore: null,
    riskRating: null,
    lastAssessedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: profile });
});

// PUT /financial-profiles/:id - Update profile
app.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateFinancialProfileSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const profile = {
      id,
      tenantId: auth.tenantId,
      ...body,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: profile });
  }
);

// POST /financial-profiles/:id/assess - Run financial assessment
app.post(
  '/:id/assess',
  zValidator('param', idParamSchema),
  zValidator('json', assessFinancialProfileSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const assessment = {
      id: crypto.randomUUID(),
      profileId: id,
      tenantId: auth.tenantId,
      assessmentType: body.assessmentType,
      targetRentAmount: body.targetRentAmount,
      result: {
        riskRating: 'MEDIUM',
        affordabilityRatio: null,
        creditCheckPassed: null,
        recommendedMaxRent: null,
        flags: [],
        summary: 'Assessment pending - DB connection required for full calculation',
      },
      assessedBy: auth.userId,
      assessedAt: new Date().toISOString(),
      notes: body.notes,
    };

    return c.json({ success: true, data: assessment }, 201);
  }
);

export const financialProfilesRouter = app;
