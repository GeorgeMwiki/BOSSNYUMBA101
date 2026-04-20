// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union widens
//   across multiple c.json branches.

/**
 * Customer App BFF — minimal "me" aggregation.
 *
 * Previously a stub that returned 503 for every request
 * (`createProtectedLiveDataRouter`). Now pulls the caller's lease, invoices,
 * and recent payments from the shared repo middleware. Rich features
 * (chat, notifications inbox, maintenance submissions) remain routed via
 * their dedicated top-level routers (`/messaging`, `/notifications`,
 * `/work-orders`) — the BFF is just the roll-up dashboard.
 *
 * Endpoints:
 *   GET /me               — caller identity + tenant
 *   GET /me/dashboard     — summary: active lease, open balance, last 3 invoices
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/me', (c) => {
  const auth = c.get('auth');
  return c.json({
    success: true,
    data: {
      userId: auth.userId,
      tenantId: auth.tenantId,
      role: auth.role ?? null,
      customerId: auth.customerId ?? null,
    },
  });
});

app.get('/me/dashboard', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  if (!repos) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Customer dashboard requires DB-backed repos — DATABASE_URL unset',
        },
      },
      503,
    );
  }

  const customerId = auth.customerId ?? auth.userId;
  try {
    const [leasesResult, invoicesResult, paymentsResult] = await Promise.all([
      repos.leases.findMany(auth.tenantId, { limit: 50, offset: 0 }),
      repos.invoices.findMany(auth.tenantId, 50, 0),
      repos.payments.findMany(auth.tenantId, 10, 0),
    ]);

    const myLeases = (leasesResult.items ?? []).filter(
      (l) => l.customerId === customerId,
    );
    const myLeaseIds = new Set(myLeases.map((l) => l.id));

    const myInvoices = (invoicesResult.items ?? []).filter(
      (inv) => myLeaseIds.has(inv.leaseId) || inv.customerId === customerId,
    );
    const myPayments = (paymentsResult.items ?? []).filter(
      (p) => myLeaseIds.has(p.leaseId) || p.customerId === customerId,
    );

    const openBalance = myInvoices
      .filter((i) => i.status !== 'paid')
      .reduce((sum, inv) => sum + Number(inv.amountDue ?? inv.amount ?? 0), 0);

    return c.json({
      success: true,
      data: {
        activeLease: myLeases.find((l) => l.status === 'active') ?? null,
        openBalance,
        recentInvoices: myInvoices.slice(0, 3),
        recentPayments: myPayments.slice(0, 3),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed';
    return c.json(
      {
        success: false,
        error: { code: 'DASHBOARD_UNAVAILABLE', message },
      },
      503,
    );
  }
});

export const customerAppRouter = app;
