import { describe, expect, it } from 'vitest';
import {
  createHrDispatch,
  recruiterToDispatchCandidate,
} from '../verticals/bossnyumba-internal/hr-dispatch.js';
import type {
  CandidateSubmission,
  RecruiterCandidate,
} from '../verticals/bossnyumba-internal/entities.js';
import type { DispatchTransportPort } from '../primitives/dispatch.js';
import { makeCtx } from './_helpers.js';

const pool: ReadonlyArray<RecruiterCandidate> = [
  {
    id: 'r-eng-1',
    displayName: 'Engineering Recruiter Aisha',
    roleFamily: 'engineering',
    bandwidth: 3,
    avgTimeToFirstScreenHours: 12,
  },
  {
    id: 'r-eng-2',
    displayName: 'Engineering Recruiter Brian',
    roleFamily: 'engineering',
    bandwidth: 0,
    avgTimeToFirstScreenHours: 8,
  },
  {
    id: 'r-sales-1',
    displayName: 'Sales Recruiter Carla',
    roleFamily: 'sales',
    bandwidth: 5,
    avgTimeToFirstScreenHours: 24,
  },
];

const transport: DispatchTransportPort<string> = {
  async send({ candidate }) {
    return { externalMessageId: `invite-${candidate.id}` };
  },
};

function candidate(family: CandidateSubmission['roleFamily']): CandidateSubmission {
  return {
    id: 'c-1',
    tenantId: 'tenant-1',
    fullName: 'Jane Doe',
    roleApplied: 'Senior Engineer',
    roleFamily: family,
    seniority: 'senior',
    cvSummary: '10 years backend',
    applicationAtMs: 1_700_000_000_000,
    source: 'inbound-application',
    yearsExperience: 10,
  };
}

describe('hr.dispatch.triage', () => {
  it('assigns to engineering recruiter with bandwidth', async () => {
    const sub = createHrDispatch({ pool, transport });
    const { ctx } = makeCtx();
    const r = await sub.triage.run({
      input: candidate('engineering'),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.label).toBe('auto-assigned');
    expect(r.output.recruiterPreferenceId).toBe('r-eng-1');
  });

  it('flags awaiting-pool-capacity when no bandwidth', async () => {
    const sub = createHrDispatch({
      pool: [
        {
          ...pool[0]!,
          bandwidth: 0,
        },
      ],
      transport,
    });
    const { ctx } = makeCtx();
    const r = await sub.triage.run({
      input: candidate('engineering'),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.label).toBe('awaiting-pool-capacity');
  });

  it('flags role-family-mismatch when no matching recruiter', async () => {
    const sub = createHrDispatch({ pool: pool.filter((p) => p.roleFamily === 'sales'), transport });
    const { ctx } = makeCtx();
    const r = await sub.triage.run({
      input: candidate('engineering'),
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.label).toBe('role-family-mismatch');
    expect(r.output.recruiterPreferenceId).toBe(null);
  });
});

describe('hr.dispatch.send', () => {
  it('prefers the triage-recommended recruiter when present', async () => {
    const sub = createHrDispatch({ pool, transport });
    const { ctx } = makeCtx({ mode: 'auto' });
    const triaged = await sub.triage.run({
      input: candidate('engineering'),
      inputTenantId: 'tenant-1',
      ctx,
    });
    const candidates = pool.map((p) => recruiterToDispatchCandidate(p, triaged.output));
    const dispatched = await sub.dispatch.run({
      classification: triaged.output,
      candidates,
      payload: {},
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(dispatched.output.chosen.id).toBe('r-eng-1');
  });

  it('falls back to top-scored when no recommendation', async () => {
    const sub = createHrDispatch({ pool, transport });
    const { ctx } = makeCtx({ mode: 'auto' });
    const fakeClass = {
      label: 'role-family-mismatch' as const,
      confidence: 0.5,
      rationale: '',
      recruiterPreferenceId: null,
      seniority: 'mid' as const,
      roleFamily: 'engineering' as const,
    };
    const candidates = pool.map((p) => recruiterToDispatchCandidate(p, fakeClass));
    const dispatched = await sub.dispatch.run({
      classification: fakeClass,
      candidates,
      payload: {},
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(dispatched.output.chosen.id).toBe(
      candidates.slice().sort((a, b) => b.score - a.score)[0]!.id,
    );
  });
});
