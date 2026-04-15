// @ts-nocheck
/**
 * AI Copilot routes
 *
 * Mounts under /api/v1/ai.
 *
 *  POST /ai/copilot/chat   - conversational chat grounded in the user's portfolio
 *  POST /ai/briefing        - daily briefing in the user's preferred language
 *
 * Responsibilities:
 *  1. Read tenant + active-org + jurisdiction from auth context.
 *  2. Fetch a PORTFOLIO CONTEXT summary (properties/units/collection/tickets).
 *  3. Build a system prompt containing portfolio facts + jurisdiction rules.
 *  4. Route through the llm-provider-gate (respects DeepSeek bans per jurisdiction).
 *  5. Stream via SSE when the client prefers, else return JSON.
 *  6. Log every interaction to ai_interactions for learning / cost tracking.
 *
 * Graceful degradation: when no real API key is configured (or the jurisdiction
 * blocks every available provider), we fall back to MockChatProvider which
 * returns "AI disabled \u2014 set ANTHROPIC_API_KEY" instead of crashing.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import {
  resolveChatProvider,
  getJurisdictionPolicy,
  type ChatMessage,
  type ChatProvider,
  type JurisdictionPolicy,
} from '@bossnyumba/ai-copilot';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';

// Lazily import the reports service so a missing/uninstalled package
// (e.g. in lightweight CI environments) degrades to repo-only metrics
// instead of crashing the whole AI router.
let reportsModulePromise: Promise<{ mod: any | null }> | null = null;
async function loadReportsModule(): Promise<{ mod: any | null }> {
  if (reportsModulePromise) return reportsModulePromise;
  reportsModulePromise = (async () => {
    for (const name of ['@bossnyumba/reports-service', '@bossnyumba/reports']) {
      try {
        return { mod: await import(name) };
      } catch {
        // try next
      }
    }
    return { mod: null };
  })();
  return reportsModulePromise;
}

export const aiRouter = new Hono();

aiRouter.use('*', authMiddleware);
aiRouter.use('*', databaseMiddleware);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(8000),
});

const chatSchema = z.object({
  message: z.string().min(1).max(8000),
  conversation: z.array(chatMessageSchema).max(40).optional().default([]),
  provider: z.enum(['anthropic', 'openai', 'deepseek']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(64).max(4096).optional(),
});

const briefingSchema = z.object({
  date: z.string().optional(),
  locale: z.string().optional(),
}).partial();

// ---------------------------------------------------------------------------
// Portfolio context collection
// ---------------------------------------------------------------------------
interface PortfolioContext {
  propertyCount: number;
  unitCount: number;
  tenantCount: number;
  openTickets: number;
  criticalTickets: number;
  monthlyInvoiced: number;
  monthlyCollected: number;
  collectionRate: number; // 0-100
  currency: string;
  asOf: string;
  flags: string[];
  jurisdictionCode: string;
}

function startOfMonthUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

async function fetchPortfolioContext(
  repos: any,
  auth: { tenantId: string; propertyAccess?: string[] },
  jurisdictionCode: string,
  db?: any
): Promise<PortfolioContext> {
  const defaults: PortfolioContext = {
    propertyCount: 0,
    unitCount: 0,
    tenantCount: 0,
    openTickets: 0,
    criticalTickets: 0,
    monthlyInvoiced: 0,
    monthlyCollected: 0,
    collectionRate: 0,
    currency: currencyForJurisdiction(jurisdictionCode),
    asOf: new Date().toISOString(),
    flags: [],
    jurisdictionCode,
  };
  if (!repos) return defaults;

  try {
    const [properties, units, customers, leases, invoices, payments, workOrders] = await Promise.all([
      repos.properties.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.units.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.customers.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.leases.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.invoices.findMany(auth.tenantId, 5000, 0),
      repos.payments.findMany(auth.tenantId, 5000, 0),
      repos.workOrders.findMany(auth.tenantId, 5000, 0),
    ]);

    const accessibleProps = auth.propertyAccess?.includes('*')
      ? properties.items
      : properties.items.filter((p: any) => auth.propertyAccess?.includes(p.id));
    const propIds = new Set(accessibleProps.map((p: any) => p.id));

    const scopedUnits = units.items.filter((u: any) => propIds.has(u.propertyId));
    const scopedLeases = leases.items.filter(
      (l: any) => propIds.has(l.propertyId) || scopedUnits.some((u: any) => u.id === l.unitId)
    );
    const activeCustomerIds = new Set(scopedLeases.map((l: any) => l.customerId));
    const scopedTenants = customers.items.filter((c: any) => activeCustomerIds.has(c.id));

    const monthStart = startOfMonthUtc();
    const scopedInvoices = invoices.items.filter((inv: any) => {
      const d = new Date(inv.createdAt ?? inv.issuedAt ?? inv.invoiceDate ?? Date.now());
      return d >= monthStart;
    });
    const scopedPayments = payments.items.filter((pay: any) => {
      const d = new Date(pay.completedAt ?? pay.createdAt ?? Date.now());
      return d >= monthStart;
    });

    let monthlyInvoiced = scopedInvoices.reduce((s: number, inv: any) => s + Number(inv.total ?? inv.amount ?? 0), 0);
    let monthlyCollected = scopedPayments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    let collectionRate = monthlyInvoiced > 0 ? (monthlyCollected / monthlyInvoiced) * 100 : 0;

    const scopedWOs = workOrders.items.filter((wo: any) => propIds.has(wo.propertyId));
    const openStatuses = new Set([
      'submitted',
      'triaged',
      'pending_approval',
      'approved',
      'assigned',
      'scheduled',
      'in_progress',
      'pending_verification',
    ]);
    const openTickets = scopedWOs.filter((wo: any) => openStatuses.has(wo.status)).length;
    const criticalTickets = scopedWOs.filter(
      (wo: any) => openStatuses.has(wo.status) && (wo.priority === 'emergency' || wo.priority === 'high')
    ).length;

    // Prefer SQLKPIDataProvider for the headline money numbers when the
    // reports service is available — it runs the same SQL aggregations
    // that the owner portfolio endpoint uses, keeping briefing and
    // portfolio in sync.
    if (db) {
      try {
        const loaded = await loadReportsModule();
        if (loaded?.mod?.SQLKPIDataProvider) {
          const provider = new loaded.mod.SQLKPIDataProvider(db, { tenantId: auth.tenantId });
          const period = {
            start: monthStart,
            end: new Date(),
            label: 'mtd',
          };
          const propertyIdList =
            propIds.size > 0 && !auth.propertyAccess?.includes('*')
              ? Array.from(propIds) as string[]
              : undefined;
          const collection = await provider.getRentCollectionRate(
            auth.tenantId,
            period,
            propertyIdList
          );
          monthlyInvoiced = collection.totalBilled;
          monthlyCollected = collection.totalCollected;
          collectionRate = collection.rate;
        }
      } catch {
        // Fall back to repo-derived values silently — never break the AI
        // briefing because the KPI provider hiccupped.
      }
    }

    const flags: string[] = [];
    if (collectionRate > 0 && collectionRate < 75) flags.push('LOW_COLLECTION_RATE');
    if (criticalTickets >= 3) flags.push('MULTIPLE_CRITICAL_TICKETS');
    const overdue = invoices.items.filter((inv: any) => {
      const due = new Date(inv.dueDate ?? 0);
      return Number(inv.amountDue ?? 0) > 0 && due < new Date();
    });
    if (overdue.length >= 5) flags.push('OVERDUE_INVOICES');

    return {
      propertyCount: accessibleProps.length,
      unitCount: scopedUnits.length,
      tenantCount: scopedTenants.length,
      openTickets,
      criticalTickets,
      monthlyInvoiced,
      monthlyCollected,
      collectionRate: Math.round(collectionRate * 10) / 10,
      currency: currencyForJurisdiction(jurisdictionCode),
      asOf: new Date().toISOString(),
      flags,
      jurisdictionCode,
    };
  } catch {
    return defaults;
  }
}

function currencyForJurisdiction(code: string): string {
  switch (code.toUpperCase()) {
    case 'KE':
      return 'KES';
    case 'TZ':
      return 'TZS';
    case 'UG':
      return 'UGX';
    case 'RW':
      return 'RWF';
    case 'GB':
      return 'GBP';
    case 'DE':
      return 'EUR';
    default:
      return 'USD';
  }
}

// ---------------------------------------------------------------------------
// Jurisdiction resolution
// ---------------------------------------------------------------------------
async function resolveJurisdictionCode(
  repos: any,
  auth: { tenantId: string },
  headerOverride?: string
): Promise<string> {
  if (headerOverride) return headerOverride.toUpperCase();
  if (!repos?.tenants) return 'KE';
  try {
    const tenant = await repos.tenants.findById(auth.tenantId);
    return (tenant?.country as string | undefined)?.toUpperCase() ?? 'KE';
  } catch {
    return 'KE';
  }
}

// ---------------------------------------------------------------------------
// System prompt builders
// ---------------------------------------------------------------------------
function buildChatSystemPrompt(policy: JurisdictionPolicy, ctx: PortfolioContext): string {
  return [
    `You are the BOSSNYUMBA AI Copilot for a property manager operating in ${policy.displayName}.`,
    `Respond in ${policy.language === 'sw' ? 'Swahili (or English if the user writes in English)' : policy.language}.`,
    `Jurisdiction: ${policy.code}. Tax rules: ${policy.taxNote}`,
    ``,
    `PORTFOLIO SNAPSHOT (as of ${ctx.asOf}):`,
    `- Properties: ${ctx.propertyCount}`,
    `- Units: ${ctx.unitCount}`,
    `- Active tenants: ${ctx.tenantCount}`,
    `- This-month invoiced: ${ctx.currency} ${ctx.monthlyInvoiced.toLocaleString()}`,
    `- This-month collected: ${ctx.currency} ${ctx.monthlyCollected.toLocaleString()}`,
    `- Collection rate: ${ctx.collectionRate}%`,
    `- Open tickets: ${ctx.openTickets} (${ctx.criticalTickets} critical)`,
    ctx.flags.length ? `- Critical flags: ${ctx.flags.join(', ')}` : '- Critical flags: none',
    ``,
    `Rules:`,
    `- Ground every answer in the snapshot above. If data is missing, say so.`,
    `- For tax / legal questions use the jurisdiction's rules (${policy.code}). Do NOT invent rates.`,
    `- Keep answers concise and actionable. Prefer bullet points.`,
    `- Never expose raw tenant PII you were not asked about.`,
  ].join('\n');
}

function buildBriefingSystemPrompt(policy: JurisdictionPolicy, ctx: PortfolioContext): string {
  return [
    `You are the BOSSNYUMBA AI Briefing generator for a property manager in ${policy.displayName}.`,
    `Produce today's daily briefing in ${policy.language}.`,
    `Jurisdiction tax context: ${policy.taxNote}`,
    ``,
    `PORTFOLIO SNAPSHOT (${ctx.asOf}):`,
    `- Properties: ${ctx.propertyCount}, Units: ${ctx.unitCount}, Tenants: ${ctx.tenantCount}`,
    `- Invoiced MTD: ${ctx.currency} ${ctx.monthlyInvoiced.toLocaleString()}`,
    `- Collected MTD: ${ctx.currency} ${ctx.monthlyCollected.toLocaleString()}`,
    `- Collection rate: ${ctx.collectionRate}%`,
    `- Open tickets: ${ctx.openTickets} (${ctx.criticalTickets} critical)`,
    `- Flags: ${ctx.flags.join(', ') || 'none'}`,
    ``,
    `Output STRICT JSON matching this schema and nothing else:`,
    `{`,
    `  "headline": string,`,
    `  "sections": {`,
    `    "money":       { "summary": string, "items": string[] },`,
    `    "occupancy":   { "summary": string, "items": string[] },`,
    `    "pending":     { "summary": string, "items": string[] },`,
    `    "maintenance": { "summary": string, "items": string[] },`,
    `    "tax":         { "summary": string, "items": string[] },`,
    `    "risk":        { "summary": string, "items": string[] }`,
    `  }`,
    `}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Interaction logging
// ---------------------------------------------------------------------------
interface InteractionLog {
  tenantId: string;
  activeOrgId?: string | null;
  userId: string;
  endpoint: string;
  jurisdiction: string;
  provider: string;
  model: string;
  degraded: boolean;
  prompt: string;
  response: string;
  systemPrompt: string;
  conversation?: ChatMessage[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string | null;
}

async function logInteraction(db: any, log: InteractionLog): Promise<void> {
  if (!db) return;
  try {
    await db.execute(sql`
      INSERT INTO ai_interactions (
        tenant_id, active_org_id, user_id, endpoint, jurisdiction,
        provider, model, degraded, prompt, response, system_prompt,
        conversation, prompt_tokens, completion_tokens, total_tokens,
        latency_ms, status, error_message
      ) VALUES (
        ${log.tenantId}, ${log.activeOrgId ?? null}, ${log.userId}, ${log.endpoint},
        ${log.jurisdiction}, ${log.provider}, ${log.model}, ${log.degraded},
        ${log.prompt}, ${log.response}, ${log.systemPrompt},
        ${JSON.stringify(log.conversation ?? [])}::jsonb,
        ${log.promptTokens}, ${log.completionTokens}, ${log.totalTokens},
        ${log.latencyMs}, ${log.status}, ${log.errorMessage ?? null}
      )
    `);
  } catch {
    // Never let logging break the user response.
  }
}

// ---------------------------------------------------------------------------
// POST /ai/copilot/chat
// ---------------------------------------------------------------------------
aiRouter.post('/copilot/chat', zValidator('json', chatSchema), async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');
  const body = c.req.valid('json');

  const activeOrgId = c.req.header('x-active-org-id') ?? null;
  const jurisdictionCode = await resolveJurisdictionCode(
    repos,
    auth,
    c.req.header('x-jurisdiction') ?? undefined
  );

  const { provider, policy, degraded, reason } = resolveChatProvider({
    jurisdiction: jurisdictionCode,
    requested: body.provider,
  });

  const ctx = await fetchPortfolioContext(repos, auth, policy.code, db);
  const systemPrompt = buildChatSystemPrompt(policy, ctx);

  const messages: ChatMessage[] = [
    ...body.conversation.filter((m) => m.role !== 'system'),
    { role: 'user', content: body.message },
  ];

  const wantsStream = acceptsSse(c.req.header('accept'));
  const started = Date.now();

  if (wantsStream) {
    return streamSSE(c, async (stream) => {
      let full = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let status: 'success' | 'error' = 'success';
      let errMsg: string | undefined;
      try {
        await stream.writeSSE({
          event: 'meta',
          data: JSON.stringify({
            provider: provider.providerId,
            model: provider.defaultModel,
            degraded,
            reason,
            jurisdiction: policy.code,
          }),
        });
        for await (const chunk of provider.stream({
          system: systemPrompt,
          messages,
          temperature: body.temperature,
          maxTokens: body.maxTokens,
        })) {
          if (chunk.delta) {
            full += chunk.delta;
            await stream.writeSSE({ event: 'delta', data: JSON.stringify({ delta: chunk.delta }) });
          }
          if (chunk.done) {
            if (chunk.usage) usage = chunk.usage;
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify({ usage: chunk.usage, finishReason: chunk.finishReason }),
            });
          }
        }
      } catch (err) {
        status = 'error';
        errMsg = err instanceof Error ? err.message : String(err);
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ message: errMsg }) });
      } finally {
        await logInteraction(db, {
          tenantId: auth.tenantId,
          activeOrgId,
          userId: auth.userId,
          endpoint: 'copilot.chat',
          jurisdiction: policy.code,
          provider: provider.providerId,
          model: provider.defaultModel,
          degraded,
          prompt: body.message,
          response: full,
          systemPrompt,
          conversation: messages,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          latencyMs: Date.now() - started,
          status,
          errorMessage: errMsg,
        });
      }
    });
  }

  // Non-streaming JSON response
  try {
    const result = await provider.complete({
      system: systemPrompt,
      messages,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });
    await logInteraction(db, {
      tenantId: auth.tenantId,
      activeOrgId,
      userId: auth.userId,
      endpoint: 'copilot.chat',
      jurisdiction: policy.code,
      provider: result.provider,
      model: result.model,
      degraded,
      prompt: body.message,
      response: result.content,
      systemPrompt,
      conversation: messages,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      latencyMs: Date.now() - started,
      status: 'success',
    });
    return c.json({
      success: true,
      data: {
        message: result.content,
        provider: result.provider,
        model: result.model,
        degraded,
        reason: degraded ? reason : undefined,
        jurisdiction: policy.code,
        portfolioContext: ctx,
        usage: result.usage,
        latencyMs: Date.now() - started,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logInteraction(db, {
      tenantId: auth.tenantId,
      activeOrgId,
      userId: auth.userId,
      endpoint: 'copilot.chat',
      jurisdiction: policy.code,
      provider: provider.providerId,
      model: provider.defaultModel,
      degraded,
      prompt: body.message,
      response: '',
      systemPrompt,
      conversation: messages,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: Date.now() - started,
      status: 'error',
      errorMessage: message,
    });
    return c.json(
      { success: false, error: { code: 'AI_ERROR', message } },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /ai/briefing
// ---------------------------------------------------------------------------
aiRouter.post('/briefing', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = briefingSchema.safeParse(rawBody);
  const body = parsed.success ? parsed.data : {};

  const activeOrgId = c.req.header('x-active-org-id') ?? null;
  const jurisdictionCode = await resolveJurisdictionCode(
    repos,
    auth,
    c.req.header('x-jurisdiction') ?? undefined
  );

  const { provider, policy, degraded, reason } = resolveChatProvider({
    jurisdiction: jurisdictionCode,
  });

  const ctx = await fetchPortfolioContext(repos, auth, policy.code, db);
  const systemPrompt = buildBriefingSystemPrompt(
    { ...policy, language: body?.locale ?? policy.language },
    ctx
  );

  const started = Date.now();
  const userMsg = `Generate today's briefing for ${body?.date ?? new Date().toISOString().slice(0, 10)}.`;

  try {
    const result = await provider.complete({
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
      temperature: 0.2,
      maxTokens: 1400,
      jsonMode: true,
    });

    const briefing = parseBriefing(result.content, ctx, policy, degraded);

    await logInteraction(db, {
      tenantId: auth.tenantId,
      activeOrgId,
      userId: auth.userId,
      endpoint: 'briefing',
      jurisdiction: policy.code,
      provider: result.provider,
      model: result.model,
      degraded,
      prompt: userMsg,
      response: result.content,
      systemPrompt,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      latencyMs: Date.now() - started,
      status: 'success',
    });

    return c.json({
      success: true,
      data: {
        date: body?.date ?? new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        jurisdiction: policy.code,
        language: body?.locale ?? policy.language,
        provider: result.provider,
        model: result.model,
        degraded,
        reason: degraded ? reason : undefined,
        portfolioContext: ctx,
        briefing,
        usage: result.usage,
        latencyMs: Date.now() - started,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logInteraction(db, {
      tenantId: auth.tenantId,
      activeOrgId,
      userId: auth.userId,
      endpoint: 'briefing',
      jurisdiction: policy.code,
      provider: provider.providerId,
      model: provider.defaultModel,
      degraded,
      prompt: userMsg,
      response: '',
      systemPrompt,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: Date.now() - started,
      status: 'error',
      errorMessage: message,
    });
    return c.json(
      { success: false, error: { code: 'AI_ERROR', message } },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function acceptsSse(accept?: string | null): boolean {
  if (!accept) return false;
  return accept.toLowerCase().includes('text/event-stream');
}

interface BriefingSection {
  summary: string;
  items: string[];
}
interface Briefing {
  headline: string;
  sections: {
    money: BriefingSection;
    occupancy: BriefingSection;
    pending: BriefingSection;
    maintenance: BriefingSection;
    tax: BriefingSection;
    risk: BriefingSection;
  };
}

function parseBriefing(
  raw: string,
  ctx: PortfolioContext,
  policy: JurisdictionPolicy,
  degraded: boolean
): Briefing {
  const fallback: Briefing = {
    headline: degraded
      ? 'AI briefing unavailable \u2014 configure ANTHROPIC_API_KEY.'
      : `Daily briefing for ${policy.displayName}`,
    sections: {
      money: {
        summary: `${ctx.currency} ${ctx.monthlyCollected.toLocaleString()} collected this month (${ctx.collectionRate}% of invoiced).`,
        items: [],
      },
      occupancy: {
        summary: `${ctx.unitCount} units across ${ctx.propertyCount} properties, ${ctx.tenantCount} active tenants.`,
        items: [],
      },
      pending: { summary: 'No pending-items summary available.', items: [] },
      maintenance: {
        summary: `${ctx.openTickets} open tickets (${ctx.criticalTickets} critical).`,
        items: [],
      },
      tax: { summary: policy.taxNote, items: [] },
      risk: {
        summary: ctx.flags.length ? `Flags: ${ctx.flags.join(', ')}.` : 'No critical risk flags.',
        items: ctx.flags,
      },
    },
  };

  if (!raw || degraded) return fallback;

  try {
    // Strip accidental markdown fences.
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned) as Partial<Briefing>;
    const sections = parsed.sections ?? ({} as any);
    const ensure = (s: any): BriefingSection => ({
      summary: typeof s?.summary === 'string' ? s.summary : '',
      items: Array.isArray(s?.items) ? s.items.filter((i: unknown) => typeof i === 'string') : [],
    });
    return {
      headline: typeof parsed.headline === 'string' ? parsed.headline : fallback.headline,
      sections: {
        money: ensure(sections.money),
        occupancy: ensure(sections.occupancy),
        pending: ensure(sections.pending),
        maintenance: ensure(sections.maintenance),
        tax: ensure(sections.tax ?? { summary: policy.taxNote, items: [] }),
        risk: ensure(sections.risk),
      },
    };
  } catch {
    return fallback;
  }
}
