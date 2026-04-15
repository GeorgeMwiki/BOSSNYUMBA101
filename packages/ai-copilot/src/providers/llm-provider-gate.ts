/**
 * LLM Provider Gate
 *
 * Picks an allowed LLM provider for a given jurisdiction. Enforces the
 * jurisdiction policy (e.g., DeepSeek blocked for TZ/KE tenant data) and
 * returns the highest-preference provider that:
 *   1. Is not in the blocked list for the jurisdiction
 *   2. Is in the allowed list
 *   3. Has been registered with credentials
 *
 * Returns a structured decision so callers can log which provider was chosen
 * and why.
 */

import type { AIProvider } from './ai-provider.js';
import type { AnthropicProvider } from './anthropic-provider.js';
import {
  getJurisdictionPolicy,
  type Jurisdiction,
  type JurisdictionPolicy,
  type ProviderId,
} from './jurisdiction-config.js';

export interface LLMProviderGateConfig {
  anthropic?: AnthropicProvider;
  openai?: AIProvider;
  deepseek?: AIProvider;
  mock?: AIProvider;
}

export interface ProviderDecision {
  provider: AIProvider;
  providerId: ProviderId;
  jurisdiction: Jurisdiction;
  policy: JurisdictionPolicy;
  reason: string;
}

export interface ProviderGateError {
  code: 'NO_ALLOWED_PROVIDER' | 'ALL_BLOCKED';
  message: string;
  jurisdiction: Jurisdiction;
  attempted: ProviderId[];
}

export class LLMProviderGate {
  private providers: LLMProviderGateConfig;

  constructor(providers: LLMProviderGateConfig) {
    this.providers = providers;
  }

  /**
   * Pick a provider for the given jurisdiction.
   * Returns `{ ok: true, decision }` or `{ ok: false, error }`.
   */
  pick(
    jurisdictionInput: Jurisdiction | string | undefined
  ):
    | { ok: true; decision: ProviderDecision }
    | { ok: false; error: ProviderGateError } {
    const policy = getJurisdictionPolicy(jurisdictionInput);
    const attempted: ProviderId[] = [];

    for (const candidateId of policy.allowedProviders) {
      if (policy.blockedProviders.includes(candidateId)) {
        attempted.push(candidateId);
        continue;
      }
      const candidate = this.resolve(candidateId);
      attempted.push(candidateId);
      if (candidate) {
        return {
          ok: true,
          decision: {
            provider: candidate,
            providerId: candidateId,
            jurisdiction: policy.jurisdiction,
            policy,
            reason: `Selected ${candidateId} for ${policy.jurisdiction}: ${policy.rationale}`,
          },
        };
      }
    }

    // Last-resort mock (only if explicitly registered) — useful for dev/CI.
    if (this.providers.mock) {
      return {
        ok: true,
        decision: {
          provider: this.providers.mock,
          providerId: 'mock',
          jurisdiction: policy.jurisdiction,
          policy,
          reason: `Fell back to mock provider (no live keys) for ${policy.jurisdiction}.`,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'NO_ALLOWED_PROVIDER',
        message: `No LLM provider available for jurisdiction ${policy.jurisdiction}. Allowed: [${policy.allowedProviders.join(', ')}], blocked: [${policy.blockedProviders.join(', ')}].`,
        jurisdiction: policy.jurisdiction,
        attempted,
      },
    };
  }

  private resolve(id: ProviderId): AIProvider | undefined {
    switch (id) {
      case 'anthropic':
        return this.providers.anthropic;
      case 'openai':
        return this.providers.openai;
      case 'deepseek':
        return this.providers.deepseek;
      case 'mock':
        return this.providers.mock;
      default:
        return undefined;
    }
  }

  /** True if the given provider id is allowed (not blocked) for the jurisdiction. */
  isAllowed(id: ProviderId, jurisdictionInput: Jurisdiction | string | undefined): boolean {
    const policy = getJurisdictionPolicy(jurisdictionInput);
    return policy.allowedProviders.includes(id) && !policy.blockedProviders.includes(id);
  }
}

export function createLLMProviderGate(config: LLMProviderGateConfig): LLMProviderGate {
  return new LLMProviderGate(config);
}
