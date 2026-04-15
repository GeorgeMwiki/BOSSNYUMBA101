/**
 * LLM Provider Gate
 *
 * Central routing layer that:
 *  - enforces jurisdiction-specific restrictions (e.g. data-residency
 *    rules that forbid routing tenant data to DeepSeek);
 *  - picks the best available provider based on env-configured API keys;
 *  - falls back to a `MockChatProvider` when no real provider is
 *    configured so the /ai/* endpoints never 500.
 *
 * The gate is intentionally small and dependency-free: downstream services
 * import a single `resolveChatProvider({ jurisdiction, requested })` and
 * receive a ready-to-use `ChatProvider`.
 */

import {
  AnthropicChatProvider,
  ChatProvider,
  DeepSeekChatProvider,
  MockChatProvider,
  OpenAIChatProvider,
} from './chat-provider.js';

export type ProviderId = 'anthropic' | 'openai' | 'deepseek' | 'mock';

export interface JurisdictionPolicy {
  /** Jurisdiction code (ISO-2 or registry key, e.g. "KE", "TZ", "UG"). */
  code: string;
  /** Providers explicitly blocked for this jurisdiction. */
  blockedProviders: ProviderId[];
  /** Preferred ordering when multiple providers are permitted. */
  preferredOrder: ProviderId[];
  /** Primary language (BCP-47 short). */
  language: string;
  /** Display name (for prompts). */
  displayName: string;
  /** Applicable VAT/tax note the LLM should use when asked about tax. */
  taxNote: string;
}

/**
 * Jurisdiction registry. Extend as more countries onboard.
 *
 * Policy rationale:
 *  - Kenya: no blocks; Swahili-friendly Anthropic preferred.
 *  - Tanzania: no blocks; Anthropic preferred.
 *  - Uganda: no blocks.
 *  - EU jurisdictions: DeepSeek blocked (non-EU data residency concerns).
 *  - Default: conservative - block DeepSeek unless explicitly permitted.
 */
export const JURISDICTION_POLICIES: Record<string, JurisdictionPolicy> = {
  KE: {
    code: 'KE',
    blockedProviders: [],
    preferredOrder: ['anthropic', 'openai', 'deepseek'],
    language: 'en',
    displayName: 'Kenya',
    taxNote: 'VAT in Kenya is 16%. Rental income above KES 288,000/year is taxable; Monthly Rental Income tax is 7.5% (gross).',
  },
  TZ: {
    code: 'TZ',
    blockedProviders: [],
    preferredOrder: ['anthropic', 'openai', 'deepseek'],
    language: 'sw',
    displayName: 'Tanzania',
    taxNote: 'VAT in Tanzania is 18%. Rental income withholding tax is 10% for residents.',
  },
  UG: {
    code: 'UG',
    blockedProviders: [],
    preferredOrder: ['anthropic', 'openai', 'deepseek'],
    language: 'en',
    displayName: 'Uganda',
    taxNote: 'VAT in Uganda is 18%. Rental income tax for individuals is 12% of gross above UGX 2,820,000.',
  },
  RW: {
    code: 'RW',
    blockedProviders: [],
    preferredOrder: ['anthropic', 'openai', 'deepseek'],
    language: 'en',
    displayName: 'Rwanda',
    taxNote: 'VAT in Rwanda is 18%. Rental income tax is tiered (0%/20%/30%).',
  },
  // EU / data-residency-sensitive jurisdictions block DeepSeek.
  GB: {
    code: 'GB',
    blockedProviders: ['deepseek'],
    preferredOrder: ['anthropic', 'openai'],
    language: 'en',
    displayName: 'United Kingdom',
    taxNote: 'VAT in the UK is 20%. Rental income above the personal allowance is taxed at marginal rates.',
  },
  DE: {
    code: 'DE',
    blockedProviders: ['deepseek'],
    preferredOrder: ['anthropic', 'openai'],
    language: 'de',
    displayName: 'Germany',
    taxNote: 'VAT (USt.) in Germany is 19%. Rental income is taxed at the owner\u2019s progressive rate.',
  },
};

export const DEFAULT_JURISDICTION = JURISDICTION_POLICIES.KE;

/** Lookup a policy, falling back to the default. */
export function getJurisdictionPolicy(code?: string | null): JurisdictionPolicy {
  if (!code) return DEFAULT_JURISDICTION;
  const upper = code.toUpperCase();
  return JURISDICTION_POLICIES[upper] ?? {
    ...DEFAULT_JURISDICTION,
    code: upper,
    displayName: upper,
    // Conservative default: block DeepSeek for unknown jurisdictions.
    blockedProviders: ['deepseek'],
    preferredOrder: ['anthropic', 'openai'],
  };
}

export interface LLMGateEnv {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  AI_PROVIDER?: 'anthropic' | 'openai' | 'deepseek';
  ANTHROPIC_MODEL?: string;
  OPENAI_MODEL?: string;
  DEEPSEEK_MODEL?: string;
}

export interface ResolveOptions {
  /** Jurisdiction code; resolves to policy. */
  jurisdiction?: string | null;
  /** Caller-requested provider (overrides env default, still subject to gate). */
  requested?: ProviderId;
  /** Env object (defaults to process.env). */
  env?: LLMGateEnv;
}

export interface ResolvedProvider {
  provider: ChatProvider;
  policy: JurisdictionPolicy;
  /** True when the gate fell back to the mock provider. */
  degraded: boolean;
  /** Human-readable reason when degraded. */
  reason?: string;
}

/**
 * Resolve a chat provider for the given jurisdiction.
 * Never throws: always returns a working provider (mock as last resort).
 */
export function resolveChatProvider(opts: ResolveOptions = {}): ResolvedProvider {
  const env = opts.env ?? (process.env as LLMGateEnv);
  const policy = getJurisdictionPolicy(opts.jurisdiction);

  // Determine the desired order:
  //  1. Explicit requested provider (if not blocked);
  //  2. AI_PROVIDER env (if not blocked);
  //  3. Policy's preferredOrder.
  const blocked = new Set<ProviderId>(policy.blockedProviders);
  const order: ProviderId[] = [];
  if (opts.requested && !blocked.has(opts.requested)) order.push(opts.requested);
  if (env.AI_PROVIDER && !blocked.has(env.AI_PROVIDER)) order.push(env.AI_PROVIDER);
  for (const p of policy.preferredOrder) {
    if (!blocked.has(p) && !order.includes(p)) order.push(p);
  }

  for (const id of order) {
    const provider = tryBuildProvider(id, env);
    if (provider) {
      return { provider, policy, degraded: false };
    }
  }

  // No real provider available - degrade gracefully.
  const reason = env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY
    ? `No permitted provider available for jurisdiction ${policy.code}`
    : 'AI disabled \u2014 set ANTHROPIC_API_KEY';
  return {
    provider: new MockChatProvider(reason),
    policy,
    degraded: true,
    reason,
  };
}

function tryBuildProvider(id: ProviderId, env: LLMGateEnv): ChatProvider | null {
  switch (id) {
    case 'anthropic':
      return env.ANTHROPIC_API_KEY
        ? new AnthropicChatProvider({ apiKey: env.ANTHROPIC_API_KEY, defaultModel: env.ANTHROPIC_MODEL })
        : null;
    case 'openai':
      return env.OPENAI_API_KEY
        ? new OpenAIChatProvider({ apiKey: env.OPENAI_API_KEY, defaultModel: env.OPENAI_MODEL })
        : null;
    case 'deepseek':
      return env.DEEPSEEK_API_KEY
        ? new DeepSeekChatProvider({ apiKey: env.DEEPSEEK_API_KEY, defaultModel: env.DEEPSEEK_MODEL })
        : null;
    case 'mock':
      return new MockChatProvider();
    default:
      return null;
  }
}
