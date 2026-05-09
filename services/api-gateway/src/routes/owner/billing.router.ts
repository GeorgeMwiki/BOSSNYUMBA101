// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union widens
//   across multiple c.json branches.

/**
 * /api/v1/billing — owner-portal BillingPage skeleton.
 *
 * Wave-2 commit 0ee27a0 converted BillingPage to render a
 * `MissingBackendNotice` declaring `GET /api/v1/billing/subscription` as
 * the missing endpoint. This is the SaaS platform-fee surface (per-tenant
 * invoices remain on `/invoices` via the existing `invoicesService`).
 *
 * Until a Stripe (or alternative) subscription adapter is wired, this
 * returns a degraded subscription object with `status: 'unknown'` and
 * the `X-Backend-Status: degraded` header so the UI can render the
 * placeholder state instead of 404'ing.
 *
 * TODO(api-gateway, BILLING-001): wire platform billing.
 *   Concrete next-step:
 *     1. Add `tenant_subscriptions` migration ({ tenantId, externalId,
 *        plan, status, renewalAt, currency, mrrMinor }).
 *     2. Add `BillingService.getSubscription(tenantId)` in
 *        @bossnyumba/domain-services that wraps Stripe/Paystack.
 *     3. Replace the degraded payload below with the real read.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/hono-auth';
import { requireRole } from '../../middleware/authorization';
import { UserRole } from '../../types/user-role';
import { buildDegradedObject, markDegraded } from './degraded-shape';

const NEXT_STEP =
  'create tenant_subscriptions table + BillingService.getSubscription(tenantId) (Stripe/Paystack adapter) and replace this skeleton';

const app = new Hono();
app.use('*', authMiddleware);
// Subscription / platform billing is tenant-admin scope (the property
// owner pays the platform fee, not individual residents).
app.use(
  '*',
  requireRole(
    UserRole.OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  ),
);

app.get('/subscription', (c) => {
  const auth = c.get('auth');
  markDegraded(c);
  return c.json(
    buildDegradedObject(auth.tenantId, NEXT_STEP, {
      plan: null,
      status: 'unknown',
      renewalAt: null,
      currency: null,
      mrrMinor: 0,
      seats: 0,
    }),
  );
});

export const billingRouter = app;
