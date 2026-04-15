import { describe, it, expect } from 'vitest';
import { createLLMProviderGate } from '../providers/llm-provider-gate.js';
import { MockAIProvider } from '../providers/ai-provider.js';
import { suggestedPrompts, type PortfolioContext } from '../copilots/portfolio-chat-copilot.js';

function mockProvider(id: string) {
  const p = new MockAIProvider();
  (p as unknown as { providerId: string }).providerId = id;
  return p;
}

describe('LLMProviderGate', () => {
  it('blocks DeepSeek for TZ tenants and falls through to Anthropic', () => {
    const anthropic = mockProvider('anthropic') as unknown as ReturnType<
      typeof mockProvider
    >;
    const deepseek = mockProvider('deepseek');
    const gate = createLLMProviderGate({
      // We cast through unknown because the gate expects AnthropicProvider
      // specifically, but for this test we only verify selection logic.
      anthropic: anthropic as unknown as never,
      deepseek,
    });
    const result = gate.pick('TZ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.providerId).toBe('anthropic');
      expect(result.decision.jurisdiction).toBe('TZ');
    }
  });

  it('blocks DeepSeek for KE tenants', () => {
    const gate = createLLMProviderGate({});
    expect(gate.isAllowed('deepseek', 'KE')).toBe(false);
    expect(gate.isAllowed('anthropic', 'KE')).toBe(true);
  });

  it('allows DeepSeek for GLOBAL jurisdiction', () => {
    const gate = createLLMProviderGate({});
    expect(gate.isAllowed('deepseek', 'GLOBAL')).toBe(true);
  });

  it('returns error when no allowed provider is registered', () => {
    const gate = createLLMProviderGate({});
    const result = gate.pick('KE');
    expect(result.ok).toBe(false);
    if (result.ok !== true) {
      expect(result.error.code).toBe('NO_ALLOWED_PROVIDER');
    }
  });
});

describe('suggestedPrompts', () => {
  const base: PortfolioContext = {
    orgId: 'o1',
    jurisdiction: 'KE',
    properties: [],
    arrears: [],
    occupancyRate: 1,
    totalTenants: 0,
  };

  it('includes arrears prompt when any tenant is behind', () => {
    const ctx: PortfolioContext = {
      ...base,
      arrears: [
        {
          tenantName: 'Alice',
          unitLabel: 'A1',
          amountOutstanding: 50_000,
          daysOverdue: 10,
          currency: 'KES',
        },
      ],
    };
    const prompts = suggestedPrompts(ctx);
    expect(prompts).toContain("Who's behind on rent?");
  });

  it('omits arrears prompt when all tenants are current', () => {
    const prompts = suggestedPrompts(base);
    expect(prompts).not.toContain("Who's behind on rent?");
  });
});
