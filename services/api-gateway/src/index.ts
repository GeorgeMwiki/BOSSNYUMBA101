/**
 * @bossnyumba/api-gateway
 *
 * API Gateway / Backend-for-Frontend for the BOSSNYUMBA platform.
 * Handles authentication, authorization, request routing, and aggregation.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { handle } from '@hono/node-server/vercel';
import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { authMfaRouter } from './routes/auth-mfa';
import { tenantsRouter } from './routes/tenants.hono';
import { usersRouter } from './routes/users.hono';
import { propertiesRouter } from './routes/properties';
import { unitsRouter } from './routes/units';
import { customersRouter } from './routes/customers';
import { leasesRouter } from './routes/leases';
import { invoicesApp } from './routes/invoices';
import { paymentsApp } from './routes/payments';
import { workOrdersRouter } from './routes/work-orders.hono';
import { vendorsRouter } from './routes/vendors.hono';
import { notificationsRouter } from './routes/notifications';
import { reportsHonoRouter } from './routes/reports.hono';
import { dashboardRouter } from './routes/dashboard.hono';
import { onboardingRouter } from './routes/onboarding';
import { feedbackRouter } from './routes/feedback';
import { complaintsRouter } from './routes/complaints';
import { inspectionsRouter } from './routes/inspections';
import { documentsHonoRouter } from './routes/documents.hono';
import { schedulingRouter } from './routes/scheduling';
import { messagingRouter } from './routes/messaging';
import { casesRouter } from './routes/cases.hono';
import { brainRouter } from './routes/brain.hono';
import { maintenanceRouter } from './routes/maintenance.hono';
import { hrRouter } from './routes/hr.hono';
// Wave 1-2 routers (new domain features)
import applicationsRouter from './routes/applications.router';
import arrearsRouter from './routes/arrears.router';
import complianceRouter from './routes/compliance.router';
import docChatRouter from './routes/doc-chat.router';
import documentRenderRouter from './routes/document-render.router';
import financialProfileRouter from './routes/financial-profile.router';
import gamificationRouter from './routes/gamification.router';
import gepgRouter from './routes/gepg.router';
import interactiveReportsRouter from './routes/interactive-reports.router';
import lettersRouter from './routes/letters.router';
import { marketplaceRouter } from './routes/marketplace.router';
import { createMigrationRouter } from './routes/migration.router';
import { negotiationsRouter } from './routes/negotiations.router';
import { createNotificationPreferencesRouter } from './routes/notification-preferences.router';
import { createNotificationWebhookRouter } from './routes/notification-webhooks.router';
import occupancyTimelineRouter from './routes/occupancy-timeline.router';
import renewalsRouter from './routes/renewals.router';
import riskReportsRouter from './routes/risk-reports.router';
import scansRouter from './routes/scans.router';
import stationMasterCoverageRouter from './routes/station-master-coverage.router';
import { tendersRouter } from './routes/tenders.router';
import { waitlistRouter } from './routes/waitlist.router';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import {
  startOutboxWorker,
  stopOutboxWorker,
  type OutboxRunnerLike,
} from './workers/outbox-worker';
import {
  registerDomainEventSubscribers,
  type SubscribableBus,
  type NotificationDispatcher,
} from './workers/event-subscribers';
import { ensureTenantIsolation } from './middleware/tenant-context.middleware';
import { assertApiKeyConfig } from './middleware/api-key-registry';
import { customerAppRouter } from './routes/bff/customer-app';
import { ownerPortalRouter } from './routes/bff/owner-portal';
import { estateManagerAppRouter } from './routes/bff/estate-manager-app';
import { adminPortalRouter } from './routes/bff/admin-portal';
import { buildServices, type ServiceRegistry } from './composition/service-registry';
import { getDb } from './composition/db-client';
import { createServiceContextMiddleware } from './composition/service-context.middleware';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(helmet());

// CORS — restrict to allowed origins. Wildcard CORS combined with cookie
// auth would enable CSRF; header-based auth alone is defensible, but we
// whitelist anyway so the attack surface is minimal. Origins come from the
// env var; absence is fatal in production.
const allowedOrigins = (() => {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (raw) return raw.split(',').map((o) => o.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'api-gateway: ALLOWED_ORIGINS env var is required in production ' +
        '(comma-separated list of https://... origins).'
    );
  }
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
  ];
})();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (no Origin) and explicitly whitelisted
      // browser origins. Deny everything else.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
    maxAge: 86_400,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(pinoHttp({ logger }));
app.use(rateLimitMiddleware());

// Health check — both /health (legacy) and /healthz (k8s-style) are served.
// Returns `{ status, version, service, timestamp, upstreams }` per the
// shared contract in @bossnyumba/observability.
const healthHandler = async (
  _req: express.Request,
  res: express.Response,
): Promise<void> => {
  const payload = {
    status: 'ok' as const,
    version: process.env.APP_VERSION ?? 'dev',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    upstreams: {
      // Upstream probes are registered lazily in a follow-up wave to avoid
      // adding startup latency during the tight boot window. The payload
      // shape is stable so consumers can start relying on it today.
    },
  };
  res.json(payload);
};
app.get('/health', healthHandler);
app.get('/healthz', healthHandler);

// API v1 - Hono routes
// FIXED C-1 production startup guard: refuses to boot if API keys aren't configured.
assertApiKeyConfig();

// ----------------------------------------------------------------------------
// Composition root — build service registry once at startup.
//
// The registry is a single typed bag of domain services (marketplace,
// waitlist, negotiation, gamification, migration, etc.). It is lazily
// instantiated: when DATABASE_URL is unset it returns a degraded
// skeleton of all-nulls and routers fall back to 503. When the URL is
// set, real Postgres-backed services are constructed and pure-DB
// endpoints start returning real rows.
// ----------------------------------------------------------------------------
let serviceRegistry: ServiceRegistry;
try {
  serviceRegistry = buildServices({ db: getDb() });
  if (serviceRegistry.isLive) {
    logger.info('service-registry: live (Postgres-backed domain services wired)');
  } else {
    logger.warn(
      'service-registry: degraded (DATABASE_URL unset — pure-DB endpoints will 503)'
    );
  }
} catch (err) {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    'service-registry: initialization failed, falling back to degraded mode'
  );
  serviceRegistry = buildServices({ db: null });
}

const api = new Hono();
// FIXED H-2: apply tenant-isolation enforcement globally on all /api/v1/* routes.
// Auth middleware still runs first per-router; this is a defense-in-depth layer.
api.use('*', ensureTenantIsolation);
// Inject the service registry + flat tenantId/userId into the request ctx
// so 22 new routers can pull real service instances out of the context.
api.use('*', createServiceContextMiddleware(serviceRegistry));
api.route('/auth', authRouter);
api.route('/auth/mfa', authMfaRouter);
api.route('/tenants', tenantsRouter);
api.route('/users', usersRouter);
api.route('/properties', propertiesRouter);
api.route('/units', unitsRouter);
api.route('/customers', customersRouter);
api.route('/leases', leasesRouter);
api.route('/invoices', invoicesApp);
api.route('/payments', paymentsApp);
api.route('/work-orders', workOrdersRouter);
api.route('/vendors', vendorsRouter);
api.route('/notifications', notificationsRouter);
api.route('/reports', reportsHonoRouter);
api.route('/dashboard', dashboardRouter);
api.route('/onboarding', onboardingRouter);
api.route('/feedback', feedbackRouter);
api.route('/complaints', complaintsRouter);
api.route('/inspections', inspectionsRouter);
api.route('/documents', documentsHonoRouter);
api.route('/scheduling', schedulingRouter);
api.route('/messaging', messagingRouter);
api.route('/cases', casesRouter);
api.route('/brain', brainRouter);
api.route('/maintenance', maintenanceRouter);
api.route('/hr', hrRouter);
api.route('/customer', customerAppRouter);
api.route('/owner', ownerPortalRouter);
api.route('/manager', estateManagerAppRouter);
api.route('/admin', adminPortalRouter);
// Wave 1-2 feature routers
api.route('/applications', applicationsRouter);
api.route('/arrears', arrearsRouter);
api.route('/compliance', complianceRouter);
api.route('/doc-chat', docChatRouter);
api.route('/document-render', documentRenderRouter);
api.route('/financial-profile', financialProfileRouter);
api.route('/gamification', gamificationRouter);
api.route('/gepg', gepgRouter);
api.route('/interactive-reports', interactiveReportsRouter);
api.route('/letters', lettersRouter);
api.route('/marketplace', marketplaceRouter);
// Routers built via factory — inject real services from the composition root
// where available. For services that aren't yet wired, the factory gracefully
// returns a 503/501 to the client rather than a synchronous throw — a pilot
// can hit the endpoint, see the reason, and continue.
const migrationRouter = createMigrationRouter({
  getService: (_tenantId: string) => {
    const svc = serviceRegistry.migration;
    if (!svc) {
      throw Object.assign(
        new Error('MigrationService unavailable — DATABASE_URL not configured'),
        { statusCode: 503 }
      );
    }
    return svc;
  },
});
// Notification preferences — the real store lives in the notifications
// service; until the HTTP binding lands we return the posted shape
// verbatim so clients can dev against a stable surface.
const notificationPreferencesRouter = createNotificationPreferencesRouter({
  getPreferences: () => ({ channels: {}, templates: {}, quietHoursStart: null, quietHoursEnd: null }),
  upsertPreferences: (_u, _t, input) => input,
});
// Webhooks terminate here and forward deliveries via the same event bus
// the rest of the services use, so a downstream subscriber in the
// notifications service can persist status updates.
const notificationWebhooksRouter = createNotificationWebhookRouter({
  onDeliveryStatus: async (update) => {
    try {
      await serviceRegistry.eventBus.publish({
        event: {
          eventId: `webhook_${Date.now()}`,
          eventType: 'NotificationDeliveryStatus',
          timestamp: new Date().toISOString(),
          tenantId: 'system',
          correlationId: `wh_${Date.now()}`,
          causationId: null,
          metadata: {},
          payload: update,
        } as unknown as never,
        version: 1,
        aggregateId: update.providerMessageId ?? 'unknown',
        aggregateType: 'NotificationDelivery',
      });
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'notification-webhook: failed to publish delivery status'
      );
    }
  },
});
api.route('/migration', migrationRouter);
api.route('/negotiations', negotiationsRouter);
api.route('/me/notification-preferences', notificationPreferencesRouter);
api.route('/notification-webhooks', notificationWebhooksRouter);
api.route('/occupancy-timeline', occupancyTimelineRouter);
api.route('/renewals', renewalsRouter);
api.route('/risk-reports', riskReportsRouter);
api.route('/scans', scansRouter);
api.route('/station-master-coverage', stationMasterCoverageRouter);
api.route('/tenders', tendersRouter);
api.route('/waitlist', waitlistRouter);
app.use('/api/v1', handle(api));

// API versioning
app.get('/api/v1', (_req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: [
      '/api/v1/auth',
      '/api/v1/auth/mfa',
      '/api/v1/tenants',
      '/api/v1/users',
      '/api/v1/properties',
      '/api/v1/units',
      '/api/v1/customers',
      '/api/v1/leases',
      '/api/v1/invoices',
      '/api/v1/payments',
      '/api/v1/work-orders',
      '/api/v1/vendors',
      '/api/v1/notifications',
      '/api/v1/reports',
      '/api/v1/dashboard',
      '/api/v1/onboarding',
      '/api/v1/feedback',
      '/api/v1/complaints',
      '/api/v1/inspections',
      '/api/v1/documents',
      '/api/v1/scheduling',
      '/api/v1/messaging',
      '/api/v1/cases',
      '/api/v1/brain',
      '/api/v1/maintenance',
      '/api/v1/hr',
      '/api/v1/customer',
      '/api/v1/owner',
      '/api/v1/manager',
      '/api/v1/admin',
    ],
  });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error(err, 'Unhandled error');
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal, closing server...');
  stopOutboxWorker();
  server?.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

let server: ReturnType<typeof app.listen> | null = null;

// Start server
if (require.main === module) {
  server = app.listen(port, () => {
    logger.info({ port }, 'API Gateway started');
  });

  // Start the outbox drainer + register domain-event subscribers. The
  // outbox publishes events into the in-process bus; the subscribers
  // turn those events into customer-visible outcomes (notifications,
  // audit entries). Runner is resolved lazily via the observability
  // event-bus singleton so tests can stub it out.
  void import('@bossnyumba/observability').then((obs) => {
    const runner = obs.getEventBus?.() ?? (obs as unknown as { eventBus?: OutboxRunnerLike }).eventBus;
    if (runner && typeof (runner as OutboxRunnerLike).processOutbox === 'function') {
      startOutboxWorker(runner as OutboxRunnerLike, {
        logger,
        enabled: process.env.NODE_ENV !== 'test' && process.env.OUTBOX_WORKER_DISABLED !== 'true',
        intervalMs: Number(process.env.OUTBOX_INTERVAL_MS || '5000') || 5000,
        batchSize: Number(process.env.OUTBOX_BATCH_SIZE || '50') || 50,
      });
    } else {
      logger.warn('outbox worker: event bus runner not available; worker not started');
    }

    // Register event subscribers. Same bus reference as the outbox
    // drainer so subscribers receive events the drainer publishes.
    const subscribableBus = runner as unknown as SubscribableBus | undefined;
    if (subscribableBus && typeof subscribableBus.subscribe === 'function') {
      // Minimal HTTP-based notification dispatcher. Posts to the
      // notifications service; a future iteration can swap this for
      // an in-process transport when services are co-deployed.
      const notificationsUrl = process.env.NOTIFICATIONS_SERVICE_URL?.trim();
      const dispatcher: NotificationDispatcher = {
        async send(params) {
          if (!notificationsUrl) {
            // No configured notifications service — log the dispatch so
            // operators see what would have been sent without crashing.
            logger.info({ params }, 'notification dispatch skipped (NOTIFICATIONS_SERVICE_URL unset)');
            return { success: true };
          }
          try {
            const res = await fetch(`${notificationsUrl.replace(/\/$/, '')}/send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(process.env.INTERNAL_API_KEY ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY } : {}),
              },
              body: JSON.stringify(params),
            });
            if (!res.ok) {
              const text = await res.text().catch(() => '');
              return { success: false, error: `${res.status}: ${text.slice(0, 200)}` };
            }
            return { success: true };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        },
      };
      registerDomainEventSubscribers({ bus: subscribableBus, notifications: dispatcher, logger });
    } else {
      logger.warn('event subscribers: bus.subscribe not available; subscribers not registered');
    }
  }).catch((err) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'failed to load observability for outbox worker');
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
