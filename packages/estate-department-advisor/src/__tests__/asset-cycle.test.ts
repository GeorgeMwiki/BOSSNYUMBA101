import { describe, it, expect } from 'vitest';
import { decideAssetCycle } from '../portfolio/asset-cycle-decider.js';
import { makePortfolio, TENANT_ID } from './fixtures.js';

describe('asset-cycle-decider', () => {
  const base = makePortfolio();
  const property = base.properties[0];
  if (!property) throw new Error('no fixture property');

  it('decides "sell" when IRR fails hurdle + cap-rate compressed', () => {
    const d = decideAssetCycle({
      tenantId: TENANT_ID,
      property: {
        ...property,
        entryCapRate: 0.08,
        currentMarketCapRate: 0.06,
      },
      holdingHurdleIrr: 0.12,
      forwardHoldIrr: 0.08,
      refurbishIncrementalIrr: 0.10,
      refurbishPaybackYears: 6,
      bestConversionIrr: 0.10,
      conversionZoningProbability: 0.2,
      hasTaxBasisTrap: false,
    });
    expect(d.action).toBe('sell');
  });

  it('does NOT decide sell when tax-basis-trap blocks', () => {
    const d = decideAssetCycle({
      tenantId: TENANT_ID,
      property: { ...property, entryCapRate: 0.08, currentMarketCapRate: 0.06 },
      holdingHurdleIrr: 0.12,
      forwardHoldIrr: 0.08,
      refurbishIncrementalIrr: 0.10,
      refurbishPaybackYears: 6,
      bestConversionIrr: 0.10,
      conversionZoningProbability: 0.2,
      hasTaxBasisTrap: true,
    });
    expect(d.action).not.toBe('sell');
  });

  it('decides "convert" when alternative IRR clears + zoning probable', () => {
    const d = decideAssetCycle({
      tenantId: TENANT_ID,
      property,
      holdingHurdleIrr: 0.12,
      forwardHoldIrr: 0.13,
      refurbishIncrementalIrr: 0.10,
      refurbishPaybackYears: 8,
      bestConversionIrr: 0.20,
      conversionZoningProbability: 0.7,
      hasTaxBasisTrap: false,
    });
    expect(d.action).toBe('convert');
  });

  it('decides "refurbish" when refurb IRR clears + payback <= 5', () => {
    const d = decideAssetCycle({
      tenantId: TENANT_ID,
      property,
      holdingHurdleIrr: 0.12,
      forwardHoldIrr: 0.13,
      refurbishIncrementalIrr: 0.18,
      refurbishPaybackYears: 4,
      bestConversionIrr: 0.10,
      conversionZoningProbability: 0.3,
      hasTaxBasisTrap: false,
    });
    expect(d.action).toBe('refurbish');
  });

  it('decides "hold" when no signal clears', () => {
    const d = decideAssetCycle({
      tenantId: TENANT_ID,
      property,
      holdingHurdleIrr: 0.12,
      forwardHoldIrr: 0.13,
      refurbishIncrementalIrr: 0.10,
      refurbishPaybackYears: 8,
      bestConversionIrr: 0.10,
      conversionZoningProbability: 0.3,
      hasTaxBasisTrap: false,
    });
    expect(d.action).toBe('hold');
  });

  it('includes drivers + citation for every decision', () => {
    const d = decideAssetCycle({
      tenantId: TENANT_ID,
      property,
      holdingHurdleIrr: 0.12,
      forwardHoldIrr: 0.13,
      refurbishIncrementalIrr: 0.10,
      refurbishPaybackYears: 8,
      bestConversionIrr: 0.10,
      conversionZoningProbability: 0.3,
      hasTaxBasisTrap: false,
    });
    expect(d.drivers.length).toBeGreaterThan(0);
    expect(d.citation.length).toBeGreaterThan(0);
  });

  it('refurbish blocked when payback exceeds 5 yrs', () => {
    const d = decideAssetCycle({
      tenantId: TENANT_ID,
      property,
      holdingHurdleIrr: 0.12,
      forwardHoldIrr: 0.13,
      refurbishIncrementalIrr: 0.20,
      refurbishPaybackYears: 7,
      bestConversionIrr: 0.10,
      conversionZoningProbability: 0.3,
      hasTaxBasisTrap: false,
    });
    expect(d.action).toBe('hold');
  });

  it('convert blocked when zoning probability below 0.5', () => {
    const d = decideAssetCycle({
      tenantId: TENANT_ID,
      property,
      holdingHurdleIrr: 0.12,
      forwardHoldIrr: 0.13,
      refurbishIncrementalIrr: 0.10,
      refurbishPaybackYears: 8,
      bestConversionIrr: 0.25,
      conversionZoningProbability: 0.4,
      hasTaxBasisTrap: false,
    });
    expect(d.action).toBe('hold');
  });
});
