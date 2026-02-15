/**
 * Notifications API routes - Hono with Zod validation
 * POST /send, POST /bulk, GET /, PUT /:id/read, GET /templates
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import {
  paginationQuerySchema,
  idParamSchema,
  validationErrorHook,
} from './validators';
import { z } from 'zod';

const app = new Hono();

const sendNotificationSchema = z.object({
  userId: z.string().optional(),
  channel: z.enum(['email', 'sms', 'push', 'in_app']),
  templateId: z.string().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1, 'Body is required').max(10000),
  data: z.record(z.unknown()).optional(),
});

const bulkSendSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user required'),
  channel: z.enum(['email', 'sms', 'push', 'in_app']),
  templateId: z.string().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().min(1, 'Body is required').max(10000),
  data: z.record(z.unknown()).optional(),
});

const listNotificationsQuerySchema = paginationQuerySchema.extend({
  read: z.coerce.boolean().optional(),
  type: z.string().max(50).optional(),
});

app.use('*', authMiddleware);

function errorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  status: 400 | 403 | 404 | 409,
  code: string,
  message: string
) {
  return c.json({ success: false, error: { code, message } }, status);
}

// POST /notifications/send - Send notification
app.post(
  '/send',
  zValidator('json', sendNotificationSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const notification = {
      id: `notif-${Date.now()}`,
      tenantId: auth.tenantId,
      userId: body.userId ?? auth.userId,
      channel: body.channel,
      templateId: body.templateId,
      subject: body.subject,
      body: body.body,
      data: body.data ?? {},
      read: false,
      createdAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: notification }, 201);
  }
);

// POST /notifications/bulk - Bulk send
app.post(
  '/bulk',
  zValidator('json', bulkSendSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const results = body.userIds.map((userId, i) => ({
      id: `notif-bulk-${Date.now()}-${i}`,
      tenantId: auth.tenantId,
      userId,
      channel: body.channel,
      status: 'queued',
    }));

    return c.json(
      {
        success: true,
        data: {
          sent: results.length,
          results,
        },
      },
      201
    );
  }
);

// GET /notifications/templates - Must be before /:id
app.get('/templates', (c) => {
  const auth = c.get('auth');

  const templates = [
    { id: 'invoice_due', name: 'Invoice Due Reminder', channels: ['email', 'sms'] },
    { id: 'payment_received', name: 'Payment Received', channels: ['email', 'in_app'] },
    { id: 'lease_expiring', name: 'Lease Expiring Soon', channels: ['email', 'sms'] },
    { id: 'maintenance_update', name: 'Maintenance Update', channels: ['email', 'sms', 'push'] },
  ];

  return c.json({
    success: true,
    data: templates,
  });
});

// GET /notifications - List user notifications
app.get('/', zValidator('query', listNotificationsQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, read, type } = c.req.valid('query');

  // Mock notifications for current user
  const notifications = [
    {
      id: 'notif-1',
      tenantId: auth.tenantId,
      userId: auth.userId,
      type: 'payment_received',
      subject: 'Payment Received',
      body: 'Your payment of TZS 500,000 has been received.',
      read: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      tenantId: auth.tenantId,
      userId: auth.userId,
      type: 'invoice_due',
      subject: 'Invoice Due',
      body: 'Your rent invoice is due in 3 days.',
      read: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  let filtered = notifications.filter((n) => n.tenantId === auth.tenantId);
  if (read !== undefined) filtered = filtered.filter((n) => n.read === read);
  if (type) filtered = filtered.filter((n) => n.type === type);

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

// PUT /notifications/:id/read - Mark as read
app.put('/:id/read', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({
    success: true,
    data: {
      id,
      read: true,
      readAt: new Date().toISOString(),
    },
  });
});

export const notificationsRouter = app;
