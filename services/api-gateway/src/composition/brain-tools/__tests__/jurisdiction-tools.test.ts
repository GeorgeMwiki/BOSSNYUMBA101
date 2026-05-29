/**
 * Jurisdiction tools (JA-4, JC-1, JC-6) — output contract tests.
 *
 * Verifies:
 *   - show_current returns a bilingual snapshot from the resolver.
 *   - discover returns a low-confidence stub when no httpClient.
 *   - switch rejects scope='permanent' at validation.
 *   - switch returns a bilingual confirmation for turn / session.
 */

import { describe, expect, it, beforeAll } from 'vitest';
import {
  configureJurisdictionTools,
  jurisdictionShowCurrentTool,
  jurisdictionDiscoverTool,
  jurisdictionSwitchTool,
} from '../index.js';
import type { TenantConfigPort } from '../../../services/jurisdiction-resolver/index.js';

const tenantCountry = new Map<string, string>([
  ['tnt-ke', 'KE'],
  ['tnt-tz', 'TZ'],
  ['tnt-ng', 'NG'],
]);

const fakePort: TenantConfigPort = {
  async getTenantCountry(tenantId: string) {
    return tenantCountry.get(tenantId);
  },
};

beforeAll(() => {
  configureJurisdictionTools(fakePort);
});

const baseCtx = {
  tenantId: 'tnt-ke',
  actorId: 'usr-test',
  personaSlug: 'T1_owner_strategist',
};

describe('jurisdictionShowCurrentTool (JA-4)', () => {
  it('returns the KE snapshot for a KE tenant', async () => {
    const out = await jurisdictionShowCurrentTool.handler(
      { language: 'en' },
      baseCtx,
    );
    expect(out.country).toBe('KE');
    expect(out.currency).toBe('KES');
    expect(out.revenueAuthority).toContain('KRA');
  });

  it('returns the TZ snapshot for a TZ tenant', async () => {
    const out = await jurisdictionShowCurrentTool.handler(
      { language: 'en' },
      { ...baseCtx, tenantId: 'tnt-tz' },
    );
    expect(out.country).toBe('TZ');
    expect(out.currency).toBe('TZS');
    expect(out.revenueAuthority).toContain('TRA');
  });

  it('renders bilingual sw + en formatted strings', async () => {
    const out = await jurisdictionShowCurrentTool.handler(
      { language: 'en' },
      baseCtx,
    );
    expect(out.formattedEn.length).toBeGreaterThan(0);
    expect(out.formattedSw.length).toBeGreaterThan(0);
    // sw should contain a Swahili phrase
    expect(out.formattedSw.toLowerCase()).toContain('mali');
  });

  it('returns unseeded snapshot for an unknown tenant', async () => {
    const out = await jurisdictionShowCurrentTool.handler(
      { language: 'en' },
      { ...baseCtx, tenantId: 'tnt-unknown' },
    );
    expect(out.source).toBe('unseeded');
  });
});

describe('jurisdictionDiscoverTool (JC-1)', () => {
  it('returns a low-confidence stub when httpClient is unavailable', async () => {
    const out = await jurisdictionDiscoverTool.handler(
      { country: 'Ghana' },
      baseCtx,
    );
    expect(out.lowConfidence).toBe(true);
    expect(out.origin).toBe('fallback');
    expect(out.countryName).toBe('Ghana');
    expect(out.regulators.length).toBeGreaterThan(0);
  });

  it('NEVER returns empty regulators (Mr. Mwikila never says I don\'t know)', async () => {
    const out = await jurisdictionDiscoverTool.handler(
      { country: 'XX' },
      baseCtx,
    );
    expect(out.regulators.length).toBeGreaterThan(0);
  });
});

describe('jurisdictionSwitchTool (JC-6)', () => {
  it('accepts scope=turn and returns bilingual confirmation', async () => {
    const out = await jurisdictionSwitchTool.handler(
      { countryCode: 'TZ', scope: 'turn' },
      baseCtx,
    );
    expect(out.acknowledged).toBe(true);
    expect(out.message.en).toMatch(/TZ/);
    expect(out.message.sw.length).toBeGreaterThan(0);
  });

  it('accepts scope=session and warns the account remains locked', async () => {
    const out = await jurisdictionSwitchTool.handler(
      { countryCode: 'NG', scope: 'session' },
      baseCtx,
    );
    expect(out.acknowledged).toBe(true);
    expect(out.message.en.toLowerCase()).toContain('locked');
    expect(out.message.sw.length).toBeGreaterThan(0);
  });

  it('rejects scope=permanent at the input validator', () => {
    const parsed = jurisdictionSwitchTool.inputSchema.safeParse({
      countryCode: 'TZ',
      scope: 'permanent',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects lowercase or invalid country codes at the input validator', () => {
    const parsed = jurisdictionSwitchTool.inputSchema.safeParse({
      countryCode: 'tz',
      scope: 'turn',
    });
    expect(parsed.success).toBe(false);
  });
});
