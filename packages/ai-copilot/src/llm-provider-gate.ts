/**
 * LLM Provider Gate (Week 0 Legal Emergency)
 *
 * Tenant-country-aware gate that controls which LLM providers are allowed
 * per tenant. This exists to enforce PII data-sovereignty rules that
 * REGULATE where tenant data may be sent for inference.
 *
 * Current rules:
 *   - DeepSeek is BLOCKED for tenants whose country is "TZ" (Tanzania) or
 *     "KE" (Kenya) because DeepSeek processes data in jurisdictions that
 *     are not approved by TZ/KE PII sovereignty policy.
 *   - All other providers (OpenAI, Anthropic Claude, mock, etc.) remain
 *     allowed regardless of country.
 *
 * The runtime env flag `DEEPSEEK_ENABLED` acts as a global kill-switch
 * (default: true). Even when DEEPSEEK_ENABLED is true, the country gate
 * still overrides and blocks DeepSeek for TZ/KE tenants. If
 * DEEPSEEK_ENABLED is explicitly false, DeepSeek is blocked everywhere.
 *
 * This module intentionally has NO external dependencies so it can be
 * imported from any layer (providers, routers, factories) without
 * creating cycles.
 */

/**
 * Supported LLM provider identifiers.
 *
 * Keep this list aligned with the providers supported by
 * `packages/config/src/schemas.ts` (AI_PROVIDER enum) and the concrete
 * provider classes in `./providers/ai-provider.ts`.
 */
export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'mock'
  | (string & {});

/**
 * ISO-3166 alpha-2 country codes that are subject to the DeepSeek PII
 * sovereignty block. Stored uppercase; compare case-insensitively.
 */
export const DEEPSEEK_BLOCKED_COUNTRIES: ReadonlyArray<string> = ['TZ', 'KE'];

/**
 * Name of the runtime env flag that globally enables/disables DeepSeek.
 * Default (when unset) is treated as ENABLED = true.
 */
export const DEEPSEEK_ENABLED_ENV_VAR = 'DEEPSEEK_ENABLED';

/**
 * Read the DEEPSEEK_ENABLED env flag. Missing/unset => true (enabled).
 * Only the literal strings "0", "false", "no", "off" (case-insensitive)
 * are treated as disabled. This matches common shell-env conventions.
 *
 * Exposed for tests so the env can be inspected/overridden explicitly.
 */
export function isDeepSeekGloballyEnabled(
  env: NodeJS.ProcessEnv = (typeof process !== 'undefined' ? process.env : {}) as NodeJS.ProcessEnv,
): boolean {
  const raw = env[DEEPSEEK_ENABLED_ENV_VAR];
  if (raw === undefined || raw === null || raw === '') return true;
  const v = String(raw).trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'no' || v === 'off');
}

/**
 * Check whether a given provider is allowed for a tenant in a given country.
 *
 * @param provider        The LLM provider identifier (e.g. 'deepseek').
 * @param tenantCountry   ISO-3166 alpha-2 country code of the tenant
 *                        (e.g. 'TZ', 'KE', 'US'). Case-insensitive.
 * @returns               true if the provider may be used for this tenant,
 *                        false if it must be blocked.
 *
 * Rules (in order):
 *   1. Non-deepseek providers are always allowed.
 *   2. If DEEPSEEK_ENABLED env flag is false => DeepSeek blocked everywhere.
 *   3. If tenantCountry is in DEEPSEEK_BLOCKED_COUNTRIES => DeepSeek blocked.
 *   4. Otherwise => DeepSeek allowed.
 */
export function isProviderAllowedForTenant(
  provider: LLMProvider,
  tenantCountry: string,
): boolean {
  const normalizedProvider = String(provider ?? '').trim().toLowerCase();

  // Rule 1: only DeepSeek is currently gated.
  if (normalizedProvider !== 'deepseek') {
    return true;
  }

  // Rule 2: global kill-switch via env.
  if (!isDeepSeekGloballyEnabled()) {
    return false;
  }

  // Rule 3: country sovereignty block.
  const normalizedCountry = String(tenantCountry ?? '').trim().toUpperCase();
  if (DEEPSEEK_BLOCKED_COUNTRIES.includes(normalizedCountry)) {
    return false;
  }

  // Rule 4: default allow.
  return true;
}

/**
 * Error thrown when a caller requests a provider that is gated-off for
 * the tenant's country. Kept as a named error (not a plain Error) so
 * upstream callers can `instanceof`-check and decide whether to fall
 * back to an allowed provider vs. surface the block to the user.
 */
export class ProviderBlockedByCountryError extends Error {
  readonly code = 'PROVIDER_BLOCKED_BY_COUNTRY';
  readonly provider: LLMProvider;
  readonly tenantCountry: string;

  constructor(provider: LLMProvider, tenantCountry: string) {
    super(
      `LLM provider "${provider}" is not allowed for tenants in country "${tenantCountry}" ` +
        `due to PII sovereignty policy. See packages/ai-copilot/src/llm-provider-gate.ts ` +
        `(DEEPSEEK_BLOCKED_COUNTRIES).`,
    );
    this.name = 'ProviderBlockedByCountryError';
    this.provider = provider;
    this.tenantCountry = tenantCountry;
  }
}

/**
 * Convenience helper: assert that the requested provider is allowed, or
 * throw a descriptive `ProviderBlockedByCountryError`.
 *
 * Use this at the boundary where an LLM provider is selected (factory,
 * router, registry). If you prefer graceful fallback instead of throwing,
 * call `isProviderAllowedForTenant` directly and choose the next allowed
 * provider yourself.
 */
export function assertProviderAllowedForTenant(
  provider: LLMProvider,
  tenantCountry: string,
): void {
  if (!isProviderAllowedForTenant(provider, tenantCountry)) {
    throw new ProviderBlockedByCountryError(provider, tenantCountry);
  }
}
