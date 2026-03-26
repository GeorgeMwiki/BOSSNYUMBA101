/**
 * Condition Surveys API routes - Condition surveys CRUD + items
 * GET /, GET /:id, POST /, PUT /:id
 * GET /:id/items, POST /:id/items
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import {
  idParamSchema,
  paginationQuerySchema,
  validationErrorHook,
} from './validators';
import { z } from 'zod';

const app = new Hono();

// Schemas
const surveyStatusSchema = z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED', 'ARCHIVED']);

const listSurveysQuerySchema = paginationQuerySchema.extend({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: surveyStatusSchema.optional(),
});

const createSurveySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  propertyId: z.string().optional(),
  assetId: z.string().optional(),
  surveyDate: z.string().min(1, 'Survey date is required'),
  surveyYear: z.number().int().min(2000).max(2100),
  surveyorName: z.string().max(200).optional(),
  surveyorId: z.string().optional(),
  status: surveyStatusSchema.default('DRAFT'),
  overallCondition: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']).optional(),
  overallScore: z.number().min(0).max(100).optional(),
  recommendations: z.string().max(5000).optional(),
  nextSurveyDate: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSurveySchema = createSurveySchema.partial();

const createSurveyItemSchema = z.object({
  component: z.string().min(1, 'Component is required').max(200),
  category: z.string().max(100).optional(),
  condition: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL']),
  score: z.number().min(0).max(100).optional(),
  description: z.string().max(2000).optional(),
  defects: z.array(z.object({
    type: z.string(),
    severity: z.enum(['minor', 'moderate', 'major', 'critical']),
    description: z.string().max(1000),
    location: z.string().max(500).optional(),
  })).default([]),
  photos: z.array(z.string().url()).default([]),
  recommendations: z.string().max(2000).optional(),
  estimatedRepairCost: z.number().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

app.use('*', authMiddleware);

// GET /condition-surveys - List surveys with filters
app.get('/', zValidator('query', listSurveysQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, year, status } = c.req.valid('query');

  const surveys: unknown[] = [];

  const paginated = {
    data: surveys,
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
    },
  };

  return c.json({ success: true, ...paginated });
});

// POST /condition-surveys - Create a condition survey
app.post(
  '/',
  zValidator('json', createSurveySchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const survey = {
      id: crypto.randomUUID(),
      tenantId: auth.tenantId,
      ...body,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: survey }, 201);
  }
);

// GET /condition-surveys/:id - Get survey by ID
app.get('/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const survey = {
    id,
    tenantId: auth.tenantId,
    title: '',
    status: 'DRAFT',
    surveyDate: '',
    surveyYear: new Date().getFullYear(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return c.json({ success: true, data: survey });
});

// PUT /condition-surveys/:id - Update survey
app.put(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateSurveySchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const survey = {
      id,
      tenantId: auth.tenantId,
      ...body,
      updatedBy: auth.userId,
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: survey });
  }
);

// GET /condition-surveys/:id/items - List items for a survey
app.get('/:id/items', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({ success: true, data: { surveyId: id, items: [] } });
});

// POST /condition-surveys/:id/items - Add item to a survey
app.post(
  '/:id/items',
  zValidator('param', idParamSchema),
  zValidator('json', createSurveyItemSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const item = {
      id: crypto.randomUUID(),
      surveyId: id,
      tenantId: auth.tenantId,
      ...body,
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: item }, 201);
  }
);

export const conditionSurveysRouter = app;
