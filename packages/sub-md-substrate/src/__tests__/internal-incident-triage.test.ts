import { describe, expect, it } from 'vitest';
import { createIncidentTriage } from '../verticals/bossnyumba-internal/incident-triage.js';
import type {
  OncallTeamMember,
  OpsIncident,
} from '../verticals/bossnyumba-internal/entities.js';
import { makeCtx } from './_helpers.js';

const pool: ReadonlyArray<OncallTeamMember> = [
  {
    id: 'oc-api',
    displayName: 'API On-call',
    surfaces: ['api-gateway', 'central-intelligence'],
    currentPagedCount: 1,
    bandwidth: 3,
  },
  {
    id: 'oc-data',
    displayName: 'Data On-call',
    surfaces: ['database'],
    currentPagedCount: 0,
    bandwidth: 2,
  },
];

function incident(extra: Partial<OpsIncident> = {}): OpsIncident {
  return {
    id: 'inc-1',
    tenantId: 'tenant-1',
    surface: 'api-gateway',
    observedAtMs: 1_700_000_000_000,
    alertText: 'error rate spike',
    errorRate: 0.005,
    latencyP95Ms: 200,
    affectedTenantCount: 5,
    ...extra,
  };
}

describe('incident.triage', () => {
  it('flags >100 tenants as SEV0', async () => {
    const sub = createIncidentTriage({ pool });
    const { ctx } = makeCtx({ mode: 'auto' });
    const r = await sub.triage.run({
      input: incident({ affectedTenantCount: 250 }),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.label).toBe('sev0');
  });

  it('flags >10 tenants OR >5% error-rate as SEV1', async () => {
    const sub = createIncidentTriage({ pool });
    const { ctx } = makeCtx({ mode: 'auto' });
    const a = await sub.triage.run({
      input: incident({ affectedTenantCount: 25 }),
      inputTenantId: 'tenant-1',
      ctx,
    });
    const b = await sub.triage.run({
      input: incident({ errorRate: 0.08 }),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(a.output.label).toBe('sev1');
    expect(b.output.label).toBe('sev1');
  });

  it('flags >1% error-rate as SEV2', async () => {
    const sub = createIncidentTriage({ pool });
    const { ctx } = makeCtx({ mode: 'auto' });
    const r = await sub.triage.run({
      input: incident({ errorRate: 0.02 }),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.label).toBe('sev2');
  });

  it('defaults to SEV3 for low impact', async () => {
    const sub = createIncidentTriage({ pool });
    const { ctx } = makeCtx({ mode: 'auto' });
    const r = await sub.triage.run({
      input: incident({ errorRate: 0.001, affectedTenantCount: 2 }),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.label).toBe('sev3');
  });

  it('routes to an on-call with bandwidth and surface coverage', async () => {
    const sub = createIncidentTriage({ pool });
    const { ctx } = makeCtx({ mode: 'auto' });
    const r = await sub.triage.run({
      input: incident({ surface: 'database' }),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.recommendedOncallId).toBe('oc-data');
  });

  it('returns null oncall when no team covers the surface', async () => {
    const sub = createIncidentTriage({ pool });
    const { ctx } = makeCtx({ mode: 'auto' });
    const r = await sub.triage.run({
      input: incident({ surface: 'connectors' }),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.recommendedOncallId).toBe(null);
  });
});
