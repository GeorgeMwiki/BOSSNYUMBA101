/**
 * Training router — admin-driven adaptive training system.
 *
 * Mounted at `/api/v1/training`. Tenant-isolated via the shared
 * `authMiddleware`; every endpoint uses `auth.tenantId`.
 *
 *   POST   /generate                       — preview-generate a path (no DB write)
 *   POST   /paths                          — persist (after admin edits)
 *   GET    /paths                          — list tenant's paths
 *   PATCH  /paths/:id                      — edit steps / title
 *   POST   /paths/:id/assign               — assign to employees
 *   GET    /assignments                    — list assignments (status filter)
 *   GET    /assignments/:id                — detail with per-concept mastery
 *   GET    /mastery/:userId                — per-user mastery across paths
 *   POST   /assignments/:id/mark-complete  — admin force-complete
 *   GET    /next-step                      — learner: widget mount pulls next step
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { withRateLimit } from '../middleware/rate-limit';
import { authMiddleware } from '../middleware/hono-auth';
import type { TrainingAdminEndpoints } from '@bossnyumba/ai-copilot/training';

// Coarse schemas for the training API. Domain-level validation happens
// in the TrainingAdminEndpoints service; this layer rejects obvious
// shape errors before the service touches them. The pass-through
// `.passthrough()` lets the service evolve its required fields without
// breaking the gateway contract.
const GeneratePathSchema = z
  .object({
    goal: z.string().min(1).max(1_000).optional(),
    concepts: z.array(z.string().max(200)).max(200).optional(),
    audience: z.string().max(200).optional(),
  })
  .passthrough();
const PersistPathSchema = z
  .object({
    title: z.string().min(1).max(200),
    steps: z.array(z.record(z.unknown())).min(1).max(200),
  })
  .passthrough();
const EditPathSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    steps: z.array(z.record(z.unknown())).max(200).optional(),
  })
  .passthrough();
const AssignPathSchema = z
  .object({
    assigneeUserIds: z.array(z.string().max(128)).min(1).max(1_000),
    dueAt: z.string().datetime().optional(),
    notes: z.string().max(2_000).optional(),
  })
  .passthrough();

function getEndpoints(c: any): TrainingAdminEndpoints | null {
  const services = c.get('services') ?? {};
  return services.training ?? null;
}

function notImplemented(c: any) {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Training service not wired into api-gateway context',
      },
    },
    503
  );
}

function mapErr(c: any, err: unknown, fallback = 400) {
  const e = err as { code?: string; message?: string } | undefined;
  const code = e?.code ?? 'INTERNAL_ERROR';
  const status =
    code === 'NOT_FOUND'
      ? 404
      : code === 'TENANT_MISMATCH'
        ? 403
        : code === 'TRAINING_DISABLED'
          ? 409
          : code === 'INVALID_STATE'
            ? 409
            : code === 'INTERNAL_ERROR'
              ? 500
              : fallback;
  return c.json(
    { success: false, error: { code, message: e?.message ?? 'unknown' } },
    status
  );
}

const app = new Hono();
app.use('*', withRateLimit({ key: 'training', max: 120, window: '1m' }));
app.use('*', authMiddleware);

app.post('/generate', async (c: any) => {
  const auth = c.get('auth');
  const raw = await c.req.json().catch(() => ({}));
  const parsed = GeneratePathSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } }, 400);
  }
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const path = await ep.generate(auth.tenantId, auth.userId, parsed.data);
    return c.json({ success: true, data: path }, 200);
  } catch (e: unknown) {
    return mapErr(c, e, 400);
  }
});

app.post('/paths', async (c: any) => {
  const auth = c.get('auth');
  const raw = await c.req.json().catch(() => ({}));
  const parsed = PersistPathSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } }, 400);
  }
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const path = await ep.persistPath(auth.tenantId, auth.userId, parsed.data);
    return c.json({ success: true, data: path }, 201);
  } catch (e: unknown) {
    return mapErr(c, e, 400);
  }
});

app.get('/paths', async (c: any) => {
  const auth = c.get('auth');
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const data = await ep.listPaths(auth.tenantId);
    return c.json({ success: true, data });
  } catch (e: unknown) {
    return mapErr(c, e, 500);
  }
});

app.patch('/paths/:id', async (c: any) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const raw = await c.req.json().catch(() => ({}));
  const parsed = EditPathSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } }, 400);
  }
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const path = await ep.editPath(auth.tenantId, id, parsed.data);
    return c.json({ success: true, data: path });
  } catch (e: unknown) {
    return mapErr(c, e, 400);
  }
});

app.post('/paths/:id/assign', async (c: any) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const raw = await c.req.json().catch(() => ({}));
  const parsed = AssignPathSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: { code: 'INVALID_INPUT', message: parsed.error.message } }, 400);
  }
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const data = await ep.assign(auth.tenantId, id, auth.userId, parsed.data);
    return c.json({ success: true, data }, 201);
  } catch (e: unknown) {
    return mapErr(c, e, 400);
  }
});

app.get('/assignments', async (c: any) => {
  const auth = c.get('auth');
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const status = c.req.query('status');
    const assigneeUserId = c.req.query('assigneeUserId');
    const data = await ep.listAssignments(auth.tenantId, {
      status,
      assigneeUserId,
    });
    return c.json({ success: true, data });
  } catch (e: unknown) {
    return mapErr(c, e, 500);
  }
});

app.get('/assignments/:id', async (c: any) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const data = await ep.getAssignment(auth.tenantId, id);
    return c.json({ success: true, data });
  } catch (e: unknown) {
    return mapErr(c, e, 400);
  }
});

app.get('/mastery/:userId', async (c: any) => {
  const auth = c.get('auth');
  const userId = c.req.param('userId');
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const data = await ep.getUserMastery(
      auth.tenantId,
      userId,
      auth.tenantId
    );
    return c.json({ success: true, data });
  } catch (e: unknown) {
    return mapErr(c, e, 400);
  }
});

app.post('/assignments/:id/mark-complete', async (c: any) => {
  const auth = c.get('auth');
  const id = c.req.param('id');
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const data = await ep.markAssignmentComplete(
      auth.tenantId,
      id,
      auth.userId
    );
    return c.json({ success: true, data });
  } catch (e: unknown) {
    return mapErr(c, e, 400);
  }
});

app.get('/next-step', async (c: any) => {
  const auth = c.get('auth');
  const ep = getEndpoints(c);
  if (!ep) return notImplemented(c);
  try {
    const data = await ep.getNextStep(auth.tenantId, auth.userId);
    return c.json({ success: true, data: data ?? null });
  } catch (e: unknown) {
    return mapErr(c, e, 500);
  }
});

export const trainingRouter = app;
export default app;
