/**
 * Shared test fixtures — a synthetic mid-size 50-property portfolio.
 */

import type {
  HeadcountByRole,
  InsurancePolicy,
  PortfolioSnapshot,
  PropertySnapshot,
  TenantId,
  VendorSpend,
} from '../types.js';

const NOW_MS = Date.UTC(2026, 4, 24); // 2026-05-24

const TENANT_ID = 'tenant-acme-re' as TenantId;

function makeProperty(idx: number, partial: Partial<PropertySnapshot> = {}): PropertySnapshot {
  const cities = ['Nairobi', 'Dar', 'Kampala', 'Lagos', 'Kigali', 'Johannesburg'];
  const jurisdictions = ['KE', 'TZ', 'UG', 'NG', 'RW', 'ZA'] as const;
  const j = jurisdictions[idx % jurisdictions.length] ?? 'KE';
  return {
    propertyId: `prop-${idx}`,
    name: `Property ${idx}`,
    assetClass: idx % 5 === 0 ? 'office' : 'multifamily',
    jurisdiction: j,
    city: cities[idx % cities.length] ?? 'Nairobi',
    subMarket: `submarket-${idx % 5}`,
    doors: idx % 5 === 0 ? 0 : 50 + (idx % 7) * 10,
    rentableSf: idx % 5 === 0 ? 80_000 : 40_000,
    marketValueUsd: 5_000_000 + (idx % 10) * 1_000_000,
    mortgageBalanceUsd: 2_000_000 + (idx % 10) * 500_000,
    annualNoiUsd: 350_000 + (idx % 10) * 30_000,
    annualOpexUsd: 220_000 + (idx % 10) * 15_000,
    annualRevenueUsd: 600_000 + (idx % 10) * 40_000,
    occupancyRate: 0.92 - (idx % 8) * 0.02,
    avgLeaseEndsAtMs: NOW_MS + ((idx % 4) + 1) * 365 * 24 * 60 * 60 * 1000,
    anchorTenantSharePct: idx % 11 === 0 ? 0.55 : 0.18,
    entryCapRate: 0.075,
    currentMarketCapRate: 0.065,
    basisUsd: 4_000_000 + (idx % 10) * 800_000,
    ...partial,
  };
}

function makeHeadcount(): ReadonlyArray<HeadcountByRole> {
  return [
    { role: 'property-manager', fte: 4, avgSalaryUsd: 38_000, avgBonusPct: 0.10, avgTenureMonths: 28 },
    { role: 'senior-pm', fte: 1, avgSalaryUsd: 54_000, avgBonusPct: 0.15, avgTenureMonths: 36 },
    { role: 'director-ops', fte: 1, avgSalaryUsd: 96_750, avgBonusPct: 0.28, avgTenureMonths: 60 },
    { role: 'maintenance-tech', fte: 8, avgSalaryUsd: 24_000, avgBonusPct: 0.05, avgTenureMonths: 18 },
    { role: 'maintenance-supervisor', fte: 1, avgSalaryUsd: 36_900, avgBonusPct: 0.10, avgTenureMonths: 48 },
    { role: 'accounting-manager', fte: 1, avgSalaryUsd: 51_750, avgBonusPct: 0.15, avgTenureMonths: 30 },
    { role: 'leasing-manager', fte: 1, avgSalaryUsd: 42_750, avgBonusPct: 0.15, avgTenureMonths: 24 },
  ];
}

function makeVendors(): ReadonlyArray<VendorSpend> {
  return [
    { vendorId: 'v1', vendorName: 'Acme Janitorial', category: 'janitorial', annualSpendUsd: 180_000, contractType: 'fixed-bid', responseTimeP50Hours: 12, firstTimeFixRate: 0.85, costVariancePct: 0.03, qualityScore: 4.3, contractEndsAtMs: NOW_MS + 90 * 24 * 60 * 60 * 1000 },
    { vendorId: 'v2', vendorName: 'Beta Janitors', category: 'janitorial', annualSpendUsd: 30_000, contractType: 'fixed-bid', responseTimeP50Hours: 24, firstTimeFixRate: 0.7, costVariancePct: 0.10, qualityScore: 3.8, contractEndsAtMs: NOW_MS + 60 * 24 * 60 * 60 * 1000 },
    { vendorId: 'v3', vendorName: 'Mega HVAC Co', category: 'hvac', annualSpendUsd: 120_000, contractType: 'performance-based', responseTimeP50Hours: 3, firstTimeFixRate: 0.82, costVariancePct: 0.05, qualityScore: 4.5, contractEndsAtMs: NOW_MS + 180 * 24 * 60 * 60 * 1000 },
    { vendorId: 'v4', vendorName: 'Lone Legal LLP', category: 'legal', annualSpendUsd: 60_000, contractType: 'hourly', responseTimeP50Hours: 8, firstTimeFixRate: 0.9, costVariancePct: 0.06, qualityScore: 4.7, contractEndsAtMs: NOW_MS + 365 * 24 * 60 * 60 * 1000 },
  ];
}

function makeInsurance(): ReadonlyArray<InsurancePolicy> {
  return [
    { policyId: 'ins-prop', axis: 'all-risk-property', carrier: 'Acme Mutual', perOccurrenceLimitUsd: 300_000_000, aggregateLimitUsd: 300_000_000, deductibleUsd: 25_000, annualPremiumUsd: 750_000, expiresAtMs: NOW_MS + 200 * 24 * 60 * 60 * 1000, replacementCostBased: true },
    { policyId: 'ins-gl', axis: 'general-liability', carrier: 'GL Carrier', perOccurrenceLimitUsd: 2_000_000, aggregateLimitUsd: 4_000_000, deductibleUsd: 10_000, annualPremiumUsd: 50_000, expiresAtMs: NOW_MS + 200 * 24 * 60 * 60 * 1000, replacementCostBased: false },
    { policyId: 'ins-bi', axis: 'business-interruption', carrier: 'Acme Mutual', perOccurrenceLimitUsd: 30_000_000, aggregateLimitUsd: 30_000_000, deductibleUsd: 50_000, annualPremiumUsd: 100_000, expiresAtMs: NOW_MS + 200 * 24 * 60 * 60 * 1000, replacementCostBased: false },
    { policyId: 'ins-cyber', axis: 'cyber', carrier: 'CyberCo', perOccurrenceLimitUsd: 5_000_000, aggregateLimitUsd: 5_000_000, deductibleUsd: 25_000, annualPremiumUsd: 30_000, expiresAtMs: NOW_MS + 200 * 24 * 60 * 60 * 1000, replacementCostBased: false },
  ];
}

export function makePortfolio(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  const properties = Array.from({ length: 50 }, (_, i) => makeProperty(i));
  return {
    tenantId: TENANT_ID,
    snapshotAtMs: NOW_MS,
    properties,
    cashReserveUsd: 2_500_000,
    annualPayrollUsd: 1_200_000,
    fteHeadcount: makeHeadcount(),
    insurancePolicies: makeInsurance(),
    vendors: makeVendors(),
    ownerArchetype: 'institutional',
    ownerEquityUsd: 80_000_000,
    holdingHurdleIrr: 0.12,
    ...overrides,
  };
}

export { NOW_MS, TENANT_ID };
