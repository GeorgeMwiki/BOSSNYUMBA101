/**
 * Quarterly compliance report tests.
 *
 * Full report generation against curated mock inputs covering every
 * module's surfaces. Plus integration test that composes the six
 * modules' outputs into one Markdown.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateQuarterlyReport,
  renderQuarterlyReportMarkdown,
  reportFilename,
} from '../quarterly-report/index.js';
import { auditCohort } from '../disparate-impact/index.js';
import { routeKlarnaAction } from '../klarna-pattern/index.js';
import { scanSource } from '../jurisdictional-scanner/index.js';
import type {
  DisparateImpactVerdict,
  EgressAuditEvent,
  JurisdictionalCreepScanResult,
  KlarnaActionAttempt,
  KlarnaVerdict,
  QuarterId,
  RetentionSweepEvent,
  SkillPromotionVerdict,
} from '../types.js';

const TENANT = '55555555-5555-5555-5555-555555555555';
const QUARTER: QuarterId = '2026-Q1';

function makeDiVerdicts(): DisparateImpactVerdict[] {
  // 1 pass + 1 breach.
  // Build a truly balanced cohort: each bucket has the SAME approve rate.
  const passRecords = [
    ...Array.from({ length: 25 }, (_, i) => ({
      decisionId: `d-A-a-${i}`,
      tenantId: TENANT,
      actionClass: 'tenant-screening-approve' as const,
      proxy: 'age-bucket' as const,
      bucket: 'A',
      outcome: 'approve' as const,
      decidedAt: '2026-01-15T00:00:00Z',
    })),
    ...Array.from({ length: 25 }, (_, i) => ({
      decisionId: `d-A-d-${i}`,
      tenantId: TENANT,
      actionClass: 'tenant-screening-approve' as const,
      proxy: 'age-bucket' as const,
      bucket: 'A',
      outcome: 'deny' as const,
      decidedAt: '2026-01-15T00:00:00Z',
    })),
    ...Array.from({ length: 25 }, (_, i) => ({
      decisionId: `d-B-a-${i}`,
      tenantId: TENANT,
      actionClass: 'tenant-screening-approve' as const,
      proxy: 'age-bucket' as const,
      bucket: 'B',
      outcome: 'approve' as const,
      decidedAt: '2026-01-15T00:00:00Z',
    })),
    ...Array.from({ length: 25 }, (_, i) => ({
      decisionId: `d-B-d-${i}`,
      tenantId: TENANT,
      actionClass: 'tenant-screening-approve' as const,
      proxy: 'age-bucket' as const,
      bucket: 'B',
      outcome: 'deny' as const,
      decidedAt: '2026-01-15T00:00:00Z',
    })),
  ];
  const passVerdict = auditCohort({
    tenantId: TENANT,
    actionClass: 'tenant-screening-approve',
    proxy: 'age-bucket',
    records: passRecords,
  });

  const breachRecords = [
    ...Array.from({ length: 90 }, (_, i) => ({
      decisionId: `dx-a-${i}`,
      tenantId: TENANT,
      actionClass: 'tenant-screening-deny' as const,
      proxy: 'gender-from-name' as const,
      bucket: 'A',
      outcome: 'approve' as const,
      decidedAt: '2026-02-01T00:00:00Z',
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      decisionId: `dx-a2-${i}`,
      tenantId: TENANT,
      actionClass: 'tenant-screening-deny' as const,
      proxy: 'gender-from-name' as const,
      bucket: 'A',
      outcome: 'deny' as const,
      decidedAt: '2026-02-01T00:00:00Z',
    })),
    ...Array.from({ length: 30 }, (_, i) => ({
      decisionId: `dx-b-${i}`,
      tenantId: TENANT,
      actionClass: 'tenant-screening-deny' as const,
      proxy: 'gender-from-name' as const,
      bucket: 'B',
      outcome: 'approve' as const,
      decidedAt: '2026-02-01T00:00:00Z',
    })),
    ...Array.from({ length: 70 }, (_, i) => ({
      decisionId: `dx-b2-${i}`,
      tenantId: TENANT,
      actionClass: 'tenant-screening-deny' as const,
      proxy: 'gender-from-name' as const,
      bucket: 'B',
      outcome: 'deny' as const,
      decidedAt: '2026-02-01T00:00:00Z',
    })),
  ];
  const breachVerdict = auditCohort({
    tenantId: TENANT,
    actionClass: 'tenant-screening-deny',
    proxy: 'gender-from-name',
    records: breachRecords,
  });

  return [passVerdict, breachVerdict];
}

function makeSkillVerdicts(): SkillPromotionVerdict[] {
  return [
    Object.freeze({
      kind: 'approve',
      skillId: 's-1',
      approval: Object.freeze({
        approverId: 'a-1',
        approverRole: 'tenant-owner',
        approverScope: 'tenant',
        approvedAt: '2026-02-01T00:00:00Z',
        approvalNote: 'ok',
      }),
    }),
    Object.freeze({
      kind: 'deny-metric-threshold',
      skillId: 's-2',
      reason: 'insufficient runs',
    }),
    Object.freeze({
      kind: 'quarantine',
      skillId: 's-3',
      reason: 'too many failures',
    }),
  ];
}

async function makeKlarnaVerdicts(): Promise<KlarnaVerdict[]> {
  const port = { route: async () => {} };
  const attempt = (idx: number): KlarnaActionAttempt =>
    Object.freeze({
      attemptId: `at-${idx}`,
      tenantId: TENANT,
      actor: Object.freeze({ kind: 'md-on-behalf-of-owner', ownerId: 'owner-1' }),
      actionClass: 'late-fee-waiver',
      draft: 'Waive Jane Doe Q1 late fees',
      evidence: [],
      proposedAt: '2026-02-15T00:00:00Z',
    });
  const out: KlarnaVerdict[] = [];
  for (let i = 0; i < 3; i++) {
    out.push(await routeKlarnaAction({ attempt: attempt(i), routing: port }));
  }
  return out;
}

function makeCreepScans(): JurisdictionalCreepScanResult[] {
  return [
    scanSource({
      file: 'services/foo.ts',
      source: 'const c = country || "TZ";',
    }),
    scanSource({
      file: 'services/bar.ts',
      source: 'if (jurisdiction === "KE") doKe();',
    }),
    scanSource({
      file: 'services/baz.ts',
      source: 'const x = 1;',
    }),
  ];
}

function makeSweeps(): RetentionSweepEvent[] {
  return [
    Object.freeze({
      sweepId: 'sw-1',
      tenantId: TENANT,
      channel: 'biometric-smartlock',
      recordsExamined: 3,
      recordsDeleted: 3,
      recordsFlagged: 0,
      sweptAt: '2026-03-01T00:00:00Z',
    }),
    Object.freeze({
      sweepId: 'sw-2',
      tenantId: TENANT,
      channel: 'chat-transcript',
      recordsExamined: 5,
      recordsDeleted: 5,
      recordsFlagged: 0,
      sweptAt: '2026-03-01T00:00:00Z',
    }),
    Object.freeze({
      sweepId: 'sw-3',
      tenantId: TENANT,
      channel: 'lease-pdf',
      recordsExamined: 1,
      recordsDeleted: 1,
      recordsFlagged: 0,
      sweptAt: '2026-03-01T00:00:00Z',
    }),
  ];
}

function makeEgress(): EgressAuditEvent[] {
  return [
    Object.freeze({
      eventId: 'e-1',
      tenantId: TENANT,
      channel: 'mpesa-sms',
      recordId: 'r-1',
      destination: 'kra-mri',
      actorId: 'sys-tax',
      purpose: 'quarterly-export',
      emittedAt: '2026-02-28T00:00:00Z',
    }),
    Object.freeze({
      eventId: 'e-2',
      tenantId: TENANT,
      channel: 'lease-pdf',
      recordId: 'r-2',
      destination: 'legal-court',
      actorId: 'legal-1',
      purpose: 'court-order',
      emittedAt: '2026-03-15T00:00:00Z',
    }),
  ];
}

describe('quarterly-report — aggregator structure', () => {
  it('composes all 5 module outputs into a single report', async () => {
    const report = aggregateQuarterlyReport({
      quarter: QUARTER,
      scope: 'tenant',
      tenantId: TENANT,
      now: new Date('2026-04-01T00:00:00Z'),
      diVerdicts: makeDiVerdicts(),
      skillVerdicts: makeSkillVerdicts(),
      klarnaVerdicts: await makeKlarnaVerdicts(),
      creepScans: makeCreepScans(),
      retentionSweeps: makeSweeps(),
      egressEvents: makeEgress(),
    });

    expect(report.quarter).toBe(QUARTER);
    expect(report.scope).toBe('tenant');
    expect(report.tenantId).toBe(TENANT);

    // Disparate-impact
    expect(report.disparateImpact.cohortsExamined).toBe(2);
    expect(report.disparateImpact.breaches).toBe(1);
    expect(report.disparateImpact.topBreach?.actionClass).toBe('tenant-screening-deny');

    // Skill-promotion
    expect(report.skillPromotion.proposals).toBe(3);
    expect(report.skillPromotion.approvals).toBe(1);
    expect(report.skillPromotion.denials).toBe(1);
    expect(report.skillPromotion.quarantines).toBe(1);

    // Klarna
    expect(report.klarnaPattern.routes).toBe(3);
    expect(report.klarnaPattern.executes).toBe(0);

    // Jurisdictional creep
    expect(report.jurisdictionalCreep.filesScanned).toBe(3);
    expect(report.jurisdictionalCreep.findings).toBeGreaterThanOrEqual(2);
    expect(report.jurisdictionalCreep.classBreakdown['country-or-tz-silent-fallback']).toBeGreaterThanOrEqual(1);
    expect(report.jurisdictionalCreep.classBreakdown['literal-tz-outside-rules']).toBeGreaterThanOrEqual(1);

    // Privacy
    expect(report.tenantPrivacy.retentionSweeps).toBe(3);
    expect(report.tenantPrivacy.recordsDeleted).toBe(9);
    expect(report.tenantPrivacy.egressAudits).toBe(2);
    expect(report.tenantPrivacy.perChannel['biometric-smartlock'].sweeps).toBe(1);
    expect(report.tenantPrivacy.perChannel['mpesa-sms'].egress).toBe(1);
  });

  it('platform-wide report has scope=platform, tenantId=null', async () => {
    const report = aggregateQuarterlyReport({
      quarter: QUARTER,
      scope: 'platform',
      tenantId: null,
      now: new Date('2026-04-01T00:00:00Z'),
      diVerdicts: [],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: [],
      egressEvents: [],
    });
    expect(report.scope).toBe('platform');
    expect(report.tenantId).toBe(null);
  });
});

describe('quarterly-report — Markdown renderer', () => {
  it('produces valid Markdown with all 5 sections', async () => {
    const report = aggregateQuarterlyReport({
      quarter: QUARTER,
      scope: 'tenant',
      tenantId: TENANT,
      now: new Date('2026-04-01T00:00:00Z'),
      diVerdicts: makeDiVerdicts(),
      skillVerdicts: makeSkillVerdicts(),
      klarnaVerdicts: await makeKlarnaVerdicts(),
      creepScans: makeCreepScans(),
      retentionSweeps: makeSweeps(),
      egressEvents: makeEgress(),
    });
    const md = renderQuarterlyReportMarkdown(report);
    expect(md).toMatch(/# Quarterly Compliance Report — 2026-Q1/);
    expect(md).toContain('## 1. Disparate-Impact Audit');
    expect(md).toContain('## 2. Skill-Promotion HARD Gate');
    expect(md).toContain('## 3. Klarna-Pattern');
    expect(md).toContain('## 4. Jurisdictional-Creep Class Scanner');
    expect(md).toContain('## 5. Tenant-Privacy');
    expect(md).toContain('Top concern / breach');
  });

  it('surfaces Klarna breach when executes > 0', () => {
    // We can't actually have executes > 0 through normal flow, but if
    // someone bypassed the wrap and the surrounding monitor counts an
    // execute, the renderer must show it as a breach.
    const report = aggregateQuarterlyReport({
      quarter: QUARTER,
      scope: 'platform',
      tenantId: null,
      now: new Date('2026-04-01T00:00:00Z'),
      diVerdicts: [],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: [],
      egressEvents: [],
    });
    // Simulate via cast — the audit-monitor would inject this value.
    const surgicalReport = Object.freeze({
      ...report,
      klarnaPattern: { routes: 0, executes: 1 },
    });
    const md = renderQuarterlyReportMarkdown(surgicalReport);
    expect(md).toContain('BREACH — Klarna-pattern wrap was bypassed');
  });
});

describe('quarterly-report — filename convention', () => {
  it('tenant report file', () => {
    const report = aggregateQuarterlyReport({
      quarter: '2026-Q2',
      scope: 'tenant',
      tenantId: TENANT,
      now: new Date(),
      diVerdicts: [],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: [],
      egressEvents: [],
    });
    expect(reportFilename(report)).toBe(`2026-Q2-${TENANT}.md`);
  });

  it('platform report file', () => {
    const report = aggregateQuarterlyReport({
      quarter: '2026-Q3',
      scope: 'platform',
      tenantId: null,
      now: new Date(),
      diVerdicts: [],
      skillVerdicts: [],
      klarnaVerdicts: [],
      creepScans: [],
      retentionSweeps: [],
      egressEvents: [],
    });
    expect(reportFilename(report)).toBe('2026-Q3-platform.md');
  });
});
