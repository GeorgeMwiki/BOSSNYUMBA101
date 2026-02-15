/**
 * Scheduling API routes - Hono with Zod validation
 * POST /events, GET /events, GET /events/:id
 * PUT /events/:id, DELETE /events/:id
 * GET /availability, PUT /availability
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

const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  type: z.enum(['viewing', 'inspection', 'maintenance', 'meeting', 'other']),
  startAt: z.union([z.string(), z.coerce.date()]),
  endAt: z.union([z.string(), z.coerce.date()]).optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  customerId: z.string().optional(),
  description: z.string().max(1000).optional(),
  attendees: z.array(z.string()).optional(),
  reminders: z.array(z.object({
    type: z.enum(['email', 'sms', 'push']),
    minutesBefore: z.number().int().min(0),
  })).optional(),
});

const updateEventSchema = createEventSchema.partial();

const setAvailabilitySchema = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    enabled: z.boolean().default(true),
  })),
  timezone: z.string().max(100).optional(),
  exceptions: z.array(z.object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    available: z.boolean(),
  })).optional(),
});

const listEventsQuerySchema = paginationQuerySchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: z.enum(['viewing', 'inspection', 'maintenance', 'meeting', 'other']).optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
});

const availabilityQuerySchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

app.use('*', authMiddleware);

function errorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  status: 404 | 409,
  code: string,
  message: string
) {
  return c.json({ success: false, error: { code, message } }, status);
}

// POST /scheduling/events - Create event
app.post(
  '/events',
  zValidator('json', createEventSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const event = {
      id: `event-${Date.now()}`,
      tenantId: auth.tenantId,
      title: body.title,
      type: body.type,
      startAt: new Date(body.startAt).toISOString(),
      endAt: body.endAt ? new Date(body.endAt).toISOString() : null,
      propertyId: body.propertyId,
      unitId: body.unitId,
      customerId: body.customerId,
      description: body.description,
      attendees: body.attendees ?? [],
      status: 'scheduled',
      createdBy: auth.userId,
      createdAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: event }, 201);
  }
);

// GET /scheduling/events - List events
app.get('/events', zValidator('query', listEventsQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, startDate, endDate, type, propertyId, unitId } = c.req.valid('query');

  const events = [
    {
      id: 'event-1',
      tenantId: auth.tenantId,
      title: 'Unit Viewing',
      type: 'viewing',
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 3600000).toISOString(),
      status: 'scheduled',
    },
  ];

  let filtered = events.filter((e) => e.tenantId === auth.tenantId);
  if (type) filtered = filtered.filter((e) => e.type === type);
  if (propertyId) filtered = filtered.filter((e) => (e as { propertyId?: string }).propertyId === propertyId);
  if (unitId) filtered = filtered.filter((e) => (e as { unitId?: string }).unitId === unitId);

  const paginated = {
    data: filtered.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    },
  };

  return c.json({ success: true, ...paginated });
});

// GET /scheduling/events/:id - Get event
app.get('/events/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const event = {
    id,
    tenantId: auth.tenantId,
    title: 'Event details',
    type: 'viewing',
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 3600000).toISOString(),
    status: 'scheduled',
  };

  return c.json({ success: true, data: event });
});

// PUT /scheduling/events/:id - Update event
app.put(
  '/events/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateEventSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const event = {
      id,
      tenantId: auth.tenantId,
      title: body.title ?? 'Updated event',
      type: body.type ?? 'viewing',
      startAt: body.startAt ? new Date(body.startAt).toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: event });
  }
);

// DELETE /scheduling/events/:id - Cancel event
app.delete('/events/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({
    success: true,
    data: {
      id,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    },
  });
});

// GET /scheduling/availability - Get availability
app.get('/availability', zValidator('query', availabilityQuerySchema), (c) => {
  const auth = c.get('auth');

  const availability = {
    slots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', enabled: true },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', enabled: true },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', enabled: true },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', enabled: true },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', enabled: true },
    ],
    timezone: 'Africa/Dar_es_Salaam',
  };

  return c.json({ success: true, data: availability });
});

// PUT /scheduling/availability - Set availability
app.put(
  '/availability',
  zValidator('json', setAvailabilitySchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    return c.json({
      success: true,
      data: {
        slots: body.slots,
        timezone: body.timezone,
        updatedAt: new Date().toISOString(),
      },
    });
  }
);

export const schedulingRouter = app;
