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
import { getDatabaseClient } from './middleware/database';
import { authRouter } from './routes/auth';
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
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import { customerAppRouter } from './routes/bff/customer-app';
import { ownerPortalRouter } from './routes/bff/owner-portal';
import { estateManagerAppRouter } from './routes/bff/estate-manager-app';
import { adminPortalRouter } from './routes/bff/admin-portal';
import { adminRouter } from './routes/admin';
import { aiRouter } from './routes/ai';
import { supportRouter } from './routes/support';
import { platformRouter } from './routes/platform';
import { analyticsRouter } from './routes/analytics';
import { complianceRouter } from './routes/compliance';
import { portfolioRouter } from './routes/portfolio';
import { budgetsRouter } from './routes/budgets';
import { invitationsRouter } from './routes/invitations';
import { approvalsRouter } from './routes/approvals';
import { requestsRouter } from './routes/requests';
import { systemRouter } from './routes/system';
import { communicationsRouter } from './routes/communications';
import { emergenciesRouter } from './routes/emergencies';
import { utilitiesRouter } from './routes/utilities';
import { maintenanceRouter } from './routes/maintenance';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger }));
app.use(rateLimitMiddleware());

// Health check — surfaces downstream reachability so ops can diagnose at a glance.
const SERVICE_VERSION = process.env.SERVICE_VERSION || process.env.npm_package_version || '1.0.0';
const SERVICE_START_TIME = Date.now();

type CheckStatus = 'ok' | 'down' | 'unknown';

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function checkDatabase(): Promise<CheckStatus> {
  const db = getDatabaseClient();
  if (!db) return 'unknown';
  try {
    // Lazy import so drizzle-orm is only pulled in when a live DB is configured.
    const { sql } = await import('drizzle-orm');
    await withTimeout((db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute(sql`SELECT 1`), 500);
    return 'ok';
  } catch (err) {
    logger.warn({ err }, 'health: db check failed');
    return 'down';
  }
}

async function checkRedis(): Promise<CheckStatus> {
  // No Redis client is wired into the gateway process today
  // (rate limiter uses an in-memory store). Report 'unknown' until one exists.
  const g = globalThis as unknown as { __redisClient?: { ping: () => Promise<string> } };
  const client = g.__redisClient;
  if (!client || typeof client.ping !== 'function') return 'unknown';
  try {
    await withTimeout(client.ping(), 500);
    return 'ok';
  } catch (err) {
    logger.warn({ err }, 'health: redis check failed');
    return 'down';
  }
}

async function checkHttp(url: string | undefined, timeoutMs: number): Promise<CheckStatus> {
  if (!url) return 'unknown';
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return res.ok ? 'ok' : 'down';
  } catch (err) {
    logger.warn({ err, url }, 'health: upstream check failed');
    return 'down';
  } finally {
    clearTimeout(t);
  }
}

app.get('/health', async (_req, res) => {
  const [db, redis, notifications, paymentsLedger] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkHttp(process.env.NOTIFICATIONS_SERVICE_URL, 1000),
    checkHttp(process.env.PAYMENTS_LEDGER_URL, 1000),
  ]);

  const checks = { db, redis, notifications, paymentsLedger };

  // Hard-fail only on DB down; optional deps being 'down' or 'unknown' degrade but don't 503.
  const hardFail = db === 'down';
  const anyDown =
    db === 'down' || redis === 'down' || notifications === 'down' || paymentsLedger === 'down';
  const status: 'ok' | 'degraded' = anyDown ? 'degraded' : 'ok';

  res.status(hardFail ? 503 : 200).json({
    status,
    service: 'api-gateway',
    uptime: Math.floor((Date.now() - SERVICE_START_TIME) / 1000),
    version: SERVICE_VERSION,
    checks,
  });
});

// API v1 - Hono routes
const api = new Hono();
api.route('/auth', authRouter);
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
api.route('/customer', customerAppRouter);
api.route('/owner', ownerPortalRouter);
api.route('/manager', estateManagerAppRouter);
api.route('/admin', adminRouter);
api.route('/admin-portal', adminPortalRouter);
api.route('/ai', aiRouter);
api.route('/support', supportRouter);
api.route('/platform', platformRouter);
api.route('/analytics', analyticsRouter);
api.route('/compliance', complianceRouter);
api.route('/portfolio', portfolioRouter);
api.route('/budgets', budgetsRouter);
api.route('/invitations', invitationsRouter);
api.route('/approvals', approvalsRouter);
api.route('/requests', requestsRouter);
api.route('/system', systemRouter);
api.route('/communications', communicationsRouter);
api.route('/emergencies', emergenciesRouter);
api.route('/utilities', utilitiesRouter);
api.route('/maintenance', maintenanceRouter);
app.use('/api/v1', handle(api));

// API versioning
app.get('/api/v1', (_req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: [
      '/api/v1/auth',
      '/api/v1/tenants',
      '/api/v1/users',
      '/api/v1/properties',
      '/api/v1/units',
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

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
