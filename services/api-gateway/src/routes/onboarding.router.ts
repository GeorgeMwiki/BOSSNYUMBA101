// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union widens
//   across multiple c.json branches; tracked with other routers already on nocheck.

/**
 * Phase F.5 — Tenant-signup onboarding flow router.
 *
 * The owner-facing signup-to-first-action surface. Distinct from
 * `onboarding.ts` (which is the customer/resident move-in flow) — this
 * router covers the SaaS-tenant journey:
 *
 *   1. POST /signup                — email + password + country + business
 *                                    name → returns sessionToken + tenantId
 *                                    + ownerUserId
 *   2. POST /first-property        — adds the first property (address,
 *                                    unit count, rent estimate)
 *   3. POST /first-tenant-import   — bulk import OR manual one-tenant
 *                                    entry
 *   4. POST /first-md-chat         — kicks off the first MD conversation
 *                                    with a curated welcome prompt; spawns
 *                                    the inline welcome.coordinator
 *                                    sub-MD which surveys intent and
 *                                    suggests 3 Skills
 *   5. GET  /checklist             — returns the 8-step onboarding
 *                                    checklist + per-step completion state
 *
 * Storage is in-memory pilot-grade. The shape matches the final HTTP
 * contract so mobile/web can dev against it; swapping to Drizzle is a
 * follow-up.
 *
 * Mounted in index.ts BEFORE the existing /onboarding (customer move-in)
 * router so the specific paths above match first. Anything that doesn't
 * match falls through to the legacy onboarding router untouched.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { runWelcomeCoordinator } from '../composition/onboarding-welcome-md';

// ---------------------------------------------------------------------------
// Types + in-memory store
// ---------------------------------------------------------------------------

type OnboardingFlowStepId =
  | 'account_created'
  | 'verify_email'
  | 'first_property'
  | 'first_tenant_import'
  | 'first_md_chat'
  | 'owner_intent'
  | 'install_starter_skills'
  | 'schedule_daily_briefing';

interface OnboardingFlowStep {
  readonly id: OnboardingFlowStepId;
  readonly label: string;
  readonly description: string;
  readonly completed: boolean;
  readonly completedAt?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

interface OnboardingFlowSession {
  readonly id: string;
  readonly tenantId: string;
  readonly ownerUserId: string;
  readonly email: string;
  readonly businessName: string;
  readonly country: string;
  readonly sessionToken: string;
  readonly createdAt: string;
  readonly steps: ReadonlyArray<OnboardingFlowStep>;
  readonly intent?: 'cashflow' | 'growth' | 'exit';
  readonly firstPropertyId?: string;
  readonly firstChatThreadId?: string;
  readonly suggestedSkills?: ReadonlyArray<string>;
}

const sessions = new Map<string, OnboardingFlowSession>(); // keyed by tenantId
const sessionsByToken = new Map<string, string>(); // sessionToken → tenantId

const DEFAULT_STEPS: ReadonlyArray<OnboardingFlowStep> = Object.freeze([
  {
    id: 'account_created',
    label: 'Account created',
    description: 'Your tenant + owner account are live.',
    completed: true,
  },
  {
    id: 'verify_email',
    label: 'Verify your email',
    description: 'Click the link we sent to confirm the address.',
    completed: false,
  },
  {
    id: 'first_property',
    label: 'Add your first property',
    description: 'Tell us the address, unit count, and rent estimate.',
    completed: false,
  },
  {
    id: 'first_tenant_import',
    label: 'Import your tenants',
    description: 'CSV upload or add one tenant manually.',
    completed: false,
  },
  {
    id: 'first_md_chat',
    label: 'Chat with the MD for the first time',
    description: 'Meet Mr. Mwikila — your portfolio concierge.',
    completed: false,
  },
  {
    id: 'owner_intent',
    label: 'Pick your owner intent',
    description: 'Cashflow-first, growth, or exit-prep — pick one.',
    completed: false,
  },
  {
    id: 'install_starter_skills',
    label: 'Install 3 starter Skills',
    description: 'Curated by Mr. Mwikila based on your intent.',
    completed: false,
  },
  {
    id: 'schedule_daily_briefing',
    label: 'Schedule your first daily briefing',
    description: 'A 5-minute morning brief delivered however you like.',
    completed: false,
  },
]);

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function markStep(
  steps: ReadonlyArray<OnboardingFlowStep>,
  id: OnboardingFlowStepId,
  meta: Readonly<Record<string, unknown>> = {},
): ReadonlyArray<OnboardingFlowStep> {
  return steps.map((s) =>
    s.id === id
      ? {
          ...s,
          completed: true,
          completedAt: new Date().toISOString(),
          meta: { ...(s.meta ?? {}), ...meta },
        }
      : s,
  );
}

function getSessionByTenant(tenantId: string): OnboardingFlowSession | null {
  return sessions.get(tenantId) ?? null;
}

function getSessionByToken(token: string): OnboardingFlowSession | null {
  const tenantId = sessionsByToken.get(token);
  if (!tenantId) return null;
  return getSessionByTenant(tenantId);
}

// Best-effort header-or-body resolver: signup returns a sessionToken; we
// accept either a bearer in `Authorization` (after the owner is logged in
// via auth.ts) OR `x-onboarding-session` so the still-anonymous post-signup
// page can drive the remaining endpoints before email verification.
function resolveSession(c: any): OnboardingFlowSession | null {
  const tokenHeader =
    c.req.header('x-onboarding-session') ??
    (c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
  if (tokenHeader) {
    const byToken = getSessionByToken(tokenHeader);
    if (byToken) return byToken;
  }
  // Fallback: callers wired through the post-login authMiddleware will set
  // `c.var.auth` — we can resolve by tenantId. We keep this best-effort and
  // gateway-agnostic so unit tests don't have to mount the full middleware.
  const auth = c.get?.('auth');
  if (auth?.tenantId) return getSessionByTenant(String(auth.tenantId));
  return null;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  country: z.string().min(2).max(3), // ISO-3166 alpha-2 or alpha-3
  businessName: z.string().min(1).max(200),
});

const FirstPropertySchema = z.object({
  address: z.string().min(1).max(500),
  unitCount: z.number().int().min(1).max(10_000),
  rentEstimate: z.number().nonnegative().max(1_000_000_000),
  currency: z.string().min(3).max(3).default('KES'),
});

const FirstTenantImportSchema = z.object({
  mode: z.enum(['manual', 'csv']),
  // Manual: a single tenant row. CSV: a parsed list (the FE parses
  // client-side before posting).
  tenants: z
    .array(
      z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        phone: z.string().min(5).max(40),
        email: z.string().email().max(255).optional(),
        unitLabel: z.string().min(1).max(100),
      }),
    )
    .min(1)
    .max(500),
});

const FirstMdChatSchema = z.object({
  prompt: z.string().min(1).max(2_000).optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const app = new Hono();

// 1. POST /signup -----------------------------------------------------------
app.post('/signup', zValidator('json', SignupSchema), async (c) => {
  const body = c.req.valid('json');
  const normalizedEmail = body.email.trim().toLowerCase();

  // Idempotency: if a session already exists for this email, return it.
  const existing = Array.from(sessions.values()).find(
    (s) => s.email === normalizedEmail,
  );
  if (existing) {
    return c.json({
      success: true,
      data: {
        sessionToken: existing.sessionToken,
        tenantId: existing.tenantId,
        ownerUserId: existing.ownerUserId,
        steps: existing.steps,
        alreadyExisted: true,
      },
    });
  }

  const tenantId = newId('tn');
  const ownerUserId = newId('usr');
  const sessionToken = newId('onb');
  const session: OnboardingFlowSession = {
    id: newId('sess'),
    tenantId,
    ownerUserId,
    email: normalizedEmail,
    businessName: body.businessName.trim(),
    country: body.country.toUpperCase(),
    sessionToken,
    createdAt: new Date().toISOString(),
    steps: DEFAULT_STEPS,
  };
  sessions.set(tenantId, session);
  sessionsByToken.set(sessionToken, tenantId);

  return c.json(
    {
      success: true,
      data: {
        sessionToken,
        tenantId,
        ownerUserId,
        email: normalizedEmail,
        businessName: session.businessName,
        steps: session.steps,
      },
    },
    201,
  );
});

// 2. POST /first-property ---------------------------------------------------
app.post(
  '/first-property',
  zValidator('json', FirstPropertySchema),
  async (c) => {
    const session = resolveSession(c);
    if (!session) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NO_SESSION',
            message: 'Onboarding session not found. POST /signup first.',
          },
        },
        404,
      );
    }
    const body = c.req.valid('json');
    const propertyId = newId('prop');
    const nextSteps = markStep(session.steps, 'first_property', {
      propertyId,
      address: body.address,
      unitCount: body.unitCount,
      rentEstimate: body.rentEstimate,
      currency: body.currency,
    });
    const updated: OnboardingFlowSession = {
      ...session,
      firstPropertyId: propertyId,
      steps: nextSteps,
    };
    sessions.set(session.tenantId, updated);
    return c.json({
      success: true,
      data: {
        propertyId,
        steps: nextSteps,
      },
    });
  },
);

// 3. POST /first-tenant-import ---------------------------------------------
app.post(
  '/first-tenant-import',
  zValidator('json', FirstTenantImportSchema),
  async (c) => {
    const session = resolveSession(c);
    if (!session) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NO_SESSION',
            message: 'Onboarding session not found. POST /signup first.',
          },
        },
        404,
      );
    }
    const body = c.req.valid('json');
    const imported = body.tenants.map((t) => ({
      ...t,
      id: newId('cust'),
    }));
    const nextSteps = markStep(session.steps, 'first_tenant_import', {
      mode: body.mode,
      count: imported.length,
    });
    const updated: OnboardingFlowSession = {
      ...session,
      steps: nextSteps,
    };
    sessions.set(session.tenantId, updated);
    return c.json({
      success: true,
      data: {
        imported: imported.length,
        tenants: imported,
        steps: nextSteps,
      },
    });
  },
);

// 4. POST /first-md-chat ----------------------------------------------------
//   Kicks off the first MD conversation. Spawns the inline
//   welcome.coordinator sub-MD which greets the owner, surveys intent,
//   and suggests 3 starter Skills. This is the owner's first "wow"
//   moment — keep latency tight (<20s in E2E budget).
app.post('/first-md-chat', zValidator('json', FirstMdChatSchema), async (c) => {
  const session = resolveSession(c);
  if (!session) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NO_SESSION',
          message: 'Onboarding session not found. POST /signup first.',
        },
      },
      404,
    );
  }
  const body = c.req.valid('json');

  const result = await runWelcomeCoordinator({
    ownerEmail: session.email,
    businessName: session.businessName,
    country: session.country,
    ownerPrompt: body.prompt,
    previousIntent: session.intent,
  });

  const threadId = session.firstChatThreadId ?? newId('thr');
  const nextSteps = markStep(session.steps, 'first_md_chat', {
    threadId,
    welcomeMessageId: result.messageId,
  });
  const updated: OnboardingFlowSession = {
    ...session,
    firstChatThreadId: threadId,
    suggestedSkills: result.suggestedSkills.map((s) => s.slug),
    steps: nextSteps,
  };
  sessions.set(session.tenantId, updated);

  return c.json({
    success: true,
    data: {
      threadId,
      messageId: result.messageId,
      greeting: result.greeting,
      questions: result.intentQuestions,
      suggestedSkills: result.suggestedSkills,
      offerDailyBriefing: result.offerDailyBriefing,
      steps: nextSteps,
    },
  });
});

// 5. GET /checklist ---------------------------------------------------------
app.get('/checklist', async (c) => {
  const session = resolveSession(c);
  if (!session) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NO_SESSION',
          message: 'Onboarding session not found. POST /signup first.',
        },
      },
      404,
    );
  }
  const completed = session.steps.filter((s) => s.completed).length;
  const total = session.steps.length;
  return c.json({
    success: true,
    data: {
      tenantId: session.tenantId,
      businessName: session.businessName,
      progress: {
        completed,
        total,
        percent: Math.round((completed / total) * 100),
      },
      steps: session.steps,
      intent: session.intent ?? null,
      suggestedSkills: session.suggestedSkills ?? [],
    },
  });
});

// Internal test surface — let tests force a known session into the store.
// Guarded by NODE_ENV so production never exposes it. This keeps the
// in-memory pilot store testable without exposing a private API.
if (process.env.NODE_ENV !== 'production') {
  app.post('/__test__/reset', (c) => {
    sessions.clear();
    sessionsByToken.clear();
    return c.json({ success: true });
  });
}

export const onboardingFlowRouter = app;
