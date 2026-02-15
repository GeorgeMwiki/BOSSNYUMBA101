/**
 * Onboarding API routes - Module A: Tenant Onboarding Service
 * @openapi
 * tags:
 *   - name: Onboarding
 *     description: Tenant onboarding workflow management
 * 
 * Endpoints:
 * POST /api/v1/onboarding/start - Start onboarding process
 * POST /api/v1/onboarding/checklist - Get/update onboarding checklist  
 * POST /api/v1/onboarding/move-in-report - Submit move-in condition report
 * POST /api/v1/onboarding/procedure-completion - Log procedure completion
 * GET  /api/v1/onboarding/procedures - Get available procedures
 * GET  /api/v1/onboarding/:sessionId - Get session details
 * POST /api/v1/onboarding/:sessionId/step - Complete a step
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { validationErrorHook } from './validators';
import { z } from 'zod';

const app = new Hono();

// ============================================================================
// Zod Schemas
// ============================================================================

const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

const startOnboardingSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().min(1, 'Unit ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  leaseId: z.string().optional(),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  language: z.enum(['en', 'sw']).default('en'),
  preferredChannel: z.enum(['whatsapp', 'sms', 'email', 'app', 'voice']).default('whatsapp'),
});

const completeStepSchema = z.object({
  stepId: z.string().min(1, 'Step ID is required'),
  data: z.record(z.unknown()).optional(),
  completed: z.boolean().default(true),
});

const checklistSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  updates: z.array(z.object({
    stepId: z.string(),
    completed: z.boolean(),
    notes: z.string().optional(),
  })).optional(),
});

const roomConditionSchema = z.object({
  roomId: z.string().min(1),
  roomName: z.string().min(1),
  condition: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged']),
  notes: z.string().optional(),
  photos: z.array(z.string()).optional(),
  defects: z.array(z.object({
    description: z.string(),
    severity: z.enum(['minor', 'moderate', 'major']),
    photoUrl: z.string().optional(),
  })).optional(),
});

const meterReadingSchema = z.object({
  meterId: z.string().min(1),
  meterType: z.enum(['electricity', 'water', 'gas']),
  reading: z.number().min(0),
  unit: z.string(),
  photoUrl: z.string().optional(),
});

const moveInReportSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  rooms: z.array(roomConditionSchema).min(1, 'At least one room condition required'),
  meterReadings: z.array(meterReadingSchema).optional(),
  overallCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  generalNotes: z.string().max(2000).optional(),
  customerSignature: z.string().optional(),
  landlordSignature: z.string().optional(),
  signedAt: z.string().optional(),
  keyInventory: z.array(z.object({
    keyType: z.string(),
    quantity: z.number().int().min(0),
    notes: z.string().optional(),
  })).optional(),
});

const procedureCompletionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  procedureId: z.string().min(1, 'Procedure ID is required'),
  comprehensionConfirmed: z.boolean().default(true),
  channel: z.enum(['whatsapp', 'app', 'voice', 'in_person']).default('app'),
  notes: z.string().max(1000).optional(),
});

const submitInspectionSchema = z.object({
  inspectionId: z.string().min(1, 'Inspection ID is required'),
  items: z.array(z.object({
    room: z.string(),
    condition: z.enum(['good', 'fair', 'damaged', 'missing']),
    notes: z.string().optional(),
    photos: z.array(z.string()).optional(),
  })).optional(),
  signedAt: z.string().optional(),
  signature: z.string().optional(),
});

// In-memory storage for demo
interface OnboardingSession {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  customerId: string;
  leaseId?: string;
  moveInDate: string;
  language: 'en' | 'sw';
  preferredChannel: string;
  status: string;
  currentStep: string;
  checklist: Array<{
    stepId: string;
    labelEn: string;
    labelSw: string;
    completed: boolean;
    completedAt: string | null;
    completedBy: string | null;
  }>;
  moveInReport: unknown | null;
  procedureCompletions: Array<{
    procedureId: string;
    completedAt: string;
    completedBy?: string;
    comprehensionConfirmed: boolean;
    channel: string;
    notes?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const onboardingSessions = new Map<string, OnboardingSession>();

// ============================================================================
// Middleware
// ============================================================================

app.use('*', authMiddleware);

// ============================================================================
// Routes
// ============================================================================

// GET /onboarding/procedures - List available procedures
app.get('/procedures', (c) => {
  const procedures = [
    { id: 'pre_move_in', titleEn: 'Pre-move-in Setup', titleSw: 'Mapambo kabla ya kuhamia', order: 1, category: 'setup' },
    { id: 'water_meter', titleEn: 'Water Meter Reading & Activation', titleSw: 'Kusoma na kuwasha mita ya maji', order: 2, category: 'utilities' },
    { id: 'electricity_meter', titleEn: 'Electricity Meter - Token Purchase', titleSw: 'Mita ya umeme - Kununua tokeni', order: 3, category: 'utilities' },
    { id: 'waste_collection', titleEn: 'Waste Collection Schedule', titleSw: 'Ratiba ya ukusanyaji taka', order: 4, category: 'utilities' },
    { id: 'internet_setup', titleEn: 'Internet Setup', titleSw: 'Usanidi wa intaneti', order: 5, category: 'utilities' },
    { id: 'emergency_protocol', titleEn: 'Emergency Protocol', titleSw: 'Itifaki ya dharura', order: 6, category: 'safety' },
    { id: 'repair_request', titleEn: 'How to Request Repairs', titleSw: 'Jinsi ya kuomba matengenezo', order: 7, category: 'maintenance' },
    { id: 'house_rules', titleEn: 'House Rules & Community Guidelines', titleSw: 'Sheria za nyumba', order: 8, category: 'community' },
  ];
  return c.json({ success: true, data: procedures });
});

// POST /onboarding/start - Start onboarding process
app.post('/start', zValidator('json', startOnboardingSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const sessionId = `onb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const defaultChecklist = [
    { stepId: 'pre_move_in', labelEn: 'Pre-move-in setup', labelSw: 'Mapambo kabla ya kuhamia', completed: false, completedAt: null, completedBy: null },
    { stepId: 'welcome', labelEn: 'Welcome & channel setup', labelSw: 'Karibu na usanidi wa njia', completed: false, completedAt: null, completedBy: null },
    { stepId: 'utilities_training', labelEn: 'Utilities activation & training', labelSw: 'Utumizi na mafunzo', completed: false, completedAt: null, completedBy: null },
    { stepId: 'property_orientation', labelEn: 'Property orientation', labelSw: 'Maelezo ya nyumba', completed: false, completedAt: null, completedBy: null },
    { stepId: 'move_in_inspection', labelEn: 'Move-in condition report', labelSw: 'Ripoti ya hali ya kuhamia', completed: false, completedAt: null, completedBy: null },
    { stepId: 'community_info', labelEn: 'Community & local context', labelSw: 'Jamii na mazingira', completed: false, completedAt: null, completedBy: null },
  ];

  const session: OnboardingSession = {
    id: sessionId,
    tenantId: auth.tenantId,
    propertyId: body.propertyId,
    unitId: body.unitId,
    customerId: body.customerId,
    leaseId: body.leaseId,
    moveInDate: body.moveInDate,
    language: body.language,
    preferredChannel: body.preferredChannel,
    status: 'in_progress',
    currentStep: 'pre_move_in',
    checklist: defaultChecklist,
    moveInReport: null,
    procedureCompletions: [],
    createdAt: now,
    updatedAt: now,
    createdBy: auth.userId,
  };

  onboardingSessions.set(sessionId, session);

  return c.json({ 
    success: true, 
    data: { ...session, progress: { currentStep: 1, totalSteps: defaultChecklist.length, percentComplete: 0 } },
  }, 201);
});

// POST /onboarding/checklist - Get or update checklist
app.post('/checklist', zValidator('json', checklistSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  let session = onboardingSessions.get(body.sessionId);
  
  if (!session) {
    session = {
      id: body.sessionId,
      tenantId: auth.tenantId,
      propertyId: 'prop-demo',
      unitId: 'unit-demo',
      customerId: 'cust-demo',
      moveInDate: now,
      language: 'en',
      preferredChannel: 'whatsapp',
      status: 'in_progress',
      currentStep: 'welcome',
      checklist: [
        { stepId: 'pre_move_in', labelEn: 'Pre-move-in setup', labelSw: 'Setup', completed: true, completedAt: now, completedBy: auth.userId },
        { stepId: 'welcome', labelEn: 'Welcome', labelSw: 'Karibu', completed: false, completedAt: null, completedBy: null },
        { stepId: 'utilities_training', labelEn: 'Utilities', labelSw: 'Utumizi', completed: false, completedAt: null, completedBy: null },
        { stepId: 'property_orientation', labelEn: 'Orientation', labelSw: 'Maelezo', completed: false, completedAt: null, completedBy: null },
        { stepId: 'move_in_inspection', labelEn: 'Inspection', labelSw: 'Ripoti', completed: false, completedAt: null, completedBy: null },
        { stepId: 'community_info', labelEn: 'Community', labelSw: 'Jamii', completed: false, completedAt: null, completedBy: null },
      ],
      moveInReport: null,
      procedureCompletions: [],
      createdAt: now,
      updatedAt: now,
      createdBy: auth.userId,
    };
    onboardingSessions.set(body.sessionId, session);
  }

  if (body.updates && body.updates.length > 0) {
    for (const update of body.updates) {
      const item = session.checklist.find(i => i.stepId === update.stepId);
      if (item) {
        item.completed = update.completed;
        item.completedAt = update.completed ? now : null;
        item.completedBy = update.completed ? auth.userId : null;
      }
    }
    session.updatedAt = now;
    onboardingSessions.set(body.sessionId, session);
  }

  const completedCount = session.checklist.filter(i => i.completed).length;

  return c.json({
    success: true,
    data: {
      sessionId: session.id,
      checklist: session.checklist,
      progress: { completedCount, totalCount: session.checklist.length, percentComplete: Math.round((completedCount / session.checklist.length) * 100) },
      language: session.language,
    },
  });
});

// POST /onboarding/move-in-report - Submit move-in condition report
app.post('/move-in-report', zValidator('json', moveInReportSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const session = onboardingSessions.get(body.sessionId);
  if (!session || session.tenantId !== auth.tenantId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Onboarding session not found' } }, 404);
  }

  const reportId = `mir_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const report = {
    id: reportId,
    sessionId: body.sessionId,
    tenantId: auth.tenantId,
    rooms: body.rooms,
    meterReadings: body.meterReadings ?? [],
    overallCondition: body.overallCondition ?? 'good',
    generalNotes: body.generalNotes,
    keyInventory: body.keyInventory ?? [],
    customerSignature: body.customerSignature,
    landlordSignature: body.landlordSignature,
    signedAt: body.signedAt ?? now,
    submittedAt: now,
    submittedBy: auth.userId,
    status: 'submitted',
  };

  session.moveInReport = report;
  const inspectionItem = session.checklist.find(i => i.stepId === 'move_in_inspection');
  if (inspectionItem) {
    inspectionItem.completed = true;
    inspectionItem.completedAt = now;
    inspectionItem.completedBy = auth.userId;
  }
  session.updatedAt = now;
  onboardingSessions.set(body.sessionId, session);

  return c.json({ success: true, data: { report, message: 'Move-in condition report submitted successfully', nextStep: 'community_info' } }, 201);
});

// POST /onboarding/procedure-completion - Log procedure completion
app.post('/procedure-completion', zValidator('json', procedureCompletionSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  let session = onboardingSessions.get(body.sessionId);
  
  if (!session) {
    session = {
      id: body.sessionId,
      tenantId: auth.tenantId,
      propertyId: 'prop-demo',
      unitId: 'unit-demo',
      customerId: 'cust-demo',
      moveInDate: now,
      language: 'en',
      preferredChannel: 'whatsapp',
      status: 'in_progress',
      currentStep: 'utilities_training',
      checklist: [],
      moveInReport: null,
      procedureCompletions: [],
      createdAt: now,
      updatedAt: now,
      createdBy: auth.userId,
    };
  }

  const completion = {
    procedureId: body.procedureId,
    completedAt: now,
    completedBy: auth.userId,
    comprehensionConfirmed: body.comprehensionConfirmed,
    channel: body.channel,
    notes: body.notes,
  };

  session.procedureCompletions.push(completion);
  session.updatedAt = now;
  onboardingSessions.set(body.sessionId, session);

  return c.json({ success: true, data: { completion, proceduresCompleted: session.procedureCompletions.length, message: 'Procedure training completion logged' } }, 201);
});

// GET /onboarding/:sessionId - Get session details
app.get('/:sessionId', zValidator('param', sessionIdParamSchema), (c) => {
  const auth = c.get('auth');
  const { sessionId } = c.req.valid('param');

  const session = onboardingSessions.get(sessionId);
  
  if (!session || session.tenantId !== auth.tenantId) {
    const mockSession = {
      id: sessionId,
      tenantId: auth.tenantId,
      status: 'in_progress',
      currentStep: 'utilities_training',
      checklist: [
        { stepId: 'pre_move_in', labelEn: 'Pre-move-in setup', completed: true, completedAt: new Date().toISOString() },
        { stepId: 'welcome', labelEn: 'Welcome', completed: true, completedAt: new Date().toISOString() },
        { stepId: 'utilities_training', labelEn: 'Utilities training', completed: false },
        { stepId: 'property_orientation', labelEn: 'Property orientation', completed: false },
        { stepId: 'move_in_inspection', labelEn: 'Move-in inspection', completed: false },
        { stepId: 'community_info', labelEn: 'Community info', completed: false },
      ],
      progress: { currentStep: 3, totalSteps: 6, percentComplete: 33 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return c.json({ success: true, data: mockSession });
  }

  const completedCount = session.checklist.filter(i => i.completed).length;

  return c.json({ 
    success: true, 
    data: { ...session, progress: { currentStep: completedCount + 1, totalSteps: session.checklist.length, percentComplete: Math.round((completedCount / session.checklist.length) * 100) } },
  });
});

// POST /onboarding/:sessionId/step - Complete a step
app.post('/:sessionId/step', zValidator('param', sessionIdParamSchema), zValidator('json', completeStepSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const { sessionId } = c.req.valid('param');
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  let session = onboardingSessions.get(sessionId);
  
  if (!session) {
    session = {
      id: sessionId,
      tenantId: auth.tenantId,
      propertyId: 'prop-demo',
      unitId: 'unit-demo',
      customerId: 'cust-demo',
      moveInDate: now,
      language: 'en',
      preferredChannel: 'whatsapp',
      status: 'in_progress',
      currentStep: body.stepId,
      checklist: [
        { stepId: 'pre_move_in', labelEn: 'Pre-move-in setup', labelSw: 'Setup', completed: false, completedAt: null, completedBy: null },
        { stepId: 'welcome', labelEn: 'Welcome', labelSw: 'Karibu', completed: false, completedAt: null, completedBy: null },
      ],
      moveInReport: null,
      procedureCompletions: [],
      createdAt: now,
      updatedAt: now,
      createdBy: auth.userId,
    };
  }

  const item = session.checklist.find(i => i.stepId === body.stepId);
  if (item) {
    item.completed = body.completed;
    item.completedAt = body.completed ? now : null;
    item.completedBy = body.completed ? auth.userId : null;
  }
  
  session.updatedAt = now;
  onboardingSessions.set(sessionId, session);

  return c.json({ success: true, data: { sessionId, step: { stepId: body.stepId, data: body.data, completed: body.completed, completedAt: body.completed ? now : null }, message: 'Step completed successfully' } });
});

// Legacy inspection endpoint
app.post('/:sessionId/inspection', zValidator('param', sessionIdParamSchema), zValidator('json', submitInspectionSchema, validationErrorHook), (c) => {
  const auth = c.get('auth');
  const { sessionId } = c.req.valid('param');
  const body = c.req.valid('json');

  const inspection = {
    id: body.inspectionId,
    sessionId,
    tenantId: auth.tenantId,
    items: body.items ?? [],
    signedAt: body.signedAt ?? new Date().toISOString(),
    status: 'completed',
  };

  return c.json({ success: true, data: inspection }, 201);
});

export const onboardingRouter = app;
