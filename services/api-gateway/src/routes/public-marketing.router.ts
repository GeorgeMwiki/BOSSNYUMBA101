/**
 * Public Marketing API — UNAUTHENTICATED routes for Mr. Mwikila's marketing chat.
 *
 *   POST /public/chat            — anonymous conversation turn
 *   POST /public/pricing-advice  — tier recommendation
 *   POST /public/demo-estate     — generate sandbox data for a session
 *   GET  /public/demo-estate/:id — fetch sandbox data by session id
 *   POST /public/waitlist        — forward signup to the waitlist domain
 *
 * These endpoints MUST NEVER read or write to authenticated tenant data.
 * All demo data is stored in a process-local ephemeral Map keyed by
 * session id. Anything that looks like it needs a tenant context is
 * rejected with 400.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  buildMarketingSystemPrompt,
  qualifyLead,
  generateDemoEstate,
  createDemoStore,
  putDemoEstate,
  getDemoEstate,
  adviseTier,
  buildWaitlistSignup,
  DemoEstate,
} from '@bossnyumba/marketing-brain';

// Singleton ephemeral store — scoped to the process. In production each
// gateway instance keeps its own; a shared Redis cache is a follow-up.
const demoStore = createDemoStore();

const ChatTurnSchema = z.object({
  sessionId: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
  transcript: z
    .array(
      z.object({
        role: z.enum(['visitor', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(40)
    .optional(),
  visitorCountry: z.enum(['KE', 'TZ', 'UG', 'other']).optional(),
});

const DemoEstateSchema = z.object({
  sessionId: z.string().min(1).max(120),
  tenantLabel: z.string().min(1).max(60),
  country: z.enum(['KE', 'TZ', 'UG']),
  portfolioSize: z.enum(['micro', 'small', 'mid', 'large']),
});

const WaitlistSchema = z.object({
  sessionId: z.string().min(1),
  contactName: z.string().min(1).max(200),
  contactMethod: z.enum(['email', 'phone', 'whatsapp']),
  contactValue: z.string().min(3).max(200),
  country: z.enum(['KE', 'TZ', 'UG', 'other']).optional(),
  role: z.enum(['owner', 'tenant', 'manager', 'station_master', 'unknown']).optional(),
  portfolioSize: z.enum(['micro', 'small', 'mid', 'large']).optional(),
  notes: z.string().max(2000).optional(),
});

const PricingSchema = z.object({
  unitCount: z.number().int().nonnegative().optional(),
  portfolioSize: z.enum(['micro', 'small', 'mid', 'large']).optional(),
  role: z.enum(['owner', 'tenant', 'manager', 'station_master', 'unknown']).optional(),
  country: z.enum(['KE', 'TZ', 'UG', 'other']).optional(),
});

const app = new Hono();

app.post('/chat', zValidator('json', ChatTurnSchema), async (c) => {
  const body = c.req.valid('json');
  const visitorText = [
    body.message,
    ...(body.transcript?.filter((t) => t.role === 'visitor').map((t) => t.content) ?? []),
  ].join('\n');
  const lead = qualifyLead(visitorText);
  const countryForPrompt =
    body.visitorCountry && body.visitorCountry !== 'other'
      ? (body.visitorCountry as 'KE' | 'TZ' | 'UG')
      : undefined;
  const systemPrompt = buildMarketingSystemPrompt({
    ...(countryForPrompt ? { visitorCountry: countryForPrompt } : {}),
    visitorRole: lead.role,
  });

  // The gateway does not itself call an LLM here — that runs in the
  // brain service. This endpoint returns the composed context that the
  // chat-ui picks up via SSE from the brain route. Returning a stub
  // reply keeps the landing page functional even when the brain is
  // offline.
  const stubReply = buildStubReply(lead.role, body.message);

  return c.json({
    success: true,
    data: {
      sessionId: body.sessionId,
      lead,
      systemPrompt,
      reply: stubReply,
      suggestedRoute: lead.route,
    },
  });
});

app.post('/pricing-advice', zValidator('json', PricingSchema), async (c) => {
  const body = c.req.valid('json');
  const advice = adviseTier(body);
  return c.json({ success: true, data: advice });
});

app.post('/demo-estate', zValidator('json', DemoEstateSchema), async (c) => {
  const body = c.req.valid('json');
  const estate: DemoEstate = generateDemoEstate(body);
  putDemoEstate(demoStore, estate);
  return c.json({ success: true, data: estate });
});

app.get('/demo-estate/:id', (c) => {
  const id = c.req.param('id');
  const estate = getDemoEstate(demoStore, id);
  if (!estate) {
    return c.json(
      {
        success: false,
        error: { code: 'DEMO_EXPIRED', message: 'Demo session not found or expired' },
      },
      404
    );
  }
  return c.json({ success: true, data: estate });
});

app.post('/waitlist', zValidator('json', WaitlistSchema), async (c) => {
  const body = c.req.valid('json');
  try {
    const payload = buildWaitlistSignup(body);
    // The actual persistence lives in the authenticated waitlist router.
    // Here we just echo the built payload so the chat UI can show a
    // confirmation and a follow-up POST can commit it once the prospect
    // provides the minimal shopper-user identity they need.
    return c.json({ success: true, data: payload });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_CONTACT',
          message: err instanceof Error ? err.message : 'invalid contact',
        },
      },
      400
    );
  }
});

function buildStubReply(
  role: ReturnType<typeof qualifyLead>['role'],
  message: string
): string {
  const trimmed = message.slice(0, 200);
  if (role === 'unknown') {
    return `Before I dive in: are you an owner, a tenant, a property manager, or a station master? That'll let me point you at the right capability. You said: "${trimmed}".`;
  }
  const greetings: Record<string, string> = {
    owner: `Got it — an owner. Most owners start with rent reminders on autopilot. How many units are you running today?`,
    tenant: `Got it — a tenant. BOSSNYUMBA gives you one place for rent receipts, maintenance requests, and notices. What is your biggest pain right now?`,
    manager: `Got it — a property manager. Owner reports are the #1 time sink; let me show you how BOSSNYUMBA drafts them for you.`,
    station_master: `Got it — a station master. You can log incidents by voice in Swahili. Want a 60-second walkthrough?`,
  };
  return greetings[role] ?? `Let me help.`;
}

export default app;
