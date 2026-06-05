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
import { streamSSE } from 'hono/streaming';
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
import type { StreamTurnEvent } from '@bossnyumba/ai-copilot';
import pino from 'pino';
import {
  AnthropicAdapter,
  OpenAIAdapter,
} from '@bossnyumba/brain-llm-router/universal-client';
import type {
  BrainLLMClient,
  BrainLLMMessage,
  BrainLLMResponse,
} from '@bossnyumba/brain-llm-router';

const logger = pino({ name: 'public-marketing' });

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

// ─── Real LLM provider ladder (mirrors the Borjie public-chat pattern) ──
// Anthropic primary → OpenAI fallback. Non-streaming invoke, then the
// reply is chunked into StreamTurnEvent deltas by `marketingChatStream`
// (the same SSE shape the chat-ui hook already consumes). If NO provider
// is configured or all fail, the route returns 503 — and the marketing
// Next route's `tryGateway` treats a non-200 as "fall back to the direct
// Anthropic path", so the visitor never sees a canned stub.

interface MarketingProviders {
  readonly anthropic: AnthropicAdapter | null;
  readonly openai: OpenAIAdapter | null;
}

function marketingProviders(): MarketingProviders {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  return {
    anthropic: anthropicKey ? new AnthropicAdapter({ apiKey: anthropicKey }) : null,
    openai: openaiKey ? new OpenAIAdapter({ apiKey: openaiKey }) : null,
  };
}

function extractReplyText(resp: BrainLLMResponse): string {
  return resp.content
    .filter((b): b is { readonly type: 'text'; readonly text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/** Map the public transcript + current message to BrainLLM messages. */
function buildMarketingMessages(
  message: string,
  transcript?: ReadonlyArray<{ readonly role?: 'visitor' | 'assistant'; readonly content?: string }>,
): BrainLLMMessage[] {
  const history: BrainLLMMessage[] = (transcript ?? [])
    .filter(
      (t): t is { role: 'visitor' | 'assistant'; content: string } =>
        (t.role === 'visitor' || t.role === 'assistant') && typeof t.content === 'string',
    )
    .map((t) => ({
      role: t.role === 'visitor' ? ('user' as const) : ('assistant' as const),
      content: [{ type: 'text' as const, text: t.content }],
    }));
  return [
    ...history,
    { role: 'user' as const, content: [{ type: 'text' as const, text: message }] },
  ];
}

/**
 * Run the marketing turn through the real LLM ladder. Throws on
 * no-provider / all-failed so the caller can 503 (→ Next route falls
 * back to direct Anthropic). Never returns canned text.
 */
async function runMarketingLLM(
  systemPrompt: string,
  messages: readonly BrainLLMMessage[],
): Promise<string> {
  const { anthropic, openai } = marketingProviders();
  const ladder: ReadonlyArray<{ readonly model: string; readonly client: BrainLLMClient; readonly name: string }> = [
    ...(anthropic
      ? [{
          model: process.env.BOSSNYUMBA_CHAT_ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-5-20250929',
          client: anthropic,
          name: 'anthropic',
        }]
      : []),
    ...(openai
      ? [{
          model: process.env.BOSSNYUMBA_CHAT_OPENAI_MODEL?.trim() || 'gpt-4o-2024-11-20',
          client: openai,
          name: 'openai',
        }]
      : []),
  ];

  if (ladder.length === 0) throw new Error('no_provider_configured');

  let lastError: unknown = null;
  for (const entry of ladder) {
    const t0 = Date.now();
    try {
      const resp = await entry.client.invoke({
        model: entry.model,
        messages,
        system: systemPrompt,
        maxTokens: 600,
        temperature: 0.9,
      });
      const text = extractReplyText(resp);
      if (text) return text;
      lastError = new Error('empty_response');
    } catch (err) {
      lastError = err;
      logger.warn(
        {
          provider: entry.name,
          model: entry.model,
          err: (err instanceof Error ? err.message : String(err)).slice(0, 600),
          latencyMs: Date.now() - t0,
        },
        'public-marketing: provider attempt failed',
      );
    }
  }
  throw lastError ?? new Error('all_providers_failed');
}

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

  // Real LLM turn. On no-provider / all-failed we 503 — the marketing
  // Next route's tryGateway treats a non-200 as "fall back to the direct
  // Anthropic path", so the visitor never sees canned text.
  const messages = buildMarketingMessages(body.message, body.transcript);
  let reply: string;
  try {
    reply = await runMarketingLLM(systemPrompt, messages);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'public-marketing: LLM unavailable',
    );
    return c.json(
      {
        success: false,
        error: { code: 'AI_UNAVAILABLE', message: 'Marketing chat is temporarily unavailable.' },
      },
      503,
    );
  }

  // Content negotiation — text/event-stream gets the real reply chunked
  // into StreamTurnEvent deltas (same SSE shape as the authenticated
  // surfaces); JSON clients get the plain reply. The system prompt is
  // NEVER returned in the response body (IP protection).
  const accept = c.req.header('accept') ?? '';
  if (accept.includes('text/event-stream')) {
    return streamSSE(c, async (stream) => {
      const abort = new AbortController();
      stream.onAbort(() => abort.abort());

      for await (const evt of marketingChatStream(reply, {
        sessionId: body.sessionId,
        personaId: 'public-guide',
        suggestedRoute: lead.route,
        signal: abort.signal,
      })) {
        await stream.writeSSE({ event: evt.type, data: JSON.stringify(evt) });
      }
    });
  }

  return c.json({
    success: true,
    data: {
      sessionId: body.sessionId,
      lead,
      reply,
      suggestedRoute: lead.route,
    },
  });
});

/**
 * Stream a public/marketing chat turn as StreamTurnEvent. Mirrors the
 * authenticated streamTurn contract so the chat-ui `useChatStream` hook
 * can consume both surfaces with the same SSE parser.
 */
async function* marketingChatStream(
  reply: string,
  opts: {
    readonly sessionId: string;
    readonly personaId: string;
    readonly suggestedRoute: string;
    readonly signal?: AbortSignal;
  }
): AsyncGenerator<StreamTurnEvent> {
  const { signal } = opts;
  const start = Date.now();
  yield {
    type: 'turn_start',
    threadId: opts.sessionId,
    personaId: opts.personaId,
    createdAt: new Date().toISOString(),
  };
  const size = 24;
  for (let i = 0; i < reply.length; i += size) {
    if (signal?.aborted) break;
    yield { type: 'delta', content: reply.slice(i, i + size) };
    await new Promise<void>((r) => setTimeout(r, 12));
  }
  // Emit the suggested-route as a lightweight handoff event so the UI can
  // render the appropriate CTA card without a separate REST call.
  yield {
    type: 'handoff',
    from: opts.personaId,
    to: opts.suggestedRoute,
    objective: 'suggested next step',
  };
  yield {
    type: 'turn_end',
    threadId: opts.sessionId,
    finalPersonaId: opts.personaId,
    totalTokens: 0,
    totalCost: 0,
    timeMs: Date.now() - start,
    advisorConsulted: false,
  };
}

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

export default app;
