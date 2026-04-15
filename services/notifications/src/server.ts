/**
 * Notifications Service HTTP Server
 *
 * Exposes the REST surface that the api-gateway proxies to
 * (see NOTIFICATIONS_SERVICE_URL). All business logic is delegated to the
 * existing library exports in ./index.ts — this file only wires transport,
 * auth, validation, logging, and lifecycle.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import {
  serviceLogger,
  inAppNotificationService,
  notificationService,
  preferencesService,
  startNotificationConsumer,
  stopNotificationConsumer,
} from './index.js';
import type {
  NotificationChannel,
  NotificationTemplateId,
  NotificationRecipient,
  TenantId,
} from './types/index.js';
import type { NotificationCategory, NotificationPriority } from './services/in-app-notification.service.js';

// ============================================================================
// Caller context (forwarded from api-gateway via headers)
// ============================================================================

interface CallerContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
  role?: string;
  bearerToken?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      callerContext: CallerContext;
    }
  }
}

// ============================================================================
// Request validation schemas
// ============================================================================

const ListNotificationsQuerySchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
  status: z.enum(['read', 'unread', 'archived', 'active']).optional(),
  category: z
    .enum([
      'payment',
      'maintenance',
      'lease',
      'announcement',
      'system',
      'reminder',
      'alert',
      'communication',
    ])
    .optional(),
});

const GetOneQuerySchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
});

const MarkReadBodySchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
});

const SendBodySchema = z.object({
  userId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  tenantId: z.string().min(1),
  channel: z.enum(['sms', 'email', 'push', 'whatsapp']),
  templateId: z.string().min(1),
  data: z.record(z.string(), z.string()).optional().default({}),
  requestedBy: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  pushToken: z.string().min(1).optional(),
  locale: z.enum(['en', 'sw', 'fr']).optional(),
  name: z.string().optional(),
});

const PreferencesQuerySchema = z.object({
  userId: z.string().min(1),
  tenantId: z.string().min(1),
});

const ChannelPrefsSchema = z
  .object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    push: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
  })
  .optional();

const PreferencesBodySchema = z.object({
  channels: ChannelPrefsSchema,
  templates: z.record(z.string(), z.boolean()).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// ============================================================================
// Error envelope
// ============================================================================

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ success: false, error: { code, message } });
}

// ============================================================================
// App bootstrap
// ============================================================================

export function buildApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // ---- Request context + structured access log ---------------------------
  app.use((req, _res, next) => {
    const headerRequestId =
      (req.headers['x-request-id'] as string | undefined) ??
      (req.headers['x-correlation-id'] as string | undefined);
    const requestId = headerRequestId && headerRequestId.length > 0 ? headerRequestId : randomUUID();
    const authHeader = (req.headers['authorization'] as string | undefined) ?? '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    req.callerContext = {
      requestId,
      tenantId: (req.headers['x-tenant-id'] as string | undefined) ?? undefined,
      userId: (req.headers['x-user-id'] as string | undefined) ?? undefined,
      role: (req.headers['x-user-role'] as string | undefined) ?? undefined,
      bearerToken,
    };
    next();
  });

  // ---- Health (pre-auth) --------------------------------------------------
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'notifications',
      timestamp: new Date().toISOString(),
    });
  });

  // ---- Internal auth ------------------------------------------------------
  app.use((req, res, next) => {
    const expected = process.env.INTERNAL_API_KEY;
    // If no internal key is configured, don't block dev usage — the gateway
    // is still in front. Log once at startup (done separately).
    if (!expected) return next();

    const provided = (req.headers['x-internal-token'] as string | undefined) ?? '';
    if (provided && provided === expected) return next();

    // Bearer fallback: accept any non-empty bearer token (the gateway has
    // already validated it). Downstream RBAC still applies per-handler.
    if (req.callerContext.bearerToken) return next();

    serviceLogger.warn('Unauthorized notifications request', {
      requestId: req.callerContext.requestId,
      path: req.path,
    });
    sendError(res, 401, 'UNAUTHORIZED', 'Missing or invalid internal auth token');
  });

  // ========================================================================
  // Routes
  // ========================================================================

  // -- GET /notifications ---------------------------------------------------
  app.get('/notifications', async (req, res, next) => {
    try {
      const q = ListNotificationsQuerySchema.parse(req.query);
      const filters: {
        category?: NotificationCategory;
        isRead?: boolean;
        isArchived?: boolean;
      } = {};
      if (q.category) filters.category = q.category as NotificationCategory;
      if (q.status === 'read') filters.isRead = true;
      else if (q.status === 'unread') filters.isRead = false;
      else if (q.status === 'archived') filters.isArchived = true;
      else if (q.status === 'active') filters.isArchived = false;

      const limit = q.pageSize;
      const offset = (q.page - 1) * q.pageSize;

      const result = await inAppNotificationService.listForUser(
        q.tenantId as TenantId,
        q.userId,
        filters,
        limit,
        offset,
      );

      res.json({
        success: true,
        data: result.notifications,
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          total: result.total,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // -- GET /notifications/:id ----------------------------------------------
  app.get('/notifications/:id', async (req, res, next) => {
    try {
      const q = GetOneQuerySchema.parse(req.query);
      const notification = await inAppNotificationService.getById(
        req.params.id as string,
        q.tenantId as TenantId,
        q.userId,
      );
      if (!notification) {
        return sendError(res, 404, 'NOT_FOUND', 'Notification not found');
      }
      return res.json({ success: true, data: notification });
    } catch (err) {
      return next(err);
    }
  });

  // -- POST /notifications/:id/read ----------------------------------------
  app.post('/notifications/:id/read', async (req, res, next) => {
    try {
      const body = MarkReadBodySchema.parse(req.body);
      const updated = await inAppNotificationService.markAsRead(
        req.params.id as string,
        body.tenantId as TenantId,
        body.userId,
      );
      if (!updated) {
        return sendError(res, 404, 'NOT_FOUND', 'Notification not found');
      }
      return res.json({ success: true, data: updated });
    } catch (err) {
      return next(err);
    }
  });

  // -- POST /notifications/send --------------------------------------------
  app.post('/notifications/send', async (req, res, next) => {
    try {
      const body = SendBodySchema.parse(req.body);

      const recipient: NotificationRecipient = {
        tenantId: body.tenantId as TenantId,
        userId: body.userId,
        customerId: body.customerId,
        email: body.email,
        phone: body.phone,
        pushToken: body.pushToken,
        name: body.name,
        locale: body.locale,
      };

      serviceLogger.info('Dispatching notification send', {
        requestId: req.callerContext.requestId,
        tenantId: body.tenantId,
        channel: body.channel,
        templateId: body.templateId,
        requestedBy: body.requestedBy ?? req.callerContext.userId,
      });

      const result = await notificationService.sendNotification(
        recipient,
        body.channel as NotificationChannel,
        body.templateId as NotificationTemplateId,
        body.data,
      );

      if (!result.success) {
        return res.status(422).json({
          success: false,
          error: { code: 'SEND_FAILED', message: result.error ?? 'Notification send failed' },
          data: { id: result.id },
        });
      }
      return res.status(202).json({ success: true, data: { id: result.id } });
    } catch (err) {
      return next(err);
    }
  });

  // -- GET /preferences ----------------------------------------------------
  app.get('/preferences', (req, res, next) => {
    try {
      const q = PreferencesQuerySchema.parse(req.query);
      const prefs = preferencesService.getUserPreferences(q.userId, q.tenantId);
      res.json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  });

  // -- PATCH /preferences --------------------------------------------------
  app.patch('/preferences', (req, res, next) => {
    try {
      const q = PreferencesQuerySchema.parse(req.query);
      const body = PreferencesBodySchema.parse(req.body);
      const updated = preferencesService.updatePreferences(q.userId, q.tenantId, body);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  });

  // ========================================================================
  // 404 + error handling (envelope)
  // ========================================================================

  app.use((_req, res) => {
    sendError(res, 404, 'NOT_FOUND', 'Route not found');
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = req.callerContext?.requestId;

    if (err instanceof z.ZodError) {
      serviceLogger.warn('Validation error', { requestId, issues: err.issues });
      return sendError(res, 400, 'VALIDATION_ERROR', err.issues.map((i) => i.message).join('; '));
    }

    if (err instanceof HttpError) {
      return sendError(res, err.status, err.code, err.message);
    }

    const e = err instanceof Error ? err : new Error(String(err));
    serviceLogger.error('Unhandled error in notifications HTTP handler', e, { requestId });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  });

  return app;
}

// ============================================================================
// Server bootstrap + graceful shutdown
// ============================================================================

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT ?? '4100', 10);
  const app = buildApp();

  if (!process.env.INTERNAL_API_KEY) {
    serviceLogger.warn('INTERNAL_API_KEY is not set — internal auth is disabled');
  }

  // Start the queue consumer so async notification jobs are processed by this
  // instance when REDIS_URL is available. In dev without Redis we tolerate
  // failure so the HTTP server still boots.
  let consumerStarted = false;
  try {
    if (process.env.REDIS_URL || process.env.NODE_ENV === 'production') {
      startNotificationConsumer();
      consumerStarted = true;
      serviceLogger.info('Notification queue consumer started');
    } else {
      serviceLogger.info('Skipping queue consumer (no REDIS_URL in non-production env)');
    }
  } catch (err) {
    serviceLogger.error(
      'Failed to start notification queue consumer',
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  const server = app.listen(port, '0.0.0.0', () => {
    serviceLogger.info('Notifications service listening', {
      port,
      host: '0.0.0.0',
      env: process.env.NODE_ENV ?? 'development',
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    serviceLogger.info('Received shutdown signal', { signal });

    const closeHttp = new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    try {
      await Promise.race([
        closeHttp,
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
      ]);
    } catch (err) {
      serviceLogger.error(
        'Error closing HTTP server',
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    if (consumerStarted) {
      try {
        await stopNotificationConsumer();
        serviceLogger.info('Notification queue consumer drained');
      } catch (err) {
        serviceLogger.error(
          'Error stopping queue consumer',
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }

    serviceLogger.info('Notifications service shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    serviceLogger.error(
      'Unhandled promise rejection',
      reason instanceof Error ? reason : new Error(String(reason)),
    );
  });
}

// ESM entry guard
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  void main();
}
