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
import { authEnhancedRouter } from './routes/auth-enhanced';
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
import { approvalsRouter } from './routes/approvals';
import { maintenanceRouter } from './routes/maintenance.hono';
import { documentsEnhancedRouter, evidencePacksRouter } from './routes/modules/documents.routes';
import { maintenanceRequestsRouter } from './routes/modules/maintenance.routes';
import { invoicesRouter as moduleInvoicesRouter, paymentsRouter as modulePaymentsRouter, reconciliationRouter, statementsRouter } from './routes/modules/payments.routes';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import { customerAppRouter } from './routes/bff/customer-app';
import { ownerPortalRouter } from './routes/bff/owner-portal';
import { estateManagerAppRouter } from './routes/bff/estate-manager-app';
import { adminPortalRouter } from './routes/bff/admin-portal';

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

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// API v1 - Hono routes
const api = new Hono();
api.route('/auth', authRouter);
api.route('/auth-enhanced', authEnhancedRouter);
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
api.route('/approvals', approvalsRouter);
api.route('/maintenance', maintenanceRouter);
api.route('/documents-enhanced', documentsEnhancedRouter);
api.route('/evidence-packs', evidencePacksRouter);
api.route('/maintenance-requests', maintenanceRequestsRouter);
api.route('/module-invoices', moduleInvoicesRouter);
api.route('/module-payments', modulePaymentsRouter);
api.route('/reconciliation', reconciliationRouter);
api.route('/statements', statementsRouter);
api.route('/customer', customerAppRouter);
api.route('/owner', ownerPortalRouter);
api.route('/manager', estateManagerAppRouter);
api.route('/admin', adminPortalRouter);
app.use('/api/v1', handle(api));

// API versioning
app.get('/api/v1', (_req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: [
      '/api/v1/auth',
      '/api/v1/auth-enhanced',
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
      '/api/v1/approvals',
      '/api/v1/maintenance',
      '/api/v1/documents-enhanced',
      '/api/v1/evidence-packs',
      '/api/v1/maintenance-requests',
      '/api/v1/module-invoices',
      '/api/v1/module-payments',
      '/api/v1/reconciliation',
      '/api/v1/statements',
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
