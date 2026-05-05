// @ts-nocheck — Hono v4 status-code literal union: c.json branches widen.

/**
 * /api/v1/admin/jarvis — every internal admin's personal Jarvis-style
 * AI ("Nyumba Mind"), backed by the central-intelligence brain kernel.
 *
 *   POST /think                — single-turn thought (think() endpoint)
 *   POST /briefing             — daily morning briefing
 *   POST /actions              — propose a sovereign-tier write action
 *   POST /actions/:id/sign     — first or second eye signature
 *   GET  /actions/:id          — fetch approval status
 *   GET  /actions              — list pending approvals
 *
 * Each request resolves the operator's UserProfile from the auth
 * principal so the AI greets them by name (personalisePersona).
 *
 * The kernel is provider-agnostic; this router uses the in-memory
 * stack by default and upgrades to Anthropic + Drizzle sinks when
 * env vars are present.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  personalisePersona,
  SOVEREIGN_ADMIN_PERSONA,
  type UserProfile,
} from '@bossnyumba/central-intelligence';
import type {
  ScopeContext,
  ThoughtRequest,
} from '@bossnyumba/central-intelligence';
import { authMiddleware } from '../middleware/hono-auth';
import { getSovereignBrain } from '../composition/sovereign';

const ThinkSchema = z.object({
  threadId: z.string().min(1).max(120),
  userMessage: z.string().min(1).max(4_000),
  tier: z
    .enum(['tenant', 'lease', 'unit', 'block', 'property', 'portfolio', 'org', 'industry'])
    .default('org'),
  stakes: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  requireJudge: z.boolean().optional(),
});

const BriefingSchema = z.object({
  day: z.string().min(1).max(40),
  threadId: z.string().min(1).max(120),
  dataPoints: z
    .array(
      z.object({
        topic: z.string().min(1).max(200),
        summary: z.string().min(1).max(800),
        severity: z.enum(['info', 'warn', 'urgent']),
        citationLabel: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(20),
});

const ProposeActionSchema = z.object({
  thoughtId: z.string().min(1).max(120),
  summary: z.string().min(1).max(400),
  toolName: z.string().min(1).max(120),
  payload: z.record(z.unknown()).default({}),
  stakes: z.enum(['medium', 'high', 'critical']).default('high'),
});

const SignSchema = z.object({
  verdict: z.enum(['approve', 'reject']),
  comment: z.string().max(800).optional(),
});

function brainFor(c: any) {
  const auth = c.get('auth') ?? {};
  return getSovereignBrain({ tenantId: auth.tenantId ?? null });
}

function actorProfileFromContext(c: any): UserProfile {
  const auth = c.get('auth') ?? {};
  return {
    userId: auth.userId ?? auth.sub ?? 'unknown-user',
    displayName: auth.displayName ?? auth.email ?? 'Operator',
    role: (auth.roles && auth.roles[0]) || 'platform-admin',
    affiliation: auth.tenantName ?? auth.orgName ?? 'BossNyumba HQ',
    greetingStyle: 'warm',
  };
}

function scopeFromContext(c: any): ScopeContext {
  const auth = c.get('auth') ?? {};
  const tenantId = auth.tenantId ?? null;
  const userId = auth.userId ?? auth.sub ?? 'unknown-user';
  const roles = Array.isArray(auth.roles) ? auth.roles : [];
  if (!tenantId) {
    return {
      kind: 'platform',
      actorUserId: userId,
      roles,
      personaId: 'sovereign-admin',
    };
  }
  return {
    kind: 'tenant',
    tenantId,
    actorUserId: userId,
    roles,
    personaId: 'sovereign-admin',
  };
}

const app = new Hono();
app.use('*', authMiddleware);

app.post('/think', zValidator('json', ThinkSchema), async (c) => {
  const body = c.req.valid('json');
  const sov = await brainFor(c);
  const profile = actorProfileFromContext(c);
  const scope = scopeFromContext(c);

  const personalised = personalisePersona(SOVEREIGN_ADMIN_PERSONA, profile);

  const req: ThoughtRequest = {
    threadId: body.threadId,
    userMessage: body.userMessage,
    scope,
    tier: body.tier,
    stakes: body.stakes,
    surface: 'admin-portal',
    requireJudge: body.requireJudge,
  };

  const decision = await sov.kernel.think(req);
  return c.json({
    success: true,
    persona: { id: personalised.id, displayName: personalised.displayName },
    decision,
  });
});

app.post('/briefing', zValidator('json', BriefingSchema), async (c) => {
  const body = c.req.valid('json');
  const sov = await brainFor(c);
  const profile = actorProfileFromContext(c);
  const scope = scopeFromContext(c);

  const briefing = await sov.briefing.compose({
    day: body.day,
    user: profile,
    scope,
    threadId: body.threadId,
    dataPoints: body.dataPoints,
    topPriority: body.dataPoints.find((d) => d.severity === 'urgent') ??
                 body.dataPoints.find((d) => d.severity === 'warn') ??
                 body.dataPoints[0] ?? null,
  });
  return c.json({ success: true, briefing });
});

app.post('/actions', zValidator('json', ProposeActionSchema), async (c) => {
  const body = c.req.valid('json');
  const sov = await brainFor(c);
  const auth = c.get('auth') ?? {};
  const proposerUserId = auth.userId ?? auth.sub ?? 'unknown-user';

  const record = await sov.approvals.propose({
    proposerUserId,
    thoughtId: body.thoughtId,
    summary: body.summary,
    toolName: body.toolName,
    payload: body.payload,
    stakes: body.stakes,
  });
  return c.json({ success: true, approval: record });
});

app.post('/actions/:id/sign', zValidator('json', SignSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const sov = await brainFor(c);
  const auth = c.get('auth') ?? {};
  const approverUserId = auth.userId ?? auth.sub ?? 'unknown-user';

  try {
    const record = await sov.approvals.sign({
      actionId: id,
      approverUserId,
      verdict: body.verdict,
      comment: body.comment,
    });
    return c.json({ success: true, approval: record });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sign failed';
    return c.json(
      { success: false, error: { code: 'SIGN_REJECTED', message } },
      400,
    );
  }
});

app.get('/actions/:id', async (c) => {
  const id = c.req.param('id');
  const sov = await brainFor(c);
  const record = await sov.approvals.get(id);
  if (!record) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'approval not found' } },
      404,
    );
  }
  return c.json({ success: true, approval: record });
});

app.get('/actions', async (c) => {
  const sov = await brainFor(c);
  const status = c.req.query('status') as
    | 'pending' | 'one-eye' | 'approved' | 'rejected' | 'expired' | undefined;
  const records = await sov.approvals.list(status ? { status } : undefined);
  return c.json({ success: true, approvals: records });
});

export default app;
