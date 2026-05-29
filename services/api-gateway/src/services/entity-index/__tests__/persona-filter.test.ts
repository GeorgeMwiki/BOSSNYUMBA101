import { describe, expect, it } from 'vitest';

import {
  applyPersonaFilter,
  computePersonaProjection,
  type EntityIndexRow,
} from '../persona-filter.js';

const sampleRow: EntityIndexRow = Object.freeze({
  kind: 'lease',
  id: 'l_42',
  displayName: 'Lease for Nyumba Palace #4B',
  summary:
    'Tenant John Doe at TZS 800,000 / month, arrears 245,000 over 60 days, expiring Apr 2027.',
  refreshedAt: '2026-05-29T00:00:00Z',
});

describe('computePersonaProjection (real-estate)', () => {
  it('owner_strategist gets full picture', () => {
    const p = computePersonaProjection({
      persona: 'owner_strategist',
      actorScopeIds: [],
    });
    expect(p.scopeIdsAllowed).toBeNull();
    expect(p.redactFinancials).toBe(false);
    expect(p.rewriteVocabulary).toBe(false);
  });

  it('property_manager scope-limited but sees money', () => {
    const p = computePersonaProjection({
      persona: 'property_manager',
      actorScopeIds: ['prop_1', 'prop_2'],
    });
    expect(p.scopeIdsAllowed).toEqual(['prop_1', 'prop_2']);
    expect(p.redactFinancials).toBe(false);
  });

  it('maintenance_contractor redacts financials + rewrites vocab', () => {
    const p = computePersonaProjection({
      persona: 'maintenance_contractor',
      actorScopeIds: ['prop_3'],
    });
    expect(p.redactFinancials).toBe(true);
    expect(p.rewriteVocabulary).toBe(true);
  });

  it('tenant capped to counterparty + redacted', () => {
    const p = computePersonaProjection({
      persona: 'tenant',
      actorScopeIds: ['lease_42'],
      counterpartyId: 'tenant_john',
    });
    expect(p.counterpartyId).toBe('tenant_john');
    expect(p.redactFinancials).toBe(true);
  });
});

describe('applyPersonaFilter (real-estate)', () => {
  it('owner sees the row unchanged', () => {
    const projection = computePersonaProjection({
      persona: 'owner_strategist',
      actorScopeIds: [],
    });
    const [filtered] = applyPersonaFilter([sampleRow], projection, 'en');
    expect(filtered?.summary).toContain('TZS 800,000');
  });

  it('contractor sees redacted summary + Maintenance Job vocab', () => {
    const projection = computePersonaProjection({
      persona: 'maintenance_contractor',
      actorScopeIds: ['prop_1'],
    });
    const [filtered] = applyPersonaFilter([sampleRow], projection, 'en');
    expect(filtered?.summary).not.toContain('TZS 800,000');
    expect(filtered?.summary).toContain('[redacted]');
    expect(filtered?.displayName).toContain('Tenancy');
  });

  it('contractor swahili gets [siri] placeholder', () => {
    const swRow: EntityIndexRow = {
      ...sampleRow,
      summary: 'Mpangaji John Doe kwa TZS 800,000 kwa mwezi, madeni 245,000.',
    };
    const projection = computePersonaProjection({
      persona: 'maintenance_contractor',
      actorScopeIds: ['prop_1'],
    });
    const [filtered] = applyPersonaFilter([swRow], projection, 'sw');
    expect(filtered?.summary).toContain('[siri]');
  });

  it('tenant sees rent figure redacted', () => {
    const projection = computePersonaProjection({
      persona: 'tenant',
      actorScopeIds: ['lease_42'],
      counterpartyId: 'tenant_john',
    });
    const [filtered] = applyPersonaFilter([sampleRow], projection, 'en');
    expect(filtered?.summary).toContain('[redacted]');
  });
});
