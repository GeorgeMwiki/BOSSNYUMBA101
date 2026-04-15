// @ts-nocheck
/**
 * AI Copilot routes
 *
 * POST /ai/copilot/chat          — chat with the owner AI copilot (SSE stream, JSON fallback)
 * GET  /ai/copilot/suggestions   — context-aware suggested prompts
 *
 * Wiring:
 *   Flutter client -> /api/v1/ai/copilot/chat
 *     -> authMiddleware -> databaseMiddleware
 *     -> loadPortfolioContext(orgId)  (arrears + occupancy + property names)
 *     -> PortfolioChatCopilot.chatStream(...)
 *       -> LLMProviderGate.pick(jurisdiction)   // blocks DeepSeek for TZ/KE
 *       -> AnthropicProvider.stream(...)        // real Claude call
 *
 * API keys come from ANTHROPIC_API_KEY / OPENAI_API_KEY. No hardcoded keys.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import {
  AnthropicProvider,
  OpenAIProvider,
  MockAIProvider,
  createLLMProviderGate,
  createPortfolioChatCopilot,
  suggestedPrompts,
  type PortfolioContext,
  type ChatMessage,
} from '@bossnyumba/ai-copilot';

const aiRouter = new Hono();

// ---------------------------------------------------------------------------
// Provider bootstrap (lazy singleton)
// ---------------------------------------------------------------------------

let _copilotInstance: ReturnType<typeof createPortfolioChatCopilot> | null = null;

function getCopilot() {
  if (_copilotInstance) return _copilotInstance;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const anthropic = anthropicKey
    ? new AnthropicProvider({ apiKey: anthropicKey })
    : undefined;
  const openai = openaiKey ? new OpenAIProvider({ apiKey: openaiKey }) : undefined;

  // Mock fallback is only registered in non-production so local dev/CI still works.
  const useMock = process.env.NODE_ENV !== 'production' && !anthropic && !openai;
  const mock = useMock ? new MockAIProvider() : undefined;

  const gate = createLLMProviderGate({ anthropic, openai, mock });
  _copilotInstance = createPortfolioChatCopilot(gate);
  return _copilotInstance;
}

// ---------------------------------------------------------------------------
// Portfolio context loader
// ---------------------------------------------------------------------------

function jurisdictionFromTenant(tenant: any): string {
  // Prefer explicit country code on tenant; default to GLOBAL.
  const cc = (tenant?.countryCode || tenant?.country || '').toString().toUpperCase();
  if (cc === 'TZ' || cc === 'KE' || cc === 'UG' || cc === 'RW') return cc;
  return 'GLOBAL';
}

async function loadPortfolioContext(
  c: any,
  orgId: string
): Promise<PortfolioContext> {
  const repos = c.get('repositories') as any;
  const jurisdiction = jurisdictionFromTenant(c.get('tenant'));
  const reportingMonth = new Date().toISOString().slice(0, 7);

  // Graceful fallback: if DB not initialized, return empty snapshot.
  if (!repos) {
    return {
      orgId,
      jurisdiction,
      reportingMonth,
      properties: [],
      arrears: [],
      occupancyRate: 0,
      totalTenants: 0,
    };
  }

  const propertyRepo = repos.propertyRepository;
  const unitRepo = repos.unitRepository;
  const leaseRepo = repos.leaseRepository;
  const invoiceRepo = repos.invoiceRepository;
  const customerRepo = repos.customerRepository;

  const properties = (await propertyRepo?.findByTenant?.(orgId)) ?? [];
  const units = (await unitRepo?.findByTenant?.(orgId)) ?? [];
  const leases = (await leaseRepo?.findByTenant?.(orgId)) ?? [];
  const invoices = (await invoiceRepo?.findByTenant?.(orgId)) ?? [];
  const customers = (await customerRepo?.findByTenant?.(orgId)) ?? [];

  const occupiedUnitIds = new Set(
    leases.filter((l: any) => l.status === 'ACTIVE').map((l: any) => l.unitId)
  );

  const propertySnap = properties.map((p: any) => {
    const propertyUnits = units.filter((u: any) => u.propertyId === p.id);
    return {
      name: p.name ?? 'Property',
      totalUnits: propertyUnits.length,
      occupiedUnits: propertyUnits.filter((u: any) => occupiedUnitIds.has(u.id)).length,
    };
  });

  const totalUnits = units.length;
  const occupancyRate = totalUnits > 0 ? occupiedUnitIds.size / totalUnits : 0;

  // Arrears = unpaid invoices past due date.
  const today = new Date();
  const arrearsInvoices = invoices.filter((inv: any) => {
    if (inv.status === 'PAID' || inv.status === 'CANCELLED') return false;
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    return due !== null && due < today;
  });

  const customerById = new Map(customers.map((x: any) => [x.id, x]));
  const unitById = new Map(units.map((u: any) => [u.id, u]));
  const leaseById = new Map(leases.map((l: any) => [l.id, l]));

  const arrears = arrearsInvoices.slice(0, 20).map((inv: any) => {
    const lease = inv.leaseId ? leaseById.get(inv.leaseId) : null;
    const customer = lease?.customerId ? customerById.get(lease.customerId) : null;
    const unit = lease?.unitId ? unitById.get(lease.unitId) : null;
    const daysOverdue = inv.dueDate
      ? Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000)
      : 0;
    const outstandingMinor =
      Number(inv.amountDueMinor ?? inv.totalAmountMinor ?? 0) -
      Number(inv.amountPaidMinor ?? 0);
    return {
      tenantName: customer
        ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || 'Tenant'
        : 'Tenant',
      unitLabel: unit?.label ?? unit?.name ?? 'Unit',
      amountOutstanding: Math.max(0, Math.round(outstandingMinor / 100)),
      daysOverdue,
      currency: inv.currency ?? 'KES',
    };
  });

  return {
    orgId,
    jurisdiction,
    reportingMonth,
    properties: propertySnap,
    arrears,
    occupancyRate,
    totalTenants: customers.length,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

aiRouter.use('*', authMiddleware);
aiRouter.use('*', databaseMiddleware);

/**
 * GET /ai/copilot/suggestions?activeOrgId=...
 */
aiRouter.get('/copilot/suggestions', async (c) => {
  const auth = c.get('auth');
  const activeOrgId = c.req.query('activeOrgId') || auth?.tenantId;
  if (!activeOrgId) {
    return c.json(
      { success: false, error: { code: 'MISSING_ORG', message: 'activeOrgId required' } },
      400
    );
  }
  const portfolio = await loadPortfolioContext(c, activeOrgId);
  return c.json({
    success: true,
    data: { suggestions: suggestedPrompts(portfolio) },
  });
});

/**
 * POST /ai/copilot/chat
 * Body: { history: ChatMessage[], prompt: string, activeOrgId: string, stream?: boolean }
 * If the client sends `Accept: text/event-stream` OR `stream: true`, returns SSE.
 * Otherwise returns a single JSON response.
 */
aiRouter.post('/copilot/chat', async (c) => {
  const auth = c.get('auth');
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: { code: 'BAD_BODY', message: 'Invalid JSON body' } },
      400
    );
  }

  const { history = [], prompt, activeOrgId: bodyOrgId } = body as {
    history?: ChatMessage[];
    prompt?: string;
    activeOrgId?: string;
  };
  const activeOrgId = bodyOrgId || auth?.tenantId;
  if (!prompt || !activeOrgId) {
    return c.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'prompt and activeOrgId are required' },
      },
      400
    );
  }

  const portfolio = await loadPortfolioContext(c, activeOrgId);
  const copilot = getCopilot();

  const accept = c.req.header('Accept') || '';
  const wantsSSE = accept.includes('text/event-stream') || body.stream === true;

  const chatReq = {
    history: Array.isArray(history) ? history : [],
    prompt,
    activeOrgId,
    jurisdiction: portfolio.jurisdiction,
    portfolio,
  };

  if (wantsSSE) {
    return streamSSE(c, async (stream) => {
      try {
        await stream.writeSSE({ event: 'start', data: JSON.stringify({ ok: true }) });
        for await (const chunk of copilot.chatStream(chatReq)) {
          if (chunk.delta) {
            await stream.writeSSE({
              event: 'delta',
              data: JSON.stringify({ text: chunk.delta }),
            });
          }
          if (chunk.done) {
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify({ providerId: chunk.providerId }),
            });
            return;
          }
        }
        await stream.writeSSE({ event: 'done', data: JSON.stringify({}) });
      } catch (err) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            message: err instanceof Error ? err.message : 'AI stream failed',
          }),
        });
      }
    });
  }

  // JSON fallback
  try {
    const result = await copilot.chat(chatReq);
    return c.json({ success: true, data: result });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AI_PROVIDER_ERROR',
          message: err instanceof Error ? err.message : 'AI provider error',
        },
      },
      502
    );
  }
});

export { aiRouter };
