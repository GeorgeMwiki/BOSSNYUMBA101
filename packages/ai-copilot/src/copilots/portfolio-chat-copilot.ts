/**
 * Portfolio Chat Copilot
 *
 * The conversational copilot backing the owner AI tab. Enriches the user
 * prompt with portfolio context (arrears, occupancy, property names) and
 * delegates to an LLM provider chosen by the LLMProviderGate.
 *
 * Exposes both `chat()` (non-streaming, returns full text) and `chatStream()`
 * (async iterator of text deltas) so the gateway can SSE-stream or JSON-fall-back.
 */

import type { AIProvider, AICompletionRequest } from '../providers/ai-provider.js';
import { AnthropicProvider } from '../providers/anthropic-provider.js';
import type { LLMProviderGate } from '../providers/llm-provider-gate.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TenantArrearsSnapshot {
  tenantName: string;
  unitLabel: string;
  amountOutstanding: number;
  daysOverdue: number;
  currency: string;
}

export interface PropertySnapshot {
  name: string;
  totalUnits: number;
  occupiedUnits: number;
}

export interface PortfolioContext {
  orgId: string;
  jurisdiction: string;
  reportingMonth?: string; // e.g. '2026-04'
  properties: PropertySnapshot[];
  arrears: TenantArrearsSnapshot[];
  occupancyRate: number; // 0..1
  totalTenants: number;
}

export interface PortfolioChatRequest {
  history: ChatMessage[];
  prompt: string;
  activeOrgId: string;
  jurisdiction: string;
  portfolio: PortfolioContext;
}

export interface PortfolioChatResponse {
  content: string;
  providerId: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
}

const SYSTEM_PROMPT = [
  'You are the BOSSNYUMBA AI copilot for property owners.',
  'You help owners understand their portfolio: arrears, occupancy, maintenance, renewals.',
  'Always be concise, numeric where useful, and reference tenants or properties by name.',
  'If the data below is insufficient to answer, say so explicitly rather than guessing.',
  'Never disclose tenant PII beyond what the owner already has access to for this org.',
].join(' ');

function formatPortfolioContext(ctx: PortfolioContext): string {
  const lines: string[] = [];
  lines.push(`# Portfolio snapshot for org ${ctx.orgId}`);
  if (ctx.reportingMonth) lines.push(`Reporting month: ${ctx.reportingMonth}`);
  lines.push(`Jurisdiction: ${ctx.jurisdiction}`);
  lines.push(`Total tenants: ${ctx.totalTenants}`);
  lines.push(`Occupancy rate: ${(ctx.occupancyRate * 100).toFixed(1)}%`);

  if (ctx.properties.length) {
    lines.push('\n## Properties');
    for (const p of ctx.properties) {
      lines.push(`- ${p.name}: ${p.occupiedUnits}/${p.totalUnits} units occupied`);
    }
  }

  if (ctx.arrears.length) {
    lines.push('\n## Tenants in arrears');
    for (const a of ctx.arrears) {
      lines.push(
        `- ${a.tenantName} (${a.unitLabel}): ${a.currency} ${a.amountOutstanding.toLocaleString()} overdue ${a.daysOverdue} days`
      );
    }
  } else {
    lines.push('\n## Tenants in arrears\nNone. All tenants current.');
  }

  return lines.join('\n');
}

function buildUserPrompt(req: PortfolioChatRequest): string {
  const historyBlock = req.history
    .slice(-10) // cap
    .map((m) => `${m.role === 'user' ? 'Owner' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const contextBlock = formatPortfolioContext(req.portfolio);
  return [
    contextBlock,
    '',
    historyBlock ? `# Conversation so far\n${historyBlock}` : '',
    '',
    `# Current question\nOwner: ${req.prompt}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildCompletionRequest(req: PortfolioChatRequest): AICompletionRequest {
  return {
    prompt: {
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(req),
      modelConfig: {
        modelId: 'claude-3-5-sonnet-20241022',
        temperature: 0.3,
        maxTokens: 1024,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

/**
 * Generate context-aware suggested prompts based on portfolio state.
 * Deterministic (no LLM call) so the UI can show them instantly.
 */
export function suggestedPrompts(ctx: PortfolioContext): string[] {
  const out: string[] = [];
  if (ctx.arrears.length > 0) {
    out.push("Who's behind on rent?");
    out.push('Draft a reminder to tenants in arrears');
  }
  if (ctx.occupancyRate < 0.9) {
    out.push('Which units are vacant and why?');
  }
  if (ctx.properties.length > 1) {
    out.push('Which property performs best this month?');
  }
  out.push('Summarize this month so far');
  out.push('What should I prioritize today?');
  return out.slice(0, 5);
}

export class PortfolioChatCopilot {
  constructor(private gate: LLMProviderGate) {}

  async chat(req: PortfolioChatRequest): Promise<PortfolioChatResponse> {
    const decision = this.gate.pick(req.jurisdiction);
    if (decision.ok !== true) {
      throw new Error(decision.error.message);
    }
    const provider: AIProvider = decision.decision.provider;
    const completion = buildCompletionRequest(req);
    const result = await provider.complete(completion);
    if (result.success !== true) {
      throw new Error(
        `AI provider error (${decision.decision.providerId}): ${result.error.message}`
      );
    }
    return {
      content: result.data.content,
      providerId: decision.decision.providerId,
      modelId: String(result.data.modelId),
      promptTokens: result.data.usage.promptTokens,
      completionTokens: result.data.usage.completionTokens,
    };
  }

  /**
   * Stream text deltas. Uses Anthropic native streaming when selected;
   * otherwise falls back to a single chunk emitted from `complete`.
   */
  async *chatStream(
    req: PortfolioChatRequest
  ): AsyncGenerator<{ delta: string; done: boolean; providerId?: string }, void, void> {
    const decision = this.gate.pick(req.jurisdiction);
    if (decision.ok !== true) {
      throw new Error(decision.error.message);
    }
    const provider = decision.decision.provider;
    const completion = buildCompletionRequest(req);

    if (provider instanceof AnthropicProvider) {
      yield { delta: '', done: false, providerId: decision.decision.providerId };
      for await (const chunk of provider.stream(completion)) {
        yield { ...chunk, providerId: decision.decision.providerId };
      }
      return;
    }

    // Fallback: single-shot completion, emitted as one chunk.
    const result = await provider.complete(completion);
    if (result.success !== true) {
      throw new Error(
        `AI provider error (${decision.decision.providerId}): ${result.error.message}`
      );
    }
    yield {
      delta: result.data.content,
      done: false,
      providerId: decision.decision.providerId,
    };
    yield { delta: '', done: true, providerId: decision.decision.providerId };
  }
}

export function createPortfolioChatCopilot(gate: LLMProviderGate): PortfolioChatCopilot {
  return new PortfolioChatCopilot(gate);
}
