// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union widens
//   across multiple c.json branches; tracked with other routers already on nocheck.

/**
 * Onboarding router.
 *
 * Minimal wiring over the `OnboardingService` in `@bossnyumba/domain-services`
 * — every handler uses a tenant-scoped in-memory repository until a Postgres
 * repo adapter lands (tracked; schema fields exist in onboarding-service.ts).
 * This means:
 *   - Data is lost on gateway restart (acceptable for pilot flows).
 *   - The HTTP surface matches the final contract so mobile/web clients can
 *     dev against a stable shape.
 *
 * Endpoints:
 *   GET  /                       — list active onboarding sessions (smoke)
 *   POST /                       — start an onboarding session
 *   GET  /:id                    — fetch an onboarding session
 *   POST /:id/complete-step      — mark a checklist step complete
 *
 * Upstream-missing: a Postgres `OnboardingRepository` implementation. Once
 * that lands in domain-services/onboarding, this router flips to pulling
 * the service from `services.onboarding` via the composition root.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { utilityAccounts } from '@bossnyumba/database';
import { and, eq, isNull } from 'drizzle-orm';
import { mapLeaseRow } from './db-mappers';
import {
  OnboardingService,
  type OnboardingRepository,
  type OnboardingSession,
  type OnboardingSessionId,
} from '@bossnyumba/domain-services/onboarding';
import { InMemoryEventBus } from '@bossnyumba/domain-services';
import type { TenantId, CustomerId, LeaseId } from '@bossnyumba/domain-models';

import { withSecurityEvents } from '@bossnyumba/observability';
// ---------------------------------------------------------------------------
// Process-wide in-memory repo. Tenant isolation is enforced by the
// composite `tenantId::id` key.
// ---------------------------------------------------------------------------
function createInMemoryRepo(): OnboardingRepository {
  const byId = new Map<string, OnboardingSession>();
  const byCustomer = new Map<string, OnboardingSession>();
  const byLease = new Map<string, OnboardingSession>();

  const key = (t: string, id: string) => `${t}::${id}`;

  return {
    async findById(id, tenantId) {
      return byId.get(key(String(tenantId), String(id))) ?? null;
    },
    async findByCustomer(customerId, tenantId) {
      return byCustomer.get(key(String(tenantId), String(customerId))) ?? null;
    },
    async findByLease(leaseId, tenantId) {
      return byLease.get(key(String(tenantId), String(leaseId))) ?? null;
    },
    async create(session) {
      byId.set(key(String(session.tenantId), String(session.id)), session);
      byCustomer.set(key(String(session.tenantId), String(session.customerId)), session);
      byLease.set(key(String(session.tenantId), String(session.leaseId)), session);
      return session;
    },
    async update(session) {
      byId.set(key(String(session.tenantId), String(session.id)), session);
      byCustomer.set(key(String(session.tenantId), String(session.customerId)), session);
      byLease.set(key(String(session.tenantId), String(session.leaseId)), session);
      return session;
    },
  };
}

const repo = createInMemoryRepo();
const bus = new InMemoryEventBus();
const service = new OnboardingService(repo, bus);

const app = new Hono();
app.use('*', authMiddleware);
// Tenant-bound DB handle + repositories — required by the real-data
// read endpoints below (GET /documents, GET /utilities). The legacy
// in-memory session endpoints above do not depend on it, but mounting
// it for the whole router is harmless and keeps `c.get('repos')` /
// `c.get('db')` available to every handler.
app.use('*', databaseMiddleware);

const StartSchema = z.object({
  customerId: z.string().min(1),
  leaseId: z.string().min(1),
  moveInDate: z.string().min(1),
  language: z.enum(['en', 'sw']).optional(),
  preferredChannel: z.enum(['whatsapp', 'sms', 'email', 'app', 'voice']).optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
});

const CompleteStepSchema = z.object({
  stepId: z.enum([
    'pre_move_in',
    'welcome',
    'utilities_training',
    'property_orientation',
    'move_in_inspection',
    'community_info',
    'completed',
  ]),
  data: z.record(z.unknown()).default({}),
});

app.get('/', (c) => {
  // There is no list repository method — return meta instead of a hard 503.
  return c.json({
    success: true,
    data: [],
    meta: {
      message:
        'Onboarding sessions are indexed by customerId/leaseId. Use GET /onboarding/:id or POST / to start a session.',
    },
  });
});

app.post('/', zValidator('json', StartSchema), withSecurityEvents({ action: 'onboarding.create', resource: 'onboarding', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const correlationId =
    c.req.header('x-correlation-id') ?? `onb_${Date.now()}`;
  const result = await service.startOnboarding(
    auth.tenantId as TenantId,
    body.customerId as CustomerId,
    body.leaseId as LeaseId,
    {
      moveInDate: body.moveInDate,
      language: body.language,
      preferredChannel: body.preferredChannel,
      propertyId: body.propertyId,
      unitId: body.unitId,
    },
    auth.userId,
    correlationId,
  );
  if (!result.ok) {
    return c.json(
      {
        success: false,
        error: { code: result.error.code, message: result.error.message },
      },
      400,
    );
  }
  return c.json({ success: true, data: result.value }, 201);
}));

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const session = await repo.findById(
    id as OnboardingSessionId,
    auth.tenantId as TenantId,
  );
  if (!session) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Onboarding session not found' } },
      404,
    );
  }
  return c.json({ success: true, data: session });
});

app.post('/:id/complete-step', zValidator('json', CompleteStepSchema), withSecurityEvents({ action: 'onboarding.create', resource: 'onboarding', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const correlationId =
    c.req.header('x-correlation-id') ?? `onb_${Date.now()}`;
  const result = await service.completeStep(
    id as OnboardingSessionId,
    auth.tenantId as TenantId,
    body.stepId,
    body.data ?? {},
    auth.userId,
    correlationId,
  );
  if (!result.ok) {
    const status =
      result.error.code === 'SESSION_NOT_FOUND'
        ? 404
        : result.error.code === 'INVALID_STATE_TRANSITION'
          ? 409
          : 400;
    return c.json(
      {
        success: false,
        error: { code: result.error.code, message: result.error.message },
      },
      status,
    );
  }
  return c.json({ success: true, data: result.value });
}));

// ---------------------------------------------------------------------------
// GET /documents — the REAL documents the signed-in resident must e-sign.
//
// Built from the resident's actual lease row (same source as
// `/leases/current`: `repos.leases.findByCustomer(userId, tenantId)`),
// enriched with the real unit + property. The customer-app e-sign
// screen renders this list verbatim — every figure (rent, deposit,
// term dates, unit, property) is the tenant's OWN record.
//
// A FRESH resident with no lease yet has NOTHING to sign → we return
// an empty `documents` array so the client renders an honest
// "nothing to sign yet" pending state. We NEVER fabricate a lease.
//
// `signed`/`signedAt` reflect the lease's persisted signature columns
// (`signedByTenant` / `tenantSignedAt`) so a resident who already
// signed sees the truthful state on return.
// ---------------------------------------------------------------------------
app.get('/documents', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');

  const result = await repos.leases.findByCustomer(
    auth.userId as CustomerId,
    auth.tenantId as TenantId,
    { limit: 20, offset: 0 },
  );
  const leaseRow =
    result.items.find((item: { status: unknown }) => String(item.status) === 'active') ||
    result.items[0];

  // Honest empty/pending state — no lease assigned yet.
  if (!leaseRow) {
    return c.json({ success: true, data: { documents: [] } });
  }

  const lease = mapLeaseRow(leaseRow);
  const [unit, property] = await Promise.all([
    lease.unitId ? repos.units.findById(lease.unitId, auth.tenantId as TenantId) : null,
    lease.propertyId
      ? repos.properties.findById(lease.propertyId, auth.tenantId as TenantId)
      : null,
  ]);

  const unitLabel = unit?.unitCode ?? lease.unitId ?? '';
  const propertyName = property?.name ?? '';
  const currency: string = leaseRow.rentCurrency ?? '';
  const signed = Boolean(leaseRow.signedByTenant);
  const signedAt: string | undefined = leaseRow.tenantSignedAt
    ? new Date(leaseRow.tenantSignedAt).toISOString()
    : undefined;

  // Server returns amounts + currency as raw values; the client renders
  // money via its currency-preference formatter. We do NOT pre-format or
  // hard-code a currency symbol here (multi-currency invariant).
  const money = (amount: number) => ({ amount, currency });

  const where = [propertyName, unitLabel ? `Unit ${unitLabel}` : null]
    .filter(Boolean)
    .join(', ');

  const sections = [
    {
      title: 'Term of Lease',
      data: {
        startDate: lease.startDate ? new Date(lease.startDate).toISOString() : null,
        endDate: lease.endDate ? new Date(lease.endDate).toISOString() : null,
        rent: money(Number(lease.rentAmount ?? 0)),
        paymentDueDay: lease.paymentDueDay ?? null,
      },
    },
    {
      title: 'Security Deposit',
      data: {
        deposit: money(Number(lease.depositAmount ?? 0)),
        depositPaid: money(Number(lease.depositPaid ?? 0)),
      },
    },
    {
      title: 'Maintenance & Repairs',
      data: {
        utilitiesIncluded: lease.terms?.utilitiesIncluded ?? [],
      },
    },
  ];

  return c.json({
    success: true,
    data: {
      documents: [
        {
          id: lease.id,
          name: 'Lease Agreement',
          type: 'lease',
          leaseNumber: lease.leaseNumber,
          where,
          property: propertyName,
          unit: unitLabel,
          currency,
          documentUrl: leaseRow.leaseDocumentUrl ?? null,
          sections,
          signed,
          signedAt,
        },
      ],
    },
  });
});

// ---------------------------------------------------------------------------
// GET /utilities — the REAL utility accounts/meters for the resident's
// unit. Read straight from the `utility_accounts` table (tenant + unit
// scoped, soft-delete aware). Each row carries the unit's actual
// provider, account number, and meter number.
//
// A FRESH resident whose unit has no utility accounts provisioned yet
// gets an empty `utilities` array → honest empty/pending state. We NEVER
// invent a meter identifier. Generic LUKU / M-Pesa instructional COPY
// lives client-side; only the IDENTIFIERS come from here.
// ---------------------------------------------------------------------------
app.get('/utilities', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');

  // Resolve the resident's current lease → unit. No lease → no unit →
  // honest empty state.
  const leaseResult = await repos.leases.findByCustomer(
    auth.userId as CustomerId,
    auth.tenantId as TenantId,
    { limit: 20, offset: 0 },
  );
  const leaseRow =
    leaseResult.items.find((item: { status: unknown }) => String(item.status) === 'active') ||
    leaseResult.items[0];

  if (!leaseRow?.unitId) {
    return c.json({ success: true, data: { utilities: [] } });
  }

  const rows = await db
    .select()
    .from(utilityAccounts)
    .where(
      and(
        eq(utilityAccounts.tenantId, auth.tenantId as string),
        eq(utilityAccounts.unitId, leaseRow.unitId),
        isNull(utilityAccounts.deletedAt),
      ),
    );

  const utilities = rows.map((row: typeof utilityAccounts.$inferSelect) => ({
    id: row.id,
    utilityType: row.utilityType,
    provider: row.provider,
    accountNumber: row.accountNumber,
    meterNumber: row.meterNumber ?? null,
  }));

  return c.json({ success: true, data: { utilities } });
});

export const onboardingRouter = app;
