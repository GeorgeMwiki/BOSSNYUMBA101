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
 * spinner that never resolves. Each handler has a clear follow-up reference
 * pointing at the backend service that needs to be wired before they
 * begin returning real rows.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/hono-auth';
import { requireRole } from '../../middleware/authorization';
import { databaseMiddleware } from '../../middleware/database';
import { UserRole, isPlatformAdmin } from '../../types/user-role';
import { routeCatch } from '../../utils/safe-error';
import { getDb } from '../../composition/db-client';
import {
  computeAllIndustrySlots,
  computeIndustrySlot,
  isIndustrySlotKey,
  INDUSTRY_SLOT_KEYS,
} from './industry-metrics';

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

// Helper: resolve a feature flag from services.featureFlags. Defaults to
// false (off) so 501-Not-Implemented is the loud-failure path.
async function adminFlagOn(c: any, flagKey: string): Promise<boolean> {
  const services = c.get('services') ?? {};
  const ff = services.featureFlags;
  if (!ff || typeof ff.isEnabled !== 'function') return false;
  try {
    const auth = c.get('auth');
    return Boolean(await ff.isEnabled(auth?.tenantId ?? '', flagKey));
  } catch {
    return false;
  }
}

function notImpl(c: any, flagKey: string, nextStep: string) {
  c.header('X-Backend-Status', 'degraded');
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `Downstream service for this endpoint is not wired. Concrete next-step: ${nextStep}`,
        flagKey,
      },
    },
    501,
  );
}

// GET /webhooks — outbound webhook subscriptions registry.
// ADMIN-BFF-001: real wire when `repos.outboundWebhooks.findMany` exists.
// Otherwise: loud-fail 501 unless the per-tenant feature flag is on.
app.get('/webhooks', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos') as { outboundWebhooks?: { findMany?: Function } } | undefined;
  const findMany = repos?.outboundWebhooks?.findMany;
  if (typeof findMany === 'function') {
    const rows = await findMany.call(repos!.outboundWebhooks, auth.tenantId);
    return c.json({ success: true, data: rows ?? [] });
  }
  if (!(await adminFlagOn(c, 'flag.bff.admin_portal.webhooks'))) {
    return notImpl(
      c,
      'flag.bff.admin_portal.webhooks',
      'expose repos.outboundWebhooks.findMany(tenantId) and call it here',
    );
  }
  return c.json({ success: true, data: [] });
});

// GET /api-keys — tenant-scoped API key listing.
// ADMIN-BFF-002: real wire when an api-key registry exposes listForTenant.
app.get('/api-keys', async (c) => {
  const auth = c.get('auth');
  const services = c.get('services') as { apiKeyRegistry?: { listForTenant?: Function } } | undefined;
  const list = services?.apiKeyRegistry?.listForTenant;
  if (typeof list === 'function') {
    const rows = await list.call(services!.apiKeyRegistry, auth.tenantId);
    return c.json({ success: true, data: rows ?? [] });
  }
  if (!(await adminFlagOn(c, 'flag.bff.admin_portal.api_keys'))) {
    return notImpl(
      c,
      'flag.bff.admin_portal.api_keys',
      'add apiKeyRegistry.listForTenant(tenantId) returning { keyId, label, lastUsedAt }',
    );
  }
  return c.json({ success: true, data: [] });
});

// GET /roles — tenant-scoped roles read-model.
// ADMIN-BFF-003: real wire when `repos.roles.findMany` exists.
app.get('/roles', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos') as { roles?: { findMany?: Function } } | undefined;
  const findMany = repos?.roles?.findMany;
  if (typeof findMany === 'function') {
    const rows = await findMany.call(repos!.roles, auth.tenantId);
    return c.json({ success: true, data: rows ?? [] });
  }
  if (!(await adminFlagOn(c, 'flag.bff.admin_portal.roles'))) {
    return notImpl(
      c,
      'flag.bff.admin_portal.roles',
      'select id,name,scope from roles where tenantId = auth.tenantId via repos.roles.findMany',
    );
  }
  return c.json({ success: true, data: [] });
});

// GET /roles/audit — recent role change audit entries.
// ADMIN-BFF-004: real wire when audit trail exposes a typed eventType filter.
app.get('/roles/audit', async (c) => {
  const auth = c.get('auth');
  const services = c.get('services') as { auditTrail?: { findByEventType?: Function } } | undefined;
  const findByEventType = services?.auditTrail?.findByEventType;
  if (typeof findByEventType === 'function') {
    const rows = await findByEventType.call(services!.auditTrail, auth.tenantId, 'role_change');
    return c.json({ success: true, data: rows ?? [] });
  }
  if (!(await adminFlagOn(c, 'flag.bff.admin_portal.roles_audit'))) {
    return notImpl(
      c,
      'flag.bff.admin_portal.roles_audit',
      'expose audit-trail filter by eventType=role_change scoped to tenantId',
    );
  }
  return c.json({ success: true, data: [] });
});

// ----------------------------------------------------------------------------
// Industry dashboard — HQ-tier, cross-tenant KPI rollup.
//
// Backs admin-platform-portal `/industry`. The router-level gate above
// admits TENANT_ADMIN for the tenant-scoped admin cards, but the
// industry surface is a BossNyumba-HQ rollup that reads ACROSS tenants
// via the service-role db handle — so each industry handler additionally
// asserts `isPlatformAdmin(role)` and rejects tenant-scoped admins with
// a uniform 403. This mirrors `platform-overview.hono.ts`.
//
// No new table / migration: every metric is computed from canonical
// tables that already exist with FORCE RLS (arrears_cases, units,
// work_orders, leases, friction_fingerprints). Cross-tenant reads use
// `getDb()` (service-role) exactly like platform-overview.
// ----------------------------------------------------------------------------

const IndustrySlotParamSchema = z.object({
  slot: z
    .string()
    .min(1)
    .max(64)
    .refine(isIndustrySlotKey, {
      message: `slot must be one of: ${INDUSTRY_SLOT_KEYS.join(', ')}`,
    }),
});

/**
 * Guard: industry endpoints are platform-HQ only. Returns a 403
 * Response when the caller is not a platform admin, else `null`.
 */
function requirePlatformHq(c: any): Response | null {
  const auth = c.get('auth') ?? {};
  const role = auth.role as UserRole | undefined;
  if (!role || !isPlatformAdmin(role)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message:
            'industry KPIs require a platform-tier role (SUPER_ADMIN / ADMIN / SUPPORT)',
        },
      },
      403,
    );
  }
  return null;
}

// GET /industry — all six KPI slots in one cross-tenant rollup. Returns
// `{ success: true, data: { [slot]: SlotPayload | null } }`; a null slot
// means that single metric's query failed and the page should degrade
// just that card.
app.get('/industry', async (c) => {
  const denied = requirePlatformHq(c);
  if (denied) return denied;

  const db = getDb();
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Industry KPIs require a database connection — DATABASE_URL unset',
        },
      },
      503,
    );
  }

  try {
    const slots = await computeAllIndustrySlots(db);
    return c.json({ success: true, data: slots });
  } catch (error) {
    return routeCatch(c, error, {
      code: 'INDUSTRY_UNAVAILABLE',
      status: 503,
      fallback: 'Industry aggregation failed',
    });
  }
});

// GET /industry/:slot — one KPI slot. The page fetches these per-card so
// a single slow/failed metric never blocks the others. The success body
// is the bare SlotPayload under `data`; an unknown slot is a uniform 404,
// a DB failure a 503 (→ honest DegradedCard, never a fabricated value).
app.get('/industry/:slot', async (c) => {
  const denied = requirePlatformHq(c);
  if (denied) return denied;

  const parsed = IndustrySlotParamSchema.safeParse({ slot: c.req.param('slot') });
  if (!parsed.success) {
    // Uniform 404 (anti-enumeration) — we do not echo the valid-slot list
    // to an unauthenticated probe path; the gate above already ran.
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Unknown industry slot' },
      },
      404,
    );
  }

  const db = getDb();
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Industry KPIs require a database connection — DATABASE_URL unset',
        },
      },
      503,
    );
  }

  try {
    const payload = await computeIndustrySlot(db, parsed.data.slot);
    if (payload === null) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SLOT_UNAVAILABLE',
            message: 'This metric could not be computed right now.',
          },
        },
        503,
      );
    }
    return c.json({ success: true, data: payload });
  } catch (error) {
    return routeCatch(c, error, {
      code: 'INDUSTRY_UNAVAILABLE',
      status: 503,
      fallback: 'Industry aggregation failed',
    });
  }
});

export const adminPortalRouter = app;
