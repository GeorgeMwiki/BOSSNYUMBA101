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
 *   GET /overview         — tenant-wide counts + balances
 *   GET /tenants          — convenience alias for superadmin listing (delegated)
 *   GET /webhooks         — frontend gap-fix: honest empty list until the
 *                            outbound webhook registry has a UI surface.
 *   GET /api-keys         — frontend gap-fix: honest empty list until the
 *                            api-key registry exposes a list endpoint.
 *   GET /roles            — frontend gap-fix: honest empty list until the
 *                            roles read-model is exported here.
 *   GET /roles/audit      — frontend gap-fix: honest empty list until the
 *                            role-change audit trail is wired.
 *
 * The four "honest empty" handlers below intentionally return
 * `{ success: true, data: [] }` rather than 503 / `notImplemented` so the
 * owner-portal admin dashboard can render an empty state instead of a
 * spinner that never resolves. Each handler has a clear TODO marker
 * pointing at the backend service that needs to be wired before they
 * begin returning real rows.
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

// ----------------------------------------------------------------------------
// Frontend gap-fix endpoints — owner-portal calls these for the admin
// dashboard cards. The underlying domain services either don't expose a
// list endpoint yet or live behind a registry that the gateway hasn't
// surfaced. Returning an empty array (success: true) lets the page render
// the empty state cleanly. When the underlying services land, swap the
// stub for a real query.
// ----------------------------------------------------------------------------

// GET /webhooks — outbound webhook subscriptions registry.
// TODO(api-gateway): wire to webhook-delivery service / outbound-webhooks
// table once the read endpoint lands. Today only the inbound delivery
// receipt path (`/notification-webhooks/*`) and the DLQ
// (`/webhooks` from createWebhookDlqRouter) exist; the registry of
// subscriptions a tenant has configured is not exposed.
app.get('/webhooks', (c) => {
  return c.json({ success: true, data: [] });
});

// GET /api-keys — tenant-scoped API key listing.
// TODO(api-gateway): wire to assertApiKeyConfig registry. The current
// `api-key-registry` middleware enforces presence at boot but does not
// expose a list/CRUD surface for the UI.
app.get('/api-keys', (c) => {
  return c.json({ success: true, data: [] });
});

// GET /roles — tenant-scoped roles read-model.
// TODO(api-gateway): wire to a Drizzle query over `roles` once the role
// listing is gated behind the same RBAC predicates the assignment flow
// uses. Returning empty here until then so the page renders.
app.get('/roles', (c) => {
  return c.json({ success: true, data: [] });
});

// GET /roles/audit — recent role change audit entries.
// TODO(api-gateway): wire to audit-trail (`/audit-trail/entries` filter
// for role-change events) once that filter is exposed.
app.get('/roles/audit', (c) => {
  return c.json({ success: true, data: [] });
});

export const adminPortalRouter = app;
