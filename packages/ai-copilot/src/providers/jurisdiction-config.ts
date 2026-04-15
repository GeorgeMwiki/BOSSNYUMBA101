/**
 * Jurisdiction Configuration
 *
 * Defines which LLM providers are allowed to process user data for a given
 * jurisdiction. Used by the LLM Provider Gate to block non-compliant providers
 * (e.g., DeepSeek is blocked for TZ/KE tenant personal data per internal policy).
 */

export type Jurisdiction = 'TZ' | 'KE' | 'UG' | 'RW' | 'GLOBAL';
export type ProviderId = 'anthropic' | 'openai' | 'deepseek' | 'mock';

export interface JurisdictionPolicy {
  jurisdiction: Jurisdiction;
  /** Providers allowed to process user data for this jurisdiction, ranked by preference. */
  allowedProviders: ProviderId[];
  /** Explicitly blocked providers (hard block, overrides allow list). */
  blockedProviders: ProviderId[];
  /** Human-readable rationale (used in audit logs & error responses). */
  rationale: string;
}

/**
 * Default jurisdiction policy table.
 *
 * Policy: DeepSeek is blocked for TZ and KE because its data-processing terms
 * do not currently satisfy our East Africa data-residency commitments.
 * Anthropic Claude is the preferred provider everywhere, with OpenAI as fallback.
 */
export const DEFAULT_JURISDICTION_POLICIES: Record<Jurisdiction, JurisdictionPolicy> = {
  TZ: {
    jurisdiction: 'TZ',
    allowedProviders: ['anthropic', 'openai'],
    blockedProviders: ['deepseek'],
    rationale: 'TZ personal data policy: DeepSeek disallowed; Anthropic preferred.',
  },
  KE: {
    jurisdiction: 'KE',
    allowedProviders: ['anthropic', 'openai'],
    blockedProviders: ['deepseek'],
    rationale: 'KE DPA compliance: DeepSeek disallowed; Anthropic preferred.',
  },
  UG: {
    jurisdiction: 'UG',
    allowedProviders: ['anthropic', 'openai'],
    blockedProviders: ['deepseek'],
    rationale: 'UG data policy: DeepSeek disallowed; Anthropic preferred.',
  },
  RW: {
    jurisdiction: 'RW',
    allowedProviders: ['anthropic', 'openai'],
    blockedProviders: ['deepseek'],
    rationale: 'RW data policy: DeepSeek disallowed; Anthropic preferred.',
  },
  GLOBAL: {
    jurisdiction: 'GLOBAL',
    allowedProviders: ['anthropic', 'openai', 'deepseek'],
    blockedProviders: [],
    rationale: 'No regional restriction; Anthropic preferred.',
  },
};

export function getJurisdictionPolicy(j: Jurisdiction | string | undefined): JurisdictionPolicy {
  const key = (j ?? 'GLOBAL').toUpperCase() as Jurisdiction;
  return DEFAULT_JURISDICTION_POLICIES[key] ?? DEFAULT_JURISDICTION_POLICIES.GLOBAL;
}
