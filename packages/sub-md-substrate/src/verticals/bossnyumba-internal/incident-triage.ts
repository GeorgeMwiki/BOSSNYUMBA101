/**
 * incident.triage — Triage<OpsIncident, OncallTeam>
 *
 * BOSSNYUMBA-ops incident routing. When monitoring fires (error-rate
 * spike, p95 latency breach, multi-tenant correlated outage), this
 * sub-MD picks the right on-call team + severity.
 *
 * Severity ladder:
 *   - SEV0   multi-surface outage OR >100 tenants affected
 *   - SEV1   single surface, >10 tenants OR error-rate > 5%
 *   - SEV2   single surface, <=10 tenants, error-rate > 1%
 *   - SEV3   degradation only (latency creep, low error-rate)
 *
 * The MD then runs a separate Dispatch<Sev,Oncall> to actually page
 * (PagerDuty, Slack, voice). This sub-MD only triages.
 */

import {
  createTriage,
  type TriageClassification,
  type TriagePrimitive,
  type TriageStrategy,
} from '../../primitives/triage.js';
import type { IncidentSurface, OncallTeamMember, OpsIncident } from './entities.js';

export type IncidentSeverity = 'sev0' | 'sev1' | 'sev2' | 'sev3';

export interface IncidentClassification extends TriageClassification<IncidentSeverity> {
  readonly surface: IncidentSurface;
  readonly recommendedOncallId: string | null;
  readonly affectedTenantCount: number;
}

export interface IncidentTriageOptions {
  readonly pool: ReadonlyArray<OncallTeamMember>;
  /** Error-rate threshold for SEV1. Defaults 0.05 (5%). */
  readonly sev1ErrorRate?: number;
  /** Error-rate threshold for SEV2. Defaults 0.01 (1%). */
  readonly sev2ErrorRate?: number;
}

export function createIncidentTriageStrategy(
  opts: IncidentTriageOptions,
): TriageStrategy<OpsIncident, IncidentClassification> {
  const sev1Err = opts.sev1ErrorRate ?? 0.05;
  const sev2Err = opts.sev2ErrorRate ?? 0.01;

  return {
    async classify({ input }) {
      const errorRate = input.errorRate ?? 0;
      let severity: IncidentSeverity;
      let rationale: string;

      if (input.affectedTenantCount > 100) {
        severity = 'sev0';
        rationale = `>100 tenants affected (${input.affectedTenantCount})`;
      } else if (input.affectedTenantCount > 10 || errorRate > sev1Err) {
        severity = 'sev1';
        rationale =
          input.affectedTenantCount > 10
            ? `>10 tenants affected (${input.affectedTenantCount})`
            : `error rate ${(errorRate * 100).toFixed(1)}% > ${(sev1Err * 100).toFixed(0)}%`;
      } else if (errorRate > sev2Err) {
        severity = 'sev2';
        rationale = `error rate ${(errorRate * 100).toFixed(1)}% > ${(sev2Err * 100).toFixed(0)}%`;
      } else {
        severity = 'sev3';
        rationale = `low impact (err ${(errorRate * 100).toFixed(2)}%, ${input.affectedTenantCount} tenants)`;
      }

      // Find an on-call team covering this surface with bandwidth.
      const matching = opts.pool.filter((m) => m.surfaces.includes(input.surface));
      const withBandwidth = matching.filter((m) => m.currentPagedCount < m.bandwidth);
      const recommended =
        withBandwidth.length > 0
          ? [...withBandwidth].sort((a, b) => a.currentPagedCount - b.currentPagedCount)[0]!
          : matching[0];
      const recommendedId = recommended ? recommended.id : null;

      const confidence =
        severity === 'sev0' ? 0.95 : severity === 'sev1' ? 0.88 : severity === 'sev2' ? 0.8 : 0.7;

      return {
        label: severity,
        confidence,
        rationale,
        surface: input.surface,
        recommendedOncallId: recommendedId,
        affectedTenantCount: input.affectedTenantCount,
        ...(recommendedId !== null ? { routeHint: recommendedId } : {}),
      };
    },
  };
}

export interface IncidentTriageSubMd {
  readonly name: string;
  readonly triage: TriagePrimitive<OpsIncident, IncidentClassification>;
}

export function createIncidentTriage(opts: IncidentTriageOptions): IncidentTriageSubMd {
  return Object.freeze({
    name: 'incident.triage',
    triage: createTriage({
      name: 'incident.triage.classify',
      strategy: createIncidentTriageStrategy(opts),
      minConfidenceForAuto: 0.85,
    }),
  });
}
