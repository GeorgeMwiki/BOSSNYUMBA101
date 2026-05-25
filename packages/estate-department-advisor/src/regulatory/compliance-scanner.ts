/**
 * compliance-scanner — per-property compliance gap surfacing.
 *
 * Looks at upcoming filings within a horizon and emits Recommendations
 * with severity tied to days-until-due.
 */

import type { PortfolioSnapshot, Recommendation, TenantId } from '../types.js';
import { upcomingFilings } from './jurisdictional-calendar.js';

export interface ComplianceScanInput {
  readonly portfolio: PortfolioSnapshot;
  readonly horizonDays: number;
  readonly nowMs: number;
}

export interface ComplianceScanReport {
  readonly tenantId: TenantId;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly citation: string;
}

export function scanCompliance(input: ComplianceScanInput): ComplianceScanReport {
  const jurisdictions = Array.from(
    new Set(input.portfolio.properties.map((p) => p.jurisdiction)),
  );
  const upcoming = upcomingFilings({
    jurisdictions,
    nowMs: input.nowMs,
    horizonDays: input.horizonDays,
  });
  const recs: Recommendation[] = upcoming.map((u) => {
    const severity =
      u.daysUntilDue <= 7
        ? 'critical'
        : u.daysUntilDue <= 30
          ? 'high'
          : u.daysUntilDue <= 60
            ? 'medium'
            : 'low';
    const strategic = severity === 'critical' ? 0.8 : severity === 'high' ? 0.65 : 0.5;
    const urgency = severity === 'critical' ? 0.9 : severity === 'high' ? 0.7 : 0.45;
    return {
      id: `comp.${u.entry.id}`,
      kind: 'regulatory-compliance',
      severity,
      headline: `${u.entry.jurisdiction} ${u.entry.filingName} due in ${u.daysUntilDue}d`,
      rationale: `${u.entry.authority} window closes in ${u.daysUntilDue} days per ${u.entry.citation}.`,
      citation: u.entry.citation,
      dueByMs: input.nowMs + u.daysUntilDue * 24 * 60 * 60 * 1000,
      strategicScore: strategic,
      urgencyScore: urgency,
      composite: 0.45 * strategic + 0.25 * urgency,
    };
  });
  return {
    tenantId: input.portfolio.tenantId,
    recommendations: recs,
    citation: 'Jurisdictional regulatory calendar — KE/TZ/UG/NG/RW/ZA + US',
  };
}
