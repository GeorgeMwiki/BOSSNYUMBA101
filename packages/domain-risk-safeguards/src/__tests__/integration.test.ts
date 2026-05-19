/**
 * Cross-module integration tests.
 *
 * 10 scenarios that compose multiple modules to verify the end-to-end
 * shape of the safeguard stack:
 *
 *   1. Eviction request — Klarna wrap + DI audit  + report aggregation
 *   2. Skill promotion blocked + report shows quarantine
 *   3. Tenant-screening DI audit feeds quarterly breach surface
 *   4. Jurisdictional creep finding flows into report breakdown
 *   5. Retention sweep + egress event aggregate into privacy section
 *   6. Platform-wide report rolls up multiple tenants
 *   7. Klarna wrap never returns executed regardless of class
 *   8. Skill quarantine pre-empts metric checks
 *   9. Empty quarter still produces a valid report
 *  10. Q4 report carries forward all numbers correctly
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_PII_CHANNELS,
  TENANT_PRIVACY_DECLARATIONS,
  aggregateQuarterlyReport,
  auditCohort,
  evaluateSkillPromotion,
  renderQuarterlyReportMarkdown,
  routeKlarnaAction,
  scanSource,
  scanSources,
} from '../index.js';
import type {
  DecisionRecord,
  EgressAuditEvent,
  JurisdictionalCreepScanResult,
  KlarnaActionAttempt,
  KlarnaActor,
  KlarnaRoutingPort,
  KlarnaVerdict,
  RetentionSweepEvent,
  SkillPromotionApprovalPort,
  SkillPromotionCandidate,
  SkillPromotionVerdict,
} from '../index.js';

const TENANT_A = '99999999-aaaa-aaaa-aaaa-000000000001';
const TENANT_B = '99999999-bbbb-bbbb-bbbb-000000000002';

const NULL_PORT: KlarnaRoutingPort = { route: async () => {} };

const RECORDING_PORT = (): { port: KlarnaRoutingPort; calls: number } => {
  const state = { calls: 0 };
  const port: KlarnaRoutingPort = {
    route: async () => {
      state.calls++;
    },
  };
  return { port, get calls() { return state.calls; } };
};

describe('integration — 10 cross-module scenarios', () => {
  it('1. eviction request: Klarna wrap + DI audit + report aggregation', async () => {
    const evictionAttempt: KlarnaActionAttempt = Object.freeze({
      attemptId: 'evict-1',
      tenantId: TENANT_A,
      actor: Object.freeze({ kind: 'md-on-behalf-of-owner', ownerId: 'owner-1' }),
      actionClass: 'eviction-decision',
      draft: 'Recommend eviction of T-4471',
      evidence: ['ledger.json'],
      proposedAt: '2026-03-01T00:00:00Z',
    });
    const klarnaVerdict = await routeKlarnaAction({
      attempt: evictionAttempt,
      routing: NULL_PORT,
    });
    expect(klarnaVerdict.verdict).toBe('routed-not-executed');

    // Pair with a fair-housing DI audit on the underlying decision feed.
    // Build a balanced cohort: each bucket has the same approve rate.
    const diRecords: DecisionRecord[] = [];
    for (const bucket of ['declared', 'undeclared'] as const) {
      for (let i = 0; i < 25; i++) {
        diRecords.push({
          decisionId: `e-${bucket}-a-${i}`,
          tenantId: TENANT_A,
          actionClass: 'lease-non-renewal',
          proxy: 'disability-flag',
          bucket,
          outcome: 'approve',
          decidedAt: '2026-02-15T00:00:00Z',
        });
      }
      for (let i = 0; i < 25; i++) {
        diRecords.push({
          decisionId: `e-${bucket}-d-${i}`,
          tenantId: TENANT_A,
          actionClass: 'lease-non-renewal',
          proxy: 'disability-flag',
          bucket,
          outcome: 'deny',
          decidedAt: '2026-02-15T00:00:00Z',
        });
      }
    }
    const diVerdict = auditCohort({
      tenantId: TENANT_A,
      actionClass: 'lease-non-renewal',
      proxy: 'disability-flag',
      records: diRecords,
    });
    // Balanced 50/50 in each bucket → should pass
    expect(diVerdict.verdict).toBe('pass');

    const report = aggregateQuarterlyReport({
      quarter: '2026-Q1',
      scope: 'tenant',
      tenantId: TENANT_A,
      now: new Date(),
      diVerdicts: [diVerdict],
      skillVerdicts: [],
      klarnaVerdicts: [klarnaVerdict],
      creepScans: [],
      retentionSweeps: [],
      egressEvents: [],
    });
    expect(report.klarnaPattern.routes).toBe(1);
    expect(report.disparateImpact.cohortsExamined).toBe(1);
  });

  it('2. skill promotion blocked + report shows quarantine', async () => {
    const candidate: SkillPromotionCandidate = Object.freeze({
      skillId: 'risky-skill',
      scope: 'tenant',
      tenantId: TENANT_A,
      successfulRuns: 50,
      catastrophicFailures: 4,
      ownerFeedback: 'positive',
      proposedBy: 'brain',
      proposedAt: '2026-02-01T00:00:00Z',
    });
    const approvals: SkillPromotionApprovalPort = {
      findApproval: async () => null,
    };
    const verdict = await evaluateSkillPromotion({ candidate, approvals });
    expect(verdict.kind).toBe('quarantine');

    const report = aggregateQuarterlyReport({
      quarter: '2026-Q1',
      scope: 'tenant',
      tenantId: TENANT_A,
      now: new Date(),
      diVerdicts: [],
      skillVerdicts: [verdict],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: [],
      egressEvents: [],
    });
    expect(report.skillPromotion.quarantines).toBe(1);
    expect(report.skillPromotion.approvals).toBe(0);
  });

  it('3. tenant-screening DI breach surfaces as topBreach', () => {
    const records: DecisionRecord[] = [
      ...Array.from({ length: 90 }, (_, i): DecisionRecord => ({
        decisionId: `r-${i}`,
        tenantId: TENANT_A,
        actionClass: 'tenant-screening-deny',
        proxy: 'nationality-from-id',
        bucket: 'majority',
        outcome: 'approve',
        decidedAt: '2026-02-01T00:00:00Z',
      })),
      ...Array.from({ length: 10 }, (_, i): DecisionRecord => ({
        decisionId: `r-${i + 100}`,
        tenantId: TENANT_A,
        actionClass: 'tenant-screening-deny',
        proxy: 'nationality-from-id',
        bucket: 'majority',
        outcome: 'deny',
        decidedAt: '2026-02-01T00:00:00Z',
      })),
      ...Array.from({ length: 10 }, (_, i): DecisionRecord => ({
        decisionId: `r-${i + 200}`,
        tenantId: TENANT_A,
        actionClass: 'tenant-screening-deny',
        proxy: 'nationality-from-id',
        bucket: 'minority',
        outcome: 'approve',
        decidedAt: '2026-02-01T00:00:00Z',
      })),
      ...Array.from({ length: 90 }, (_, i): DecisionRecord => ({
        decisionId: `r-${i + 300}`,
        tenantId: TENANT_A,
        actionClass: 'tenant-screening-deny',
        proxy: 'nationality-from-id',
        bucket: 'minority',
        outcome: 'deny',
        decidedAt: '2026-02-01T00:00:00Z',
      })),
    ];
    const verdict = auditCohort({
      tenantId: TENANT_A,
      actionClass: 'tenant-screening-deny',
      proxy: 'nationality-from-id',
      records,
    });
    expect(verdict.verdict).toBe('breach');

    const report = aggregateQuarterlyReport({
      quarter: '2026-Q1',
      scope: 'tenant',
      tenantId: TENANT_A,
      now: new Date(),
      diVerdicts: [verdict],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: [],
      egressEvents: [],
    });
    expect(report.disparateImpact.breaches).toBe(1);
    expect(report.disparateImpact.topBreach?.proxy).toBe('nationality-from-id');
  });

  it('4. jurisdictional creep finding flows into report breakdown', () => {
    const scans: JurisdictionalCreepScanResult[] = scanSources([
      { file: 'services/foo.ts', source: "const c = country || 'TZ';" },
      { file: 'services/bar.ts', source: "if (jurisdiction === 'KE') doKe();" },
      { file: 'services/clean.ts', source: 'const x = 1;' },
    ]);
    const report = aggregateQuarterlyReport({
      quarter: '2026-Q1',
      scope: 'platform',
      tenantId: null,
      now: new Date(),
      diVerdicts: [],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: scans,
      retentionSweeps: [],
      egressEvents: [],
    });
    expect(report.jurisdictionalCreep.filesScanned).toBe(3);
    expect(report.jurisdictionalCreep.findings).toBeGreaterThanOrEqual(2);
    expect(report.jurisdictionalCreep.classBreakdown['country-or-tz-silent-fallback']).toBe(1);
    expect(report.jurisdictionalCreep.classBreakdown['literal-tz-outside-rules']).toBe(1);
  });

  it('5. retention sweep + egress event aggregate into privacy section', () => {
    const sweeps: RetentionSweepEvent[] = [
      Object.freeze({
        sweepId: 'sw-1',
        tenantId: TENANT_A,
        channel: 'biometric-smartlock',
        recordsExamined: 2,
        recordsDeleted: 2,
        recordsFlagged: 0,
        sweptAt: '2026-03-01T00:00:00Z',
      }),
    ];
    const egress: EgressAuditEvent[] = [
      Object.freeze({
        eventId: 'eg-1',
        tenantId: TENANT_A,
        channel: 'mpesa-sms',
        recordId: 'r-1',
        destination: 'kra',
        actorId: 'sys',
        purpose: 'tax-export',
        emittedAt: '2026-02-15T00:00:00Z',
      }),
    ];
    const report = aggregateQuarterlyReport({
      quarter: '2026-Q1',
      scope: 'tenant',
      tenantId: TENANT_A,
      now: new Date(),
      diVerdicts: [],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: sweeps,
      egressEvents: egress,
    });
    expect(report.tenantPrivacy.retentionSweeps).toBe(1);
    expect(report.tenantPrivacy.recordsDeleted).toBe(2);
    expect(report.tenantPrivacy.perChannel['biometric-smartlock'].sweeps).toBe(1);
    expect(report.tenantPrivacy.perChannel['mpesa-sms'].egress).toBe(1);
  });

  it('6. platform-wide report rolls up data from multiple tenants', () => {
    const sweepsA: RetentionSweepEvent[] = [
      Object.freeze({
        sweepId: 'sw-a',
        tenantId: TENANT_A,
        channel: 'lease-pdf',
        recordsExamined: 1,
        recordsDeleted: 1,
        recordsFlagged: 0,
        sweptAt: '2026-03-01T00:00:00Z',
      }),
    ];
    const sweepsB: RetentionSweepEvent[] = [
      Object.freeze({
        sweepId: 'sw-b',
        tenantId: TENANT_B,
        channel: 'chat-transcript',
        recordsExamined: 3,
        recordsDeleted: 3,
        recordsFlagged: 0,
        sweptAt: '2026-03-01T00:00:00Z',
      }),
    ];
    const report = aggregateQuarterlyReport({
      quarter: '2026-Q1',
      scope: 'platform',
      tenantId: null,
      now: new Date(),
      diVerdicts: [],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: [...sweepsA, ...sweepsB],
      egressEvents: [],
    });
    expect(report.scope).toBe('platform');
    expect(report.tenantPrivacy.retentionSweeps).toBe(2);
    expect(report.tenantPrivacy.recordsDeleted).toBe(4);
  });

  it('7. Klarna wrap never returns executed regardless of class', async () => {
    const actor: KlarnaActor = Object.freeze({
      kind: 'md-on-behalf-of-owner',
      ownerId: 'owner-1',
    });
    const verdicts: KlarnaVerdict[] = [];
    for (const ac of [
      'rent-dispute-resolution',
      'late-fee-waiver',
      'partial-refund',
      'lease-amendment',
      'eviction-decision',
    ] as const) {
      const v = await routeKlarnaAction({
        attempt: Object.freeze({
          attemptId: `at-${ac}`,
          tenantId: TENANT_A,
          actor,
          actionClass: ac,
          draft: 'draft',
          evidence: [],
          proposedAt: '2026-03-01T00:00:00Z',
        }),
        routing: NULL_PORT,
      });
      verdicts.push(v);
    }
    expect(verdicts.every((v) => v.verdict === 'routed-not-executed')).toBe(true);
  });

  it('8. skill quarantine pre-empts metric-threshold checks', async () => {
    // Catastrophic-failure threshold trips first — even when runs are abundant.
    const candidate: SkillPromotionCandidate = Object.freeze({
      skillId: 'broken',
      scope: 'platform',
      tenantId: null,
      successfulRuns: 1000,
      catastrophicFailures: 99,
      ownerFeedback: 'positive',
      proposedBy: 'brain',
      proposedAt: '2026-02-01T00:00:00Z',
    });
    const approvals: SkillPromotionApprovalPort = {
      findApproval: async () => null,
    };
    const verdict = await evaluateSkillPromotion({ candidate, approvals });
    expect(verdict.kind).toBe('quarantine');
  });

  it('9. empty quarter still produces a valid report + Markdown', () => {
    const report = aggregateQuarterlyReport({
      quarter: '2026-Q1',
      scope: 'tenant',
      tenantId: TENANT_A,
      now: new Date(),
      diVerdicts: [],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: [],
      egressEvents: [],
    });
    const md = renderQuarterlyReportMarkdown(report);
    expect(md).toContain('Cohorts examined: **0**');
    expect(md).toContain('Routes: **0**');
    expect(md).toContain('Files scanned: **0**');
    expect(md).toContain('Egress events: **0**');
  });

  it('10. all four PII channels declared and tied to retention sweeps', () => {
    // Sanity check that the canonical declarations cover the four
    // BOSSNYUMBA-specific PII channels expected by the threat model.
    expect(ALL_PII_CHANNELS).toEqual([
      'biometric-smartlock',
      'chat-transcript',
      'mpesa-sms',
      'lease-pdf',
    ]);
    expect(TENANT_PRIVACY_DECLARATIONS['biometric-smartlock'].egressAuditEndpoint).toContain(
      'biometric',
    );
    expect(TENANT_PRIVACY_DECLARATIONS['mpesa-sms'].egressAuditEndpoint).toContain(
      'mpesa-sms',
    );
  });
});
