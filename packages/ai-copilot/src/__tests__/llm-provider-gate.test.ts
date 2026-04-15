import { describe, it, expect } from 'vitest';
import {
  resolveChatProvider,
  getJurisdictionPolicy,
  MockChatProvider,
} from '../providers/index.js';

describe('llm-provider-gate', () => {
  it('falls back to MockChatProvider when no keys are set', () => {
    const { provider, degraded, reason } = resolveChatProvider({
      jurisdiction: 'KE',
      env: {},
    });
    expect(provider).toBeInstanceOf(MockChatProvider);
    expect(degraded).toBe(true);
    expect(reason).toContain('AI disabled');
  });

  it('prefers Anthropic when ANTHROPIC_API_KEY is present', () => {
    const { provider, degraded } = resolveChatProvider({
      jurisdiction: 'KE',
      env: { ANTHROPIC_API_KEY: 'sk-test-anthropic-123' },
    });
    expect(provider.providerId).toBe('anthropic');
    expect(degraded).toBe(false);
  });

  it('blocks DeepSeek for GB jurisdiction even if requested', () => {
    const { provider, policy } = resolveChatProvider({
      jurisdiction: 'GB',
      requested: 'deepseek',
      env: {
        DEEPSEEK_API_KEY: 'sk-ds',
        ANTHROPIC_API_KEY: 'sk-anth',
      },
    });
    expect(policy.blockedProviders).toContain('deepseek');
    expect(provider.providerId).toBe('anthropic');
  });

  it('falls back to mock when only DeepSeek is available in a blocking jurisdiction', () => {
    const { provider, degraded, reason } = resolveChatProvider({
      jurisdiction: 'GB',
      env: { DEEPSEEK_API_KEY: 'sk-ds' },
    });
    expect(provider).toBeInstanceOf(MockChatProvider);
    expect(degraded).toBe(true);
    expect(reason).toContain('No permitted provider');
  });

  it('resolves unknown jurisdiction to conservative default', () => {
    const policy = getJurisdictionPolicy('ZZ');
    expect(policy.blockedProviders).toContain('deepseek');
  });
});
