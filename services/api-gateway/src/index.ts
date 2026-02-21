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
import { onboardingRouter } from './routes/onboarding';
import { feedbackRouter } from './routes/feedback';
import { complaintsRouter } from './routes/complaints';
import { inspectionsRouter } from './routes/inspections';
import { documentsHonoRouter } from './routes/documents.hono';
import { schedulingRouter } from './routes/scheduling';
import { messagingRouter } from './routes/messaging';
import { casesRouter } from './routes/cases.hono';
import { customerAppRouter } from './routes/bff/customer-app';
import { adminPortalRouter } from './routes/bff/admin-portal';
import { estateManagerAppRouter } from './routes/bff/estate-manager-app';
import { ownerPortalRouter } from './routes/bff/owner-portal';
import { dashboardRouter } from './routes/dashboard';
import { approvalsRouter } from './routes/approvals';
import { authMiddleware } from './middleware/auth';

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
api.route('/onboarding', onboardingRouter);
api.route('/feedback', feedbackRouter);
api.route('/complaints', complaintsRouter);
api.route('/inspections', inspectionsRouter);
api.route('/documents', documentsHonoRouter);
api.route('/scheduling', schedulingRouter);
api.route('/messaging', messagingRouter);
api.route('/cases', casesRouter);

// BFF routes - persona-optimized endpoints for each frontend app
api.route('/bff/customer', customerAppRouter);
api.route('/bff/admin', adminPortalRouter);
api.route('/bff/estate-manager', estateManagerAppRouter);
api.route('/bff/owner', ownerPortalRouter);

app.use('/api/v1', handle(api));

// Express routes (dashboard, approvals)
app.use('/api/v1/dashboard', authMiddleware, dashboardRouter);
app.use('/api/v1/approvals', authMiddleware, approvalsRouter);

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
      '/api/v1/onboarding',
      '/api/v1/feedback',
      '/api/v1/complaints',
      '/api/v1/inspections',
      '/api/v1/documents',
      '/api/v1/scheduling',
      '/api/v1/messaging',
      '/api/v1/cases',
      '/api/v1/dashboard',
      '/api/v1/approvals',
      '/api/v1/bff/customer',
      '/api/v1/bff/admin',
      '/api/v1/bff/estate-manager',
      '/api/v1/bff/owner',
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

// Start server
if (require.main === module) {
  app.listen(port, () => {
    logger.info({ port }, 'API Gateway started');
  });
}

export default app;
