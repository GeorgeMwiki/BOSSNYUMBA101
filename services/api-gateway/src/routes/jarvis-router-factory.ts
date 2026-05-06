// @ts-nocheck — Hono v4 status-code literal union widens c.json branches.

/**
 * Jarvis router factory — every BossNyumba user (tenant resident,
 * property owner, estate manager, agency admin, internal HQ employee)
 * gets their own personalised first-person AI counterpart, sitting on
 * the same central-intelligence brain kernel. This factory takes a
 * surface + default tier and returns a Hono app that exposes:
 *
 *   POST /think                — single-turn thought
 *   POST /stream               — SSE-streamed turn (turn_start / delta / confidence / done)
 *   POST /briefing             — daily briefing
 *   POST /actions              — propose a sovereign-tier write action
 *   POST /actions/:id/sign     — first or second eye signature
 *   GET  /actions/:id          — fetch approval status
 *   GET  /actions              — list approvals (filter by status)
 *
 * Each surface gets a different default persona; per-user
 * personalisation rewrites the persona's opening with the operator's
 * name + role + affiliation so the AI greets THEM by name.
 */

// Architecture overview — see `.planning/jarvis-architecture.md` for
// the full Nyumba Mind reference: portal/persona/tier matrix, scope
// lattice, grounding pyramid, env switches, and migration roster.
// Critical: `admin-portal` is the AGENCY (our customers); HQ is the
// `admin-platform-portal`. Do not confuse the two surfaces.

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  personalisePersona,
  selectPersona,
  type UserProfile,
} from '@bossnyumba/central-intelligence';
import type {
  ScopeContext,
  ThoughtRequest,
} from '@bossnyumba/central-intelligence';
import type { GroundingViewRole } from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { getSovereignBrain } from '../composition/sovereign';

export type JarvisSurface = ThoughtRequest['surface'];

export interface JarvisRouterConfig {
  /** Surface drives default persona selection. */
  readonly surface: JarvisSurface;
  /** Default tier for /think; can be overridden per request. */
  readonly defaultTier: ThoughtRequest['tier'];
  /** Default greeting style for personalisation. */
  readonly greetingStyle?: UserProfile['greetingStyle'];
  /**
   * If true, the surface is consumer-facing (tenant / owner) — we
   * tighten the per-request `tier` enum to safer values so the
   * consumer can't escalate themselves to org/industry tier.
   */
  readonly consumerSurface?: boolean;
}

const ALL_TIERS = [
  'tenant', 'lease', 'unit', 'block', 'property',
  'portfolio', 'org', 'industry',
] as const;
const CONSUMER_TIERS = ['tenant', 'lease', 'unit', 'property'] as const;

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

function actorProfileFromContext(
  c: any,
  greetingStyle: UserProfile['greetingStyle'] = 'warm',
): UserProfile {
  const auth = c.get('auth') ?? {};
  return {
    userId: auth.userId ?? auth.sub ?? 'unknown-user',
    displayName: auth.displayName ?? auth.email ?? 'Operator',
    role: (auth.roles && auth.roles[0]) || 'user',
    affiliation: auth.tenantName ?? auth.orgName ?? 'BossNyumba',
    greetingStyle,
  };
}

function scopeFromContext(c: any, surface: JarvisSurface): ScopeContext {
  const auth = c.get('auth') ?? {};
  const tenantId = auth.tenantId ?? null;
  const userId = auth.userId ?? auth.sub ?? 'unknown-user';
  const roles = Array.isArray(auth.roles) ? auth.roles : [];
  // The central-intelligence ScopeContext is a binary discriminator
  // (tenant | platform). The surface drives PERSONA, not scope.
  if (surface === 'platform-hq' || !tenantId) {
    return {
      kind: 'platform',
      actorUserId: userId,
      roles,
      personaId: surfacePersonaId(surface),
    };
  }
  return {
    kind: 'tenant',
    tenantId,
    actorUserId: userId,
    roles,
    personaId: surfacePersonaId(surface),
  };
}

/**
 * Chunk a string into ~`pieces` near-equal segments for SSE delta
 * streaming. Tries to break on whitespace so partial words don't flash
 * to the user; falls back to a hard slice for very short / single-word
 * input. Always returns at least one chunk (even for empty strings, an
 * empty chunk is omitted).
 */
function chunkText(text: string, pieces: number): ReadonlyArray<string> {
  if (text.length === 0) return [];
  const target = Math.max(1, Math.min(pieces, text.length));
  if (text.length <= target) return [text];

  const ideal = Math.ceil(text.length / target);
  const out: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + ideal, text.length);
    // Snap to nearest whitespace inside [end - 20, end] so we don't
    // split mid-word. If no whitespace is found in the window, take
    // the hard cut.
    if (end < text.length) {
      const window = text.slice(Math.max(cursor, end - 20), end);
      const lastSpace = window.lastIndexOf(' ');
      if (lastSpace >= 0) {
        end = Math.max(cursor, end - 20) + lastSpace + 1;
      }
    }
    out.push(text.slice(cursor, end));
    cursor = end;
  }
  return out;
}

function surfacePersonaId(surface: JarvisSurface): string {
  // Surface → default persona's id, used as the ScopeContext personaId
  // hint. Real persona selection is done server-side via selectPersona().
  switch (surface) {
    case 'tenant-app':         return 'tenant-resident';
    case 'owner-portal':       return 'owner-advisor';
    case 'estate-manager-app': return 'estate-manager';
    case 'admin-portal':       return 'org-admin';
    case 'platform-hq':        return 'sovereign-admin';
    case 'classroom':          return 'classroom-tutor';
    case 'marketing':          return 'marketing-guide';
  }
}

/**
 * Surface → grounding visibility role. Drives WHICH slice of tenant
 * data the user's personal Nyumba Mind sees:
 *   tenant-app / classroom / marketing → resident-tier (own lease)
 *   estate-manager-app                 → assigned-properties only
 *   owner-portal                       → owned-properties only
 *   admin-portal                       → full tenant view
 *   platform-hq                        → no grounding (DP cohort path)
 */
function roleForSurface(surface: JarvisSurface): GroundingViewRole {
  switch (surface) {
    case 'tenant-app':         return 'tenant';
    case 'classroom':          return 'tenant';
    case 'marketing':          return 'tenant';
    case 'estate-manager-app': return 'manager';
    case 'owner-portal':       return 'owner';
    case 'admin-portal':       return 'org-admin';
    case 'platform-hq':        return 'sovereign';
  }
}

/**
 * Pull the SovereignScope (tenantId + userId + role) from a Hono
 * context. Centralised so every route handler in this factory uses
 * the same key shape — otherwise the per-user cache would partition
 * unevenly.
 */
function sovereignScopeFromContext(
  c: any,
  surface: JarvisSurface,
): { tenantId: string | null; userId: string | null; role: GroundingViewRole } {
  const auth = c.get('auth') ?? {};
  return {
    tenantId: auth.tenantId ?? null,
    userId: auth.userId ?? auth.sub ?? null,
    role: roleForSurface(surface),
  };
}

// Multimodal attachment caps. The gateway enforces a per-turn count cap
// and a per-attachment size cap so a misbehaving client cannot send a
// 100 MB image and stall the kernel for everyone else. Sizes are
// expressed in base64-decoded BYTES; the zod schema validates against a
// pre-decoded base64 length budget (see MAX_BASE64_LEN).
const MAX_ATTACHMENTS_PER_TURN = 10;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4 MiB decoded
// Base64 inflates by 4/3; round up + add a tiny safety margin so we
// reject only when the decoded payload truly exceeds the cap.
const MAX_BASE64_LEN = Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 4;

const AttachmentSchema = z.object({
  kind: z.literal('image'),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  data: z
    .string()
    .min(1)
    .max(MAX_BASE64_LEN, {
      message: `IMAGE_TOO_LARGE: each image must be <= ${MAX_ATTACHMENT_BYTES} bytes decoded`,
    }),
  caption: z.string().max(240).optional(),
});

export function createJarvisRouter(config: JarvisRouterConfig): Hono {
  const tierEnum = config.consumerSurface
    ? z.enum(CONSUMER_TIERS)
    : z.enum(ALL_TIERS);

  const ThinkSchema = z.object({
    threadId: z.string().min(1).max(120),
    userMessage: z.string().min(1).max(4_000),
    tier: tierEnum.default(config.defaultTier as any),
    stakes: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    requireJudge: z.boolean().optional(),
    attachments: z
      .array(AttachmentSchema)
      .max(MAX_ATTACHMENTS_PER_TURN, {
        message: `IMAGE_TOO_LARGE: at most ${MAX_ATTACHMENTS_PER_TURN} attachments per turn`,
      })
      .optional(),
  });

  const app = new Hono();
  app.use('*', authMiddleware);

  app.post('/think', zValidator('json', ThinkSchema), async (c) => {
    const body = c.req.valid('json');
    const profile = actorProfileFromContext(c, config.greetingStyle);
    const scope = scopeFromContext(c, config.surface);
    const sov = await getSovereignBrain(sovereignScopeFromContext(c, config.surface));

    const req: ThoughtRequest = {
      threadId: body.threadId,
      userMessage: body.userMessage,
      scope,
      tier: body.tier,
      stakes: body.stakes,
      surface: config.surface,
      requireJudge: body.requireJudge,
      ...(body.attachments && body.attachments.length > 0
        ? { attachments: body.attachments }
        : {}),
    };

    const basePersona = selectPersona(req);
    const personalised = personalisePersona(basePersona, profile);
    const decision = await sov.kernel.think(req);

    return c.json({
      success: true,
      surface: config.surface,
      persona: {
        id: personalised.id,
        displayName: personalised.displayName,
        firstPersonNoun: personalised.firstPersonNoun,
      },
      decision,
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // POST /stream — SSE variant of /think.
  //
  // Wire-level token streaming. Forwards each event from
  // `kernel.thinkStream(req)` straight onto the SSE wire:
  //
  //   event: turn_start  → { persona }
  //   event: delta       → { delta: '<token-chunk>' }
  //   event: thinking    → { delta: '<thought-chunk>' }   (extended thinking)
  //   event: gate        → { gate, verdict }              (drift / policy / inviolable)
  //   event: confidence  → ConfidenceVector               (answers / softened)
  //   event: done        → { thoughtId, kind }
  //
  // For sensors that don't expose `callStream`, the kernel falls back
  // internally to a single-shot `call()` and emits ONE text_delta with
  // the whole text — the wire framing is identical so clients don't
  // need to care which path the kernel took.
  //
  // Pre-sensor refusal path: turn_start, gate event (inviolable), done.
  // ───────────────────────────────────────────────────────────────────
  app.post('/stream', zValidator('json', ThinkSchema), async (c) => {
    const body = c.req.valid('json');
    const profile = actorProfileFromContext(c, config.greetingStyle);
    const scope = scopeFromContext(c, config.surface);
    const sov = await getSovereignBrain(sovereignScopeFromContext(c, config.surface));

    const req: ThoughtRequest = {
      threadId: body.threadId,
      userMessage: body.userMessage,
      scope,
      tier: body.tier,
      stakes: body.stakes,
      surface: config.surface,
      requireJudge: body.requireJudge,
      ...(body.attachments && body.attachments.length > 0
        ? { attachments: body.attachments }
        : {}),
    };

    // Per-user persona personalisation is applied by the gateway on
    // the kernel's surface-default persona so the AI greets THIS user
    // by name on the turn_start event.
    const basePersona = selectPersona(req);
    const personalised = personalisePersona(basePersona, profile);

    return streamSSE(c, async (stream) => {
      try {
        for await (const ev of sov.kernel.thinkStream(req)) {
          if (ev.kind === 'turn_start') {
            await stream.writeSSE({
              event: 'turn_start',
              data: JSON.stringify({
                persona: {
                  id: personalised.id,
                  displayName: personalised.displayName,
                  firstPersonNoun: personalised.firstPersonNoun,
                },
              }),
            });
            continue;
          }
          if (ev.kind === 'text_delta') {
            await stream.writeSSE({
              event: 'delta',
              data: JSON.stringify({ delta: ev.text }),
            });
            continue;
          }
          if (ev.kind === 'thought_delta') {
            await stream.writeSSE({
              event: 'thinking',
              data: JSON.stringify({ delta: ev.text }),
            });
            continue;
          }
          if (ev.kind === 'gate_verdict') {
            await stream.writeSSE({
              event: 'gate',
              data: JSON.stringify({ gate: ev.gate, verdict: ev.verdict }),
            });
            continue;
          }
          if (ev.kind === 'confidence') {
            await stream.writeSSE({
              event: 'confidence',
              data: JSON.stringify(ev.vector),
            });
            continue;
          }
          if (ev.kind === 'done') {
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify({
                thoughtId: ev.decision.provenance.thoughtId,
                kind: ev.decision.kind,
              }),
            });
            return;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'thinkStream failed';
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message }),
        });
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ thoughtId: '', kind: 'refusal' }),
        });
      }
    });
  });

  app.post('/briefing', zValidator('json', BriefingSchema), async (c) => {
    const body = c.req.valid('json');
    const profile = actorProfileFromContext(c, config.greetingStyle);
    const scope = scopeFromContext(c, config.surface);
    const sov = await getSovereignBrain(sovereignScopeFromContext(c, config.surface));

    const briefing = await sov.briefing.compose({
      day: body.day,
      user: profile,
      scope,
      threadId: body.threadId,
      dataPoints: body.dataPoints,
      topPriority:
        body.dataPoints.find((d) => d.severity === 'urgent') ??
        body.dataPoints.find((d) => d.severity === 'warn') ??
        body.dataPoints[0] ??
        null,
    });
    return c.json({ success: true, surface: config.surface, briefing });
  });

  app.post('/actions', zValidator('json', ProposeActionSchema), async (c) => {
    const body = c.req.valid('json');
    const auth = c.get('auth') ?? {};
    const proposerUserId = auth.userId ?? auth.sub ?? 'unknown-user';
    const sov = await getSovereignBrain(sovereignScopeFromContext(c, config.surface));

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
    const auth = c.get('auth') ?? {};
    const approverUserId = auth.userId ?? auth.sub ?? 'unknown-user';
    const sov = await getSovereignBrain(sovereignScopeFromContext(c, config.surface));

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
    const auth = c.get('auth') ?? {};
    const sov = await getSovereignBrain(sovereignScopeFromContext(c, config.surface));
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
    const auth = c.get('auth') ?? {};
    const sov = await getSovereignBrain(sovereignScopeFromContext(c, config.surface));
    const status = c.req.query('status') as
      | 'pending' | 'one-eye' | 'approved' | 'rejected' | 'expired' | undefined;
    const records = await sov.approvals.list(status ? { status } : undefined);
    return c.json({ success: true, approvals: records });
  });

  return app;
}

// ─────────────────────────────────────────────────────────────────────
// Pre-configured Jarvis surfaces — every BossNyumba user gets one.
// ─────────────────────────────────────────────────────────────────────

export const tenantJarvisRouter   = createJarvisRouter({ surface: 'tenant-app',         defaultTier: 'lease',    greetingStyle: 'warm',   consumerSurface: true });
export const ownerJarvisRouter    = createJarvisRouter({ surface: 'owner-portal',       defaultTier: 'portfolio',greetingStyle: 'warm' });
export const managerJarvisRouter  = createJarvisRouter({ surface: 'estate-manager-app', defaultTier: 'property', greetingStyle: 'terse' });
export const orgAdminJarvisRouter = createJarvisRouter({ surface: 'admin-portal',       defaultTier: 'org',      greetingStyle: 'warm' });
export const platformHqJarvisRouter = createJarvisRouter({ surface: 'platform-hq',      defaultTier: 'industry', greetingStyle: 'warm' });
