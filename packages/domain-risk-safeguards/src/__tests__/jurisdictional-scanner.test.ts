/**
 * Jurisdictional-creep class scanner tests.
 *
 * 10 source files:
 *   - 5 should-pass (allowlisted / clean code)
 *   - 5 should-fail (one of the three FAIL classes)
 */

import { describe, it, expect } from 'vitest';
import {
  isAllowlistedPath,
  scanSource,
  scanSources,
} from '../jurisdictional-scanner/index.js';

describe('jurisdictional-scanner — 5 should-PASS files', () => {
  it('allowlisted — jurisdictional-rules.ts', () => {
    const r = scanSource({
      file: 'packages/domain-models/src/common/jurisdictional-rules.ts',
      source: `
        export function getJurisdictionalRules(country: string) {
          switch (country) { case 'TZ': return TZ; case 'KE': return KE; default: throw new Error('unknown'); }
        }
      `,
    });
    expect(r.passes).toBe(true);
  });

  it('allowlisted — compliance-plugins/countries/ke/...', () => {
    const r = scanSource({
      file: 'packages/compliance-plugins/src/countries/ke/tax.ts',
      source: `if (country === 'KE') return computeKra();`,
    });
    expect(r.passes).toBe(true);
  });

  it('clean code — no jurisdictional branch at all', () => {
    const r = scanSource({
      file: 'services/api-gateway/src/routes/rent.router.ts',
      source: `
        import { getJurisdictionalRules } from '@bossnyumba/domain-models';
        export function computeRent(tenant: Tenant): number {
          const rules = getJurisdictionalRules(tenant.country);
          return rules.computeMonthlyRent(tenant);
        }
      `,
    });
    expect(r.passes).toBe(true);
  });

  it('clean code — switch on jurisdiction WITH default branch', () => {
    const r = scanSource({
      file: 'packages/forecasting-engine/src/per-country-model.ts',
      source: `
        function modelForCountry(country: string) {
          // switch (country) wrapping for documentation
          switch (country) {
            case 'TZ':
              return tanzania;
            case 'KE':
              return kenya;
            default:
              throw new Error('country ' + country + ' not supported');
          }
        }
      `,
    });
    // The switch IS on country but it has a default. This is also at a
    // non-allowlisted path. The `case 'TZ'` patterns aren't literal
    // comparisons (no '===' operator), so should not flag.
    expect(r.passes).toBe(true);
  });

  it('test file — allowlisted via /__tests__/ pattern', () => {
    const r = scanSource({
      file: 'packages/forecasting/src/__tests__/per-country.test.ts',
      source: `if (jurisdiction === 'TZ') expect(rate).toBe(0.18);`,
    });
    expect(r.passes).toBe(true);
  });
});

describe('jurisdictional-scanner — 5 should-FAIL files', () => {
  it('FAIL — literal-tz-outside-rules: jurisdiction === \'TZ\' in business logic', () => {
    const r = scanSource({
      file: 'services/payments/src/compute-tax.ts',
      source: `
        export function computeTax(tenant: Tenant): number {
          if (tenant.jurisdiction === 'TZ') {
            return tenant.rent * 0.18;
          }
          return tenant.rent * 0.16;
        }
      `,
    });
    expect(r.passes).toBe(false);
    expect(r.findings.some((f) => f.kind === 'literal-tz-outside-rules')).toBe(true);
  });

  it('FAIL — switch-jurisdiction-no-default in business logic', () => {
    const r = scanSource({
      file: 'services/notifications/src/per-country-templates.ts',
      source: `
        function template(jurisdiction: string) {
          switch (jurisdiction) {
            case 'TZ':
              return tzTemplate;
            case 'KE':
              return keTemplate;
          }
        }
      `,
    });
    expect(r.passes).toBe(false);
    expect(
      r.findings.some((f) => f.kind === 'switch-jurisdiction-no-default'),
    ).toBe(true);
  });

  it('FAIL — country-or-tz-silent-fallback the literal class we already fixed', () => {
    const r = scanSource({
      file: 'services/api-gateway/src/composition/tenant-context.ts',
      source: `
        export function resolveCountry(tenant: Tenant): string {
          const country = tenant.country || 'TZ';
          return country;
        }
      `,
    });
    expect(r.passes).toBe(false);
    expect(
      r.findings.some((f) => f.kind === 'country-or-tz-silent-fallback'),
    ).toBe(true);
  });

  it('FAIL — currency silent-fallback', () => {
    const r = scanSource({
      file: 'services/payments/src/ledger.ts',
      source: `
        const currency = ledger.currency ?? 'KES';
        return convert(amount, currency);
      `,
    });
    expect(r.passes).toBe(false);
    expect(
      r.findings.some((f) => f.kind === 'country-or-tz-silent-fallback'),
    ).toBe(true);
  });

  it('FAIL — multiple findings in one file', () => {
    const r = scanSource({
      file: 'services/forecasting/src/compute.ts',
      source: `
        function compute(tenant: any) {
          if (tenant.jurisdiction === 'KE') doKe();
          const country = tenant.country || 'TZ';
          switch (country) {
            case 'KE': return ke();
            case 'TZ': return tz();
          }
        }
      `,
    });
    expect(r.passes).toBe(false);
    expect(r.findings.length).toBeGreaterThanOrEqual(3);
  });
});

describe('jurisdictional-scanner — allowlist helper', () => {
  it('isAllowlistedPath matches expected patterns', () => {
    expect(
      isAllowlistedPath('packages/domain-models/src/common/jurisdictional-rules.ts'),
    ).toBe(true);
    expect(
      isAllowlistedPath('packages/compliance-plugins/src/countries/tz/tax.ts'),
    ).toBe(true);
    expect(isAllowlistedPath('foo/__tests__/bar.test.ts')).toBe(true);
    expect(isAllowlistedPath('services/api-gateway/src/composition/router.ts')).toBe(
      false,
    );
  });
});

describe('jurisdictional-scanner — scanSources aggregator', () => {
  it('returns one result per file', () => {
    const results = scanSources([
      { file: 'a.ts', source: '' },
      { file: 'b.ts', source: 'const x = country || "TZ";' },
    ]);
    expect(results.length).toBe(2);
    expect(results[0]?.passes).toBe(true);
    expect(results[1]?.passes).toBe(false);
  });
});
