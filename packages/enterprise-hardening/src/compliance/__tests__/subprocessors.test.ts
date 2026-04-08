/**
 * Subprocessor register integrity tests.
 *
 * These tests guard the canonical typed list against accidental drift from
 * Docs/SUBPROCESSORS.md and the database schema. Anyone editing the register
 * MUST keep these tests passing.
 */

import { describe, it, expect } from 'vitest';
import {
  SUBPROCESSORS,
  getSubprocessor,
  isSubprocessorAllowedForCountry,
  getPendingDpaSubprocessors,
  getRiskFlaggedSubprocessors,
} from '../subprocessors';

describe('SUBPROCESSORS register', () => {
  it('contains the six expected subprocessors', () => {
    const ids = SUBPROCESSORS.map((s) => s.id).sort();
    expect(ids).toEqual([
      'anthropic',
      'deepseek',
      'openai',
      'resend',
      'supabase',
      'twilio',
    ]);
  });

  it('Anthropic DPA is pending (must be signed before GA)', () => {
    const sp = getSubprocessor('anthropic');
    expect(sp).toBeDefined();
    expect(sp?.dpaStatus).toBe('pending');
  });

  it('DeepSeek is risk-flagged and disabled for TZ + KE', () => {
    const sp = getSubprocessor('deepseek');
    expect(sp).toBeDefined();
    expect(sp?.riskFlag).toBe(true);
    expect([...(sp?.disabledForCountries ?? [])].sort()).toEqual(['KE', 'TZ']);
  });

  it('all non-DeepSeek subprocessors have empty disabledForCountries', () => {
    for (const sp of SUBPROCESSORS) {
      if (sp.id !== 'deepseek') {
        expect(sp.disabledForCountries).toEqual([]);
      }
    }
  });

  it('every subprocessor has a non-empty name, purpose, and region', () => {
    for (const sp of SUBPROCESSORS) {
      expect(sp.name.length).toBeGreaterThan(0);
      expect(sp.purpose.length).toBeGreaterThan(0);
      expect(sp.region.length).toBeGreaterThan(0);
    }
  });

  it('every subprocessor processes at least one data category', () => {
    for (const sp of SUBPROCESSORS) {
      expect(sp.dataCategories.length).toBeGreaterThan(0);
    }
  });

  it('ids are unique', () => {
    const ids = SUBPROCESSORS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getSubprocessor', () => {
  it('returns the matching subprocessor', () => {
    expect(getSubprocessor('twilio')?.name).toBe('Twilio');
  });

  it('returns undefined for unknown ids', () => {
    expect(getSubprocessor('does-not-exist')).toBeUndefined();
  });
});

describe('isSubprocessorAllowedForCountry', () => {
  it('blocks DeepSeek for TZ', () => {
    expect(isSubprocessorAllowedForCountry('deepseek', 'TZ')).toBe(false);
  });

  it('blocks DeepSeek for KE (case-insensitive)', () => {
    expect(isSubprocessorAllowedForCountry('deepseek', 'ke')).toBe(false);
  });

  it('allows DeepSeek for US', () => {
    expect(isSubprocessorAllowedForCountry('deepseek', 'US')).toBe(true);
  });

  it('allows OpenAI for TZ', () => {
    expect(isSubprocessorAllowedForCountry('openai', 'TZ')).toBe(true);
  });

  it('returns false for unknown subprocessor ids (fail closed)', () => {
    expect(isSubprocessorAllowedForCountry('mystery-llm', 'US')).toBe(false);
  });
});

describe('getPendingDpaSubprocessors', () => {
  it('returns Anthropic (the only pending DPA)', () => {
    const pending = getPendingDpaSubprocessors();
    expect(pending.map((s) => s.id)).toEqual(['anthropic']);
  });
});

describe('getRiskFlaggedSubprocessors', () => {
  it('returns DeepSeek (the only risk-flagged subprocessor)', () => {
    const flagged = getRiskFlaggedSubprocessors();
    expect(flagged.map((s) => s.id)).toEqual(['deepseek']);
  });
});
