/**
 * Frozen wit-anchor persona tests.
 */

import { describe, it, expect } from 'vitest';
import {
  BOSSNYUMBA_PERSONA,
  renderSituatedAddress,
  renderPersonaPrelude,
  isBrandReservedName,
  preservesBrandName,
} from '../persona.js';
import { TENANT_RESIDENT_PERSONA } from '../identity.js';
import type { ScopeContext } from '../../types.js';

const tenantScope: ScopeContext = {
  kind: 'tenant',
  tenantId: 'acme-estates',
  actorUserId: 'user-1',
  roles: ['tenant'],
  personaId: 'tenant-resident',
};

describe('BOSSNYUMBA_PERSONA', () => {
  it('declares "no em dashes" voice invariant', () => {
    expect(BOSSNYUMBA_PERSONA).toMatch(/no em dashes/i);
  });

  it('declares ISO-4217 currency discipline', () => {
    expect(BOSSNYUMBA_PERSONA).toMatch(/ISO-4217/);
  });

  it('cites property-management regulators (KRA, RERA, PDPA, BoT)', () => {
    expect(BOSSNYUMBA_PERSONA).toMatch(/KRA/);
    expect(BOSSNYUMBA_PERSONA).toMatch(/RERA/);
    expect(BOSSNYUMBA_PERSONA).toMatch(/PDPA/);
    expect(BOSSNYUMBA_PERSONA).toMatch(/BoT/);
  });

  it('bans AI dodge phrases', () => {
    expect(BOSSNYUMBA_PERSONA).toMatch(/as an AI/i);
  });

  it('forbids invented agency / estate / tenant data', () => {
    expect(BOSSNYUMBA_PERSONA).toMatch(/agency names/i);
    expect(BOSSNYUMBA_PERSONA).toMatch(/estate addresses/i);
  });

  it('is a stable string across imports (cache-eligibility)', async () => {
    const m = await import('../persona.js');
    expect(m.BOSSNYUMBA_PERSONA).toBe(BOSSNYUMBA_PERSONA);
  });
});

describe('renderSituatedAddress', () => {
  it('includes portal, tier, scope, EAT clock', () => {
    const out = renderSituatedAddress({
      surface: 'tenant-app',
      scope: tenantScope,
      tier: 'org',
      nowMs: Date.UTC(2026, 4, 14, 9, 0), // 2026-05-14 09:00 UTC → 12:00 EAT
    });
    expect(out).toMatch(/Portal: tenant-app/);
    expect(out).toMatch(/Tier: org/);
    expect(out).toMatch(/tenant=acme-estates/);
    expect(out).toMatch(/2026-05-14 12:00 EAT/);
  });

  it('renders platform-tier scope when not tenant', () => {
    const platformScope: ScopeContext = {
      kind: 'platform',
      actorUserId: 'admin-1',
      roles: ['platform-admin'],
      personaId: 'platform-sovereign',
    };
    const out = renderSituatedAddress({
      surface: 'platform-hq',
      scope: platformScope,
      tier: 'industry',
      nowMs: 0,
    });
    expect(out).toMatch(/Scope: platform-tier/);
  });

  it('includes optional route + section + speaker + language when provided', () => {
    const out = renderSituatedAddress({
      surface: 'owner-portal',
      scope: tenantScope,
      tier: 'org',
      route: '/portfolio/blocks/3',
      section: 'arrears',
      userDisplayName: 'Asha',
      language: 'sw',
      nowMs: 0,
    });
    expect(out).toMatch(/Route: \/portfolio\/blocks\/3/);
    expect(out).toMatch(/Section: arrears/);
    expect(out).toMatch(/Speaking with: Asha/);
    expect(out).toMatch(/Language: sw/);
  });
});

describe('renderPersonaPrelude', () => {
  it('starts with the platform voice anchor (cache-eligible prefix)', () => {
    const prelude = renderPersonaPrelude({
      surface: 'tenant-app',
      scope: tenantScope,
      tier: 'org',
      nowMs: 0,
    });
    expect(prelude.startsWith('[PLATFORM VOICE')).toBe(true);
  });

  it('places the situated address AFTER the persona block', () => {
    const prelude = renderPersonaPrelude({
      surface: 'tenant-app',
      scope: tenantScope,
      tier: 'org',
      nowMs: 0,
    });
    expect(prelude.indexOf('[PLATFORM VOICE')).toBeLessThan(prelude.indexOf('[SITUATED ADDRESS'));
  });
});

describe('isBrandReservedName + preservesBrandName', () => {
  it('flags BossNyumba and Nyumba Mind as reserved', () => {
    expect(isBrandReservedName('BossNyumba Resident Concierge')).toBe(true);
    expect(isBrandReservedName('Nyumba Mind')).toBe(true);
    expect(isBrandReservedName('Acme Estates')).toBe(false);
  });

  it('passes when brand-reserved persona appears in output verbatim', () => {
    expect(preservesBrandName(TENANT_RESIDENT_PERSONA, 'BossNyumba says hi')).toBe(true);
  });

  it('passes when brand-reserved persona is absent (not every reply names the brand)', () => {
    expect(preservesBrandName(TENANT_RESIDENT_PERSONA, 'rent is TZS 350,000')).toBe(true);
  });

  it('fails on plausible translations of the brand', () => {
    expect(preservesBrandName(TENANT_RESIDENT_PERSONA, 'House Boss says hi')).toBe(false);
    expect(preservesBrandName(TENANT_RESIDENT_PERSONA, 'akili ya nyumba')).toBe(false);
  });

  it('non-brand persona always preserves', () => {
    const nonBrand = { ...TENANT_RESIDENT_PERSONA, displayName: 'Acme Concierge' };
    expect(preservesBrandName(nonBrand, 'anything goes here')).toBe(true);
  });
});
