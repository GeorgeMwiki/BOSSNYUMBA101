/**
 * department-health-report — the headline composer.
 *
 * Given a PortfolioSnapshot, runs every advisor and assembles a
 * multi-section "veteran director" report ranked by strategic priority.
 *
 * LLM narrative synthesis optional via injected MultiLLMSynthesizer.
 */

import type {
  DepartmentHealthReport,
  HealthSection,
  MultiLLMSynthesizer,
  PortfolioSnapshot,
  Recommendation,
  RecommendationKind,
} from '../types.js';
import { analyzePortfolioComposition } from '../portfolio/portfolio-composition-advisor.js';
import { optimizeTenantMix } from '../portfolio/tenant-mix-optimizer.js';
import { benchmarkBoma } from '../operations/boma-benchmarker.js';
import { benchmarkIrem } from '../operations/irem-benchmarker.js';
import { adviseStaffing } from '../org/staffing-model-advisor.js';
import { adviseVendorPortfolio } from '../vendor/vendor-portfolio-advisor.js';
import { scoreCoverageAdequacy } from '../risk/coverage-adequacy-scorer.js';
import { scanCompliance } from '../regulatory/compliance-scanner.js';
import { commPatternFor } from '../owner-relations/comm-pattern-playbook.js';
import { prioritizeRecommendations } from './strategic-recommendation-prioritizer.js';

export interface BuildReportInput {
  readonly portfolio: PortfolioSnapshot;
  readonly nowMs: number;
  readonly complianceHorizonDays?: number;
}

export interface BuildReportWithNarrative extends BuildReportInput {
  readonly synthesizer: MultiLLMSynthesizer;
  readonly tone?: 'veteran-director' | 'investor-deck' | 'crisis-brief';
}

function sectionFor(
  kind: RecommendationKind,
  title: string,
  summary: string,
  recommendations: ReadonlyArray<Recommendation>,
): HealthSection {
  return { kind, title, summary, recommendations };
}

export function buildDepartmentHealthReport(
  input: BuildReportInput,
): DepartmentHealthReport {
  const { portfolio, nowMs } = input;
  const horizon = input.complianceHorizonDays ?? 90;

  const composition = analyzePortfolioComposition(portfolio);
  const tenantMix = optimizeTenantMix({
    tenantId: portfolio.tenantId,
    tenants: portfolio.properties.map((p) => ({
      tenantName: p.name,
      annualRentUsd: p.annualRevenueUsd,
      leaseEndsAtMs: p.avgLeaseEndsAtMs,
      covenantClass:
        p.assetClass === 'office' || p.assetClass === 'retail'
          ? ('middle-market' as const)
          : ('un-rated' as const),
    })),
    nowMs,
  });
  const boma = benchmarkBoma({ portfolio, assetClassFilter: 'all' });
  const irem = benchmarkIrem(portfolio);
  const staffing = adviseStaffing({ portfolio, assetClassFocus: 'multifamily' });
  const vendors = adviseVendorPortfolio({
    tenantId: portfolio.tenantId,
    vendors: portfolio.vendors,
  });
  const risk = scoreCoverageAdequacy(portfolio);
  const compliance = scanCompliance({
    portfolio,
    horizonDays: horizon,
    nowMs,
  });

  const sections: HealthSection[] = [
    sectionFor(
      'portfolio',
      'Portfolio health',
      `Asset-mix vs NCREIF + PREA 2024; HHI ${composition.geographicHhi} (${composition.hhiBand}); top tenant share ${(tenantMix.topTenantSharePct * 100).toFixed(0)}%.`,
      [...composition.recommendations, ...tenantMix.recommendations],
    ),
    sectionFor(
      'operations',
      'Operations excellence',
      `Opex/SF actual $${boma.opexPerSfActual.toFixed(2)} vs peer P50 $${boma.opexPerSfPeerP50.toFixed(2)}; IREM OER ${(irem.operatingExpenseRatio * 100).toFixed(0)}% (${irem.percentileOer}).`,
      [...boma.recommendations, ...irem.recommendations],
    ),
    sectionFor(
      'org-staffing',
      'Staffing & org design',
      `Doors/PM-FTE ${staffing.currentDoorsPerPmFte.toFixed(0)} vs target ${staffing.targetDoorsPerPmFte.toFixed(0)}; span-of-control flags: ${staffing.spanOfControlFlags.length}.`,
      staffing.recommendations,
    ),
    sectionFor(
      'vendor',
      'Vendor portfolio',
      `${vendors.concentrationByCategory.length} categories scanned; ${vendors.kpiBreaches.length} KPI breaches; ${vendors.contractMismatch.length} contract mismatches.`,
      vendors.recommendations,
    ),
    sectionFor(
      'risk-insurance',
      'Risk & insurance',
      `${risk.gaps.length} coverage gaps; captive ${risk.captiveRecommended ? 'recommended' : 'not yet economic'}; ${risk.catastropheExposures.length} CAT exposures flagged.`,
      risk.recommendations,
    ),
    sectionFor(
      'regulatory-compliance',
      `Regulatory calendar (next ${horizon}d)`,
      `${compliance.recommendations.length} filings within ${horizon}-day horizon across ${new Set(portfolio.properties.map((p) => p.jurisdiction)).size} jurisdiction(s).`,
      compliance.recommendations,
    ),
    sectionFor(
      'owner-relations',
      'Owner relations',
      `Archetype: ${portfolio.ownerArchetype}; cadence: ${commPatternFor(portfolio.ownerArchetype).cadence}.`,
      [],
    ),
  ];

  const allRecs = sections.flatMap((s) => s.recommendations);
  const topRecommendations = prioritizeRecommendations(allRecs).slice(0, 5);

  const headline: string[] = [];
  if (composition.hhiBand === 'concentrated' || composition.hhiBand === 'critically-concentrated') {
    headline.push(`Geographic concentration is the #1 risk — HHI ${composition.geographicHhi} (${composition.hhiBand}).`);
  } else {
    headline.push(`Portfolio diversification is acceptable — HHI ${composition.geographicHhi} (${composition.hhiBand}).`);
  }
  if (irem.percentileOer === 'P75' || irem.percentileOer === 'P90') {
    headline.push(`Operating-expense ratio is in the ${irem.percentileOer} band — controllable opex audit overdue.`);
  } else {
    headline.push(`OER at ${(irem.operatingExpenseRatio * 100).toFixed(0)}% — in the manageable band.`);
  }
  if (risk.gaps.length > 0) {
    headline.push(`Insurance has ${risk.gaps.length} coverage gap(s) — close before next renewal.`);
  } else {
    headline.push(`Insurance coverage is complete vs NAREIM 10-axis baseline.`);
  }

  return {
    tenantId: portfolio.tenantId,
    generatedAtMs: nowMs,
    headline,
    sections,
    topRecommendations,
  };
}

export async function buildDepartmentHealthReportWithNarrative(
  input: BuildReportWithNarrative,
): Promise<DepartmentHealthReport> {
  const base = buildDepartmentHealthReport(input);
  const narrative = await input.synthesizer.synthesize({
    tenantId: input.portfolio.tenantId,
    report: base,
    tone: input.tone ?? 'veteran-director',
  });
  return { ...base, narrative };
}
