// @ts-nocheck

/**
 * /api/v1/brain — BossNyumba Brain gateway routes.
 *
 * Endpoints:
 *   POST /api/v1/brain/turn         — run one Brain turn
 *   GET  /api/v1/brain/personae     — list persona templates
 *   POST /api/v1/brain/migrate/extract — parse upload -> bundle + diff
 *   POST /api/v1/brain/migrate/commit  — commit a reviewed bundle
 *   GET  /api/v1/brain/threads      — list threads for the signed-in viewer
 *   GET  /api/v1/brain/threads/:id  — read a thread (visibility-filtered)
 *
 * Auth: `authMiddleware` from hono-auth attaches the authenticated user and
 * tenant onto the Hono context; we translate that into the Brain's
 * `AITenantContext` + `AIActor` + `VisibilityViewer`.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import {
  createBrain,
  DEFAULT_PERSONAE,
  migrationExtract,
  migrationDiff,
  MigrationExtractParamsSchema,
  ExtractionBundleSchema,
  migrationCommitTool,
} from '@bossnyumba/ai-copilot';

// Singleton Brain per gateway process. Replace with a factory keyed by tenant
// when we enable per-tenant ThreadStore persistence.
let brainSingleton = null;
function getBrain() {
  if (!brainSingleton) {
    brainSingleton = createBrain({
      anthropic: process.env.ANTHROPIC_API_KEY
        ? { apiKey: process.env.ANTHROPIC_API_KEY }
        : undefined,
      useMockProviders: !process.env.ANTHROPIC_API_KEY,
    });
  }
  return brainSingleton;
}

function tenantCtx(c) {
  const user = c.get('user') ?? {};
  const tenantId = user.tenantId ?? 'dev-tenant';
  const tenantName = user.tenantName ?? 'Development';
  const env = (user.environment ?? 'development');
  return { tenantId, tenantName, environment: env };
}

function actorCtx(c) {
  const user = c.get('user') ?? {};
  return {
    type: 'user',
    id: user.userId ?? user.id ?? 'unknown',
    name: user.name,
    email: user.email,
    roles: user.roles ?? [],
  };
}

function viewerCtx(c) {
  const user = c.get('user') ?? {};
  const roles = user.roles ?? [];
  return {
    userId: user.userId ?? user.id ?? 'unknown',
    roles,
    teamIds: user.teamIds ?? [],
    employeeId: user.employeeId,
    isAdmin: roles.includes('admin'),
    isManagement:
      roles.includes('admin') ||
      roles.includes('manager') ||
      roles.includes('team_leader'),
  };
}

const brainRouter = new Hono();

brainRouter.use('*', authMiddleware);

// ----- Personae roster ------------------------------------------------------

brainRouter.get('/personae', (c) => {
  const personae = DEFAULT_PERSONAE.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    missionStatement: p.missionStatement,
    kind: p.kind,
  }));
  return c.json({ personae });
});

// ----- Turn (chat) ----------------------------------------------------------

brainRouter.post('/turn', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  if (!body?.userText || typeof body.userText !== 'string') {
    return c.json({ error: 'userText_required' }, 400);
  }
  const { orchestrator } = getBrain();
  const tenant = tenantCtx(c);
  const actor = actorCtx(c);
  const viewer = viewerCtx(c);

  try {
    if (!body.threadId) {
      const result = await orchestrator.startThread({
        tenant,
        actor,
        viewer,
        initialUserText: body.userText,
        forcePersonaId: body.forcePersonaId,
      });
      if (!result.success) return c.json({ error: result.error.message }, 500);
      const turn = result.data.turn;
      return c.json({
        threadId: result.data.thread.id,
        finalPersonaId: turn.finalPersonaId,
        responseText: turn.responseText,
        handoffs: turn.handoffs,
        toolCalls: turn.toolCalls,
        advisorConsulted: turn.advisorConsulted,
        proposedAction: turn.proposedAction,
        tokensUsed: turn.tokensUsed,
      });
    }
    const result = await orchestrator.handleTurn({
      threadId: body.threadId,
      tenant,
      actor,
      viewer,
      userText: body.userText,
      forcePersonaId: body.forcePersonaId,
    });
    if (!result.success) return c.json({ error: result.error.message }, 500);
    return c.json({
      threadId: result.data.threadId,
      finalPersonaId: result.data.finalPersonaId,
      responseText: result.data.responseText,
      handoffs: result.data.handoffs,
      toolCalls: result.data.toolCalls,
      advisorConsulted: result.data.advisorConsulted,
      proposedAction: result.data.proposedAction,
      tokensUsed: result.data.tokensUsed,
    });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : 'internal_error' },
      500
    );
  }
});

// ----- Threads --------------------------------------------------------------

brainRouter.get('/threads', async (c) => {
  const { threads } = getBrain();
  const tenant = tenantCtx(c);
  const viewer = viewerCtx(c);
  const limit = Number(c.req.query('limit') ?? 50);
  const list = await threads.listThreads(tenant.tenantId, {
    userId: viewer.userId,
    limit,
  });
  return c.json({ threads: list });
});

brainRouter.get('/threads/:id', async (c) => {
  const { threads } = getBrain();
  const viewer = viewerCtx(c);
  const id = c.req.param('id');
  const thread = await threads.getThread(id);
  if (!thread) return c.json({ error: 'thread_not_found' }, 404);
  const events = await threads.readAs(id, viewer);
  return c.json({ thread, events });
});

// ----- Migration ------------------------------------------------------------

brainRouter.post('/migrate/extract', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  const parsed = MigrationExtractParamsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const bundle = migrationExtract(parsed.data);
  const diff = migrationDiff({ bundle });
  return c.json({ bundle, diff });
});

brainRouter.post('/migrate/commit', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  const schema = (await import('zod')).z.object({
    bundle: ExtractionBundleSchema,
    write: (await import('zod')).z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const tenant = tenantCtx(c);
  const actor = actorCtx(c);
  const result = await migrationCommitTool.execute(parsed.data, {
    tenant,
    actor,
    persona: {
      id: 'migration-wizard',
      kind: 'utility',
      displayName: 'Migration Wizard',
      missionStatement: '',
      systemPrompt: '',
      allowedTools: ['skill.migration.commit'],
      visibilityBudget: 'management',
      defaultVisibility: 'management',
      modelTier: 'standard',
      advisorEnabled: false,
      advisorHardCategories: [],
      minReviewRiskLevel: 'HIGH',
    },
    threadId: 'migration-wizard-ephemeral',
  });
  if (!result.ok) return c.json({ error: result.error }, 500);
  return c.json({ ok: true, result: result.data });
});

export { brainRouter };
