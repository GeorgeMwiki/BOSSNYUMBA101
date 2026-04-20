// @ts-nocheck — hono v4 ContextVariableMap drift; tracked in Docs/TYPE_DEBT.md
/**
 * Autonomy policy router — Wave 16 gap-closure.
 *
 * Exposes per-tenant autonomy policy CRUD + the master `autonomousModeEnabled`
 * toggle. Admin-only. Writes flow through the service so every change is
 * audit-chained (Wave 11 security suite).
 *
 *   GET  /api/v1/autonomy/policy
 *   PUT  /api/v1/autonomy/policy
 *   POST /api/v1/autonomy/policy/enable
 *   POST /api/v1/autonomy/policy/disable
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/hono-auth';
import { UserRole } from '../types/user-role';

const UpdatePolicySchema = z
  .object({
    autonomousModeEnabled: z.boolean().optional(),
    finance: z.record(z.string(), z.unknown()).optional(),
    leasing: z.record(z.string(), z.unknown()).optional(),
    maintenance: z.record(z.string(), z.unknown()).optional(),
    compliance: z.record(z.string(), z.unknown()).optional(),
    communications: z.record(z.string(), z.unknown()).optional(),
    escalationContacts: z
      .object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
      })
      .optional(),
  })
  .strict();

const app = new Hono();
app.use('*', authMiddleware);
app.use(
  '*',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TENANT_ADMIN)
);

function svc(c: any) {
  const services = c.get('services') ?? {};
  return services.autonomy?.policyService;
}

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Autonomy policy service not wired on this gateway',
      },
    },
    503
  );
}

app.get('/policy', async (c: any) => {
  const auth = c.get('auth');
  const service = svc(c);
  if (!service) return notImplemented(c);
  try {
    const policy = await service.getPolicy(auth.tenantId);
    return c.json({ success: true, data: policy });
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: {
          code: err?.code ?? 'INTERNAL_ERROR',
          message: err?.message ?? 'unknown',
        },
      },
      500
    );
  }
});

app.put('/policy', zValidator('json', UpdatePolicySchema), async (c: any) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const service = svc(c);
  if (!service) return notImplemented(c);
  try {
    const updated = await service.updatePolicy(
      auth.tenantId,
      body,
      auth.userId
    );
    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: {
          code: err?.code ?? 'INTERNAL_ERROR',
          message: err?.message ?? 'unknown',
        },
      },
      err?.code === 'VALIDATION' ? 400 : 500
    );
  }
});

app.post('/policy/enable', async (c: any) => {
  const auth = c.get('auth');
  const service = svc(c);
  if (!service) return notImplemented(c);
  try {
    const updated = await service.updatePolicy(
      auth.tenantId,
      { autonomousModeEnabled: true },
      auth.userId
    );
    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } },
      500
    );
  }
});

app.post('/policy/disable', async (c: any) => {
  const auth = c.get('auth');
  const service = svc(c);
  if (!service) return notImplemented(c);
  try {
    const updated = await service.updatePolicy(
      auth.tenantId,
      { autonomousModeEnabled: false },
      auth.userId
    );
    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } },
      500
    );
  }
});

export default app;
