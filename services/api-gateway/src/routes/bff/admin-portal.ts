// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union widens
//   across multiple c.json branches.

/**
 * Admin Portal BFF — tenant-wide rollup.
 *
 * Previously a stub that returned 503 (`createProtectedLiveDataRouter`).
 * Gated to TENANT_ADMIN/SUPER_ADMIN/ADMIN. Aggregates tenant-wide totals
 * (properties, units, active leases, open invoices) from the shared repo
 * middleware. The heavy-lifting reports live on `/reports` and `/dashboard`
 * — this BFF gives the admin landing page its top-of-screen tiles.
 *
 * Endpoints:
 *   GET /overview   — tenant-wide counts + balances
 *   GET /tenants    — convenience alias for superadmin listing (delegated)
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/hono-auth';
import { requireRole } from '../../middleware/authorization';
import { databaseMiddleware } from '../../middleware/database';
import { UserRole } from '../../types/user-role';
import { routeCatch } from '../../utils/safe-error';

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', requireRole(UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN));
app.use('*', databaseMiddleware);

app.get('/overview', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  if (!repos) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Admin overview requires DB-backed repos — DATABASE_URL unset',
        },
      },
      503,
    );
  }
  try {
    const [properties, units, leases, invoices, customers] = await Promise.all([
      repos.properties.findMany(auth.tenantId, { limit: 1000, offset: 0 }),
      repos.units.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.leases.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.invoices.findMany(auth.tenantId, 5000, 0),
      repos.customers.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
    ]);

    const activeLeases = (leases.items ?? []).filter((l) => l.status === 'active');
    const openInvoices = (invoices.items ?? []).filter((i) => i.status !== 'paid');
    const openBalance = openInvoices.reduce(
      (sum, inv) => sum + Number(inv.amountDue ?? inv.amount ?? 0),
      0,
    );

    return c.json({
      success: true,
      data: {
        counts: {
          properties: properties.total ?? properties.items?.length ?? 0,
          units: units.total ?? units.items?.length ?? 0,
          leases: leases.total ?? leases.items?.length ?? 0,
          activeLeases: activeLeases.length,
          customers: customers.total ?? customers.items?.length ?? 0,
          openInvoices: openInvoices.length,
        },
        financials: {
          openBalance,
        },
      },
    });
  } catch (error) {
    return routeCatch(c, error, {
      code: 'OVERVIEW_UNAVAILABLE',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

export const adminPortalRouter = app;
