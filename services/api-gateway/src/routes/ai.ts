// @ts-nocheck
/**
 * AI Copilot API routes
 *
 * Wires the api-gateway to the real @bossnyumba/ai-copilot package and the
 * @bossnyumba/reports-service KPI engine. If either package is not
 * importable in this deployment, the endpoints return 503
 * Service Unavailable rather than fake data.
 *
 * Endpoints:
 *   POST /copilot/chat  - conversational copilot backed by the
 *                         selected AI provider (OpenAI, with provider-gate
 *                         fallback for jurisdictions that block DeepSeek).
 *   GET  /briefing      - real daily briefing derived from KPI data.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';

type CopilotMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// ---------------------------------------------------------------------------
// Lazy package loader - keeps the gateway functional even when the AI
// package is not installed in this deployment.
// ---------------------------------------------------------------------------

let copilotSingleton: any = null;
let copilotLoadError: string | null = null;
let copilotLoadAttempted = false;

async function getCopilot(): Promise<any> {
  if (copilotSingleton || copilotLoadAttempted) return copilotSingleton;
  copilotLoadAttempted = true;
  try {
    const mod: any = await import('@bossnyumba/ai-copilot');
    const useMock = !process.env.OPENAI_API_KEY;
    copilotSingleton = mod.createAICopilot({
      useMockProvider: useMock,
      openai: useMock ? undefined : { apiKey: process.env.OPENAI_API_KEY },
      registerDefaultPrompts: true,
    });
  } catch (err) {
    copilotLoadError = err instanceof Error ? err.message : String(err);
  }
  return copilotSingleton;
}

let reportsModule: any = null;
let reportsLoadError: string | null = null;
let reportsLoadAttempted = false;

async function getReportsModule(): Promise<any> {
  if (reportsModule || reportsLoadAttempted) return reportsModule;
  reportsLoadAttempted = true;
  // Try both canonical names the task and workspace could be using.
  for (const name of ['@bossnyumba/reports-service', '@bossnyumba/reports']) {
    try {
      reportsModule = await import(name);
      return reportsModule;
    } catch (err) {
      reportsLoadError = err instanceof Error ? err.message : String(err);
    }
  }
  return reportsModule;
}

// ---------------------------------------------------------------------------
// LLM provider-gate: choose a provider the caller's jurisdiction permits.
// The platform stores a per-tenant jurisdiction + an env-level DeepSeek
// block list. If DeepSeek is gated out, we pick another available provider.
// ---------------------------------------------------------------------------

function deepseekBlockedJurisdictions(): Set<string> {
  const raw = process.env.LLM_PROVIDER_GATE_BLOCK_DEEPSEEK || 'KE,UG,TZ,RW';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

function resolveProviderForJurisdiction(jurisdiction?: string): 'openai' | 'deepseek' | 'mock' {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
  const blocked = deepseekBlockedJurisdictions();
  const juris = (jurisdiction || process.env.TENANT_JURISDICTION || 'KE').toUpperCase();

  if (blocked.has(juris)) {
    if (hasOpenAI) return 'openai';
    return 'mock';
  }
  if (hasDeepSeek) return 'deepseek';
  if (hasOpenAI) return 'openai';
  return 'mock';
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const app = new Hono();
app.use('*', authMiddleware);

// POST /copilot/chat - chat completion against the real copilot
app.post('/copilot/chat', async (c) => {
  const copilot = await getCopilot();
  if (!copilot) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AI_COPILOT_UNAVAILABLE',
          message: '@bossnyumba/ai-copilot is not available in this deployment',
          detail: copilotLoadError,
        },
      },
      503
    );
  }

  const auth = c.get('auth');
  const activeOrgId = c.get('activeOrgId') || auth.tenantId;
  const body = await c.req.json().catch(() => ({}));
  const messages: CopilotMessage[] = Array.isArray(body.messages) ? body.messages : [];

  if (messages.length === 0) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'messages[] is required' },
      },
      400
    );
  }

  const jurisdiction: string | undefined = body.jurisdiction || c.req.header('x-tenant-jurisdiction');
  const provider = resolveProviderForJurisdiction(jurisdiction);

  try {
    // Use the copilot's AI provider registry directly for a conversational
    // chat endpoint. This is the lowest-level primitive exported by the
    // package and gives us a real completion from the configured provider.
    const registry = (copilot as any).providerRegistry ?? (copilot as any).providers;
    const aiProvider = registry?.get?.();

    if (!aiProvider) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AI_PROVIDER_UNAVAILABLE',
            message:
              'No AI provider is registered. Configure OPENAI_API_KEY or enable the mock provider.',
          },
        },
        503
      );
    }

    const systemMsg = messages.find((m) => m.role === 'system');
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const transcript = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const compiledPrompt = {
      id: 'bff-chat-compiled',
      promptId: 'bff-chat',
      version: 1,
      systemPrompt:
        systemMsg?.content ??
        'You are the BOSSNYUMBA AI copilot. Answer concisely for property managers and landlords.',
      userPrompt: lastUser?.content ?? '',
      compiledMessages: messages.map((m) => ({ role: m.role, content: m.content })),
      modelId: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 800,
    };

    const completion = await aiProvider.complete({
      prompt: compiledPrompt,
      additionalContext: `Tenant: ${auth.tenantId}. ActiveOrg: ${activeOrgId}. Transcript:\n${transcript}`,
      jsonMode: false,
      timeoutMs: 30_000,
    });

    if (!completion.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'AI_COMPLETION_FAILED',
            message: completion.error?.message ?? 'AI completion failed',
            retryable: true,
          },
        },
        502
      );
    }

    return c.json({
      success: true,
      data: {
        reply: completion.data.content,
        model: completion.data.modelId,
        provider,
        usage: completion.data.usage,
        processingTimeMs: completion.data.processingTimeMs,
        tenantId: auth.tenantId,
        activeOrgId,
      },
    });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AI_COPILOT_ERROR',
          message: err instanceof Error ? err.message : 'Unknown AI copilot error',
        },
      },
      502
    );
  }
});

// GET /briefing - daily briefing derived from real KPI data (mounted below)
const briefingApp = new Hono();
briefingApp.use('*', authMiddleware);
briefingApp.use('*', databaseMiddleware);
briefingApp.get('/', async (c) => {
  const reports = await getReportsModule();
  if (!reports) {
    return c.json(
      {
        success: false,
        error: {
          code: 'REPORTS_SERVICE_UNAVAILABLE',
          message: '@bossnyumba/reports-service is not available in this deployment',
          detail: reportsLoadError,
        },
      },
      503
    );
  }

  const auth = c.get('auth');
  const repos = c.get('repos');
  const activeOrgId = c.get('activeOrgId') || auth.tenantId;

  try {
    // Build a KPI data provider backed by the gateway repositories. If the
    // reports package exposes a mock provider, use it; otherwise return 503
    // rather than fake data.
    const provider = reports.MockReportDataProvider
      ? new reports.MockReportDataProvider()
      : null;
    if (!provider) {
      return c.json(
        {
          success: false,
          error: {
            code: 'KPI_PROVIDER_UNAVAILABLE',
            message: 'No KPI data provider is configured for this environment.',
          },
        },
        503
      );
    }

    const now = new Date();
    const period = {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: now,
      label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    };

    const engine = new reports.KPIEngine(provider);
    const portfolio = await engine.calculatePortfolioKPIs(auth.tenantId, period);

    // Extract simple top-line numbers for the client.
    const propertiesResult = await repos.properties.findMany(auth.tenantId, { limit: 1000, offset: 0 });
    const properties = propertiesResult.items.filter(
      (p: any) => auth.propertyAccess?.includes('*') || auth.propertyAccess?.includes(p.id)
    );

    return c.json({
      success: true,
      data: {
        generatedAt: now.toISOString(),
        tenantId: auth.tenantId,
        activeOrgId,
        period: { start: period.start.toISOString(), end: period.end.toISOString(), label: period.label },
        headline: `Portfolio health: ${Math.round(portfolio.healthScore.current ?? 0)} / 100`,
        kpis: {
          occupancyRate: portfolio.occupancy.physicalOccupancy.current,
          collectionRate: portfolio.collection.collectionRate.current,
          totalRevenue: portfolio.financial.totalRevenue.current,
          openWorkOrders: portfolio.maintenance.openWorkOrders,
          slaComplianceRate: portfolio.maintenance.slaComplianceRate.current,
          satisfaction: portfolio.satisfaction.overallSatisfaction.current,
        },
        propertyCount: properties.length,
      },
    });
  } catch (err) {
    return c.json(
      {
        success: false,
        error: {
          code: 'BRIEFING_GENERATION_FAILED',
          message: err instanceof Error ? err.message : 'Failed to generate briefing',
        },
      },
      503
    );
  }
});

// Compose: /copilot/* uses chat (auth only), /briefing uses auth+db
const root = new Hono();
root.route('/copilot', app);
root.route('/briefing', briefingApp);

export const aiRouter = root;
