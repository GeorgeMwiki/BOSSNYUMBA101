/**
 * Tests for the LLM Provider Gate (Week 0 Legal Emergency).
 *
 * Verifies that DeepSeek is blocked for TZ/KE tenants and that other
 * providers remain unaffected.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isProviderAllowedForTenant,
  assertProviderAllowedForTenant,
  isDeepSeekGloballyEnabled,
  ProviderBlockedByCountryError,
  DEEPSEEK_BLOCKED_COUNTRIES,
  DEEPSEEK_ENABLED_ENV_VAR,
} from '../llm-provider-gate.js';

describe('llm-provider-gate', () => {
  const ORIGINAL_ENV = process.env[DEEPSEEK_ENABLED_ENV_VAR];

  beforeEach(() => {
    delete process.env[DEEPSEEK_ENABLED_ENV_VAR];
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env[DEEPSEEK_ENABLED_ENV_VAR];
    } else {
      process.env[DEEPSEEK_ENABLED_ENV_VAR] = ORIGINAL_ENV;
    }
  });

  describe('country sovereignty rules', () => {
    it('blocks DeepSeek for TZ tenants', () => {
      expect(isProviderAllowedForTenant('deepseek', 'TZ')).toBe(false);
    });

    it('blocks DeepSeek for KE tenants', () => {
      expect(isProviderAllowedForTenant('deepseek', 'KE')).toBe(false);
    });

    it('blocks DeepSeek for TZ tenants regardless of case', () => {
      expect(isProviderAllowedForTenant('deepseek', 'tz')).toBe(false);
      expect(isProviderAllowedForTenant('DeepSeek', 'Tz')).toBe(false);
    });

    it('blocks DeepSeek for KE tenants regardless of whitespace', () => {
      expect(isProviderAllowedForTenant('deepseek', '  ke  ')).toBe(false);
    });

    it('allows DeepSeek for US tenants', () => {
      expect(isProviderAllowedForTenant('deepseek', 'US')).toBe(true);
    });

    it('allows DeepSeek for GB tenants', () => {
      expect(isProviderAllowedForTenant('deepseek', 'GB')).toBe(true);
    });

    it('keeps DEEPSEEK_BLOCKED_COUNTRIES at exactly TZ + KE', () => {
      expect([...DEEPSEEK_BLOCKED_COUNTRIES].sort()).toEqual(['KE', 'TZ']);
    });
  });

  describe('other providers are never country-gated', () => {
    it('allows OpenAI everywhere', () => {
      expect(isProviderAllowedForTenant('openai', 'TZ')).toBe(true);
      expect(isProviderAllowedForTenant('openai', 'KE')).toBe(true);
      expect(isProviderAllowedForTenant('openai', 'US')).toBe(true);
    });

    it('allows Anthropic everywhere', () => {
      expect(isProviderAllowedForTenant('anthropic', 'TZ')).toBe(true);
      expect(isProviderAllowedForTenant('anthropic', 'KE')).toBe(true);
      expect(isProviderAllowedForTenant('anthropic', 'US')).toBe(true);
    });

    it('allows mock provider everywhere (test fixture)', () => {
      expect(isProviderAllowedForTenant('mock', 'TZ')).toBe(true);
      expect(isProviderAllowedForTenant('mock', 'KE')).toBe(true);
    });

    it('allows unknown providers everywhere (default-allow)', () => {
      expect(isProviderAllowedForTenant('some-future-llm', 'KE')).toBe(true);
    });
  });

  describe('global DEEPSEEK_ENABLED env kill-switch', () => {
    it('treats unset env as enabled', () => {
      delete process.env[DEEPSEEK_ENABLED_ENV_VAR];
      expect(isDeepSeekGloballyEnabled()).toBe(true);
    });

    it('treats empty string as enabled', () => {
      process.env[DEEPSEEK_ENABLED_ENV_VAR] = '';
      expect(isDeepSeekGloballyEnabled()).toBe(true);
    });

    it.each(['false', '0', 'no', 'off', 'FALSE', 'Off'])(
      'treats %s as disabled',
      (val) => {
        process.env[DEEPSEEK_ENABLED_ENV_VAR] = val;
        expect(isDeepSeekGloballyEnabled()).toBe(false);
      },
    );

    it.each(['true', '1', 'yes', 'on', 'enabled'])(
      'treats %s as enabled',
      (val) => {
        process.env[DEEPSEEK_ENABLED_ENV_VAR] = val;
        expect(isDeepSeekGloballyEnabled()).toBe(true);
      },
    );

    it('blocks DeepSeek globally when env=false, even for non-blocked countries', () => {
      process.env[DEEPSEEK_ENABLED_ENV_VAR] = 'false';
      expect(isProviderAllowedForTenant('deepseek', 'US')).toBe(false);
      expect(isProviderAllowedForTenant('deepseek', 'TZ')).toBe(false);
    });

    it('does not affect non-deepseek providers when env=false', () => {
      process.env[DEEPSEEK_ENABLED_ENV_VAR] = 'false';
      expect(isProviderAllowedForTenant('openai', 'US')).toBe(true);
      expect(isProviderAllowedForTenant('anthropic', 'US')).toBe(true);
    });
  });

  describe('assertProviderAllowedForTenant', () => {
    it('does not throw for allowed combinations', () => {
      expect(() => assertProviderAllowedForTenant('deepseek', 'US')).not.toThrow();
      expect(() => assertProviderAllowedForTenant('openai', 'TZ')).not.toThrow();
    });

    it('throws ProviderBlockedByCountryError for DeepSeek + TZ', () => {
      expect(() => assertProviderAllowedForTenant('deepseek', 'TZ')).toThrow(
        ProviderBlockedByCountryError,
      );
    });

    it('throws ProviderBlockedByCountryError for DeepSeek + KE', () => {
      expect(() => assertProviderAllowedForTenant('deepseek', 'KE')).toThrow(
        ProviderBlockedByCountryError,
      );
    });

    it('error carries provider + country + machine code', () => {
      try {
        assertProviderAllowedForTenant('deepseek', 'KE');
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderBlockedByCountryError);
        const e = err as ProviderBlockedByCountryError;
        expect(e.code).toBe('PROVIDER_BLOCKED_BY_COUNTRY');
        expect(e.provider).toBe('deepseek');
        expect(e.tenantCountry).toBe('KE');
      }
    });
  });

  describe('edge cases', () => {
    it('empty country string allows DeepSeek (default-allow on missing data)', () => {
      // We choose default-allow because tenant onboarding should fill country;
      // if it's missing the broader pipeline should fail elsewhere, not here.
      expect(isProviderAllowedForTenant('deepseek', '')).toBe(true);
    });

    it('null/undefined provider treated as non-deepseek (allowed)', () => {
      // @ts-expect-error testing runtime safety
      expect(isProviderAllowedForTenant(null, 'TZ')).toBe(true);
      // @ts-expect-error testing runtime safety
      expect(isProviderAllowedForTenant(undefined, 'KE')).toBe(true);
    });
  });
});
