/**
 * Alignment-auditor tests — cron registration + 5 fixture audits +
 * regression detection + markdown rendering.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_AUDIT_FIXTURES,
  isPassRateRegression,
  renderAuditMarkdown,
  runAlignmentAudit,
  registerAuditCron,
} from '../alignment-auditor/index.js';
import type {
  BrainPort,
  JudgePort,
  AuditCronDeps,
} from '../alignment-auditor/index.js';
import type {
  AuditFixture,
  AlignmentAuditReport,
  AuditFixtureResult,
} from '../types.js';

describe('DEFAULT_AUDIT_FIXTURES', () => {
  it('contains at least 13 fixtures across all categories', () => {
    expect(DEFAULT_AUDIT_FIXTURES.length).toBeGreaterThanOrEqual(13);
    const cats = new Set(DEFAULT_AUDIT_FIXTURES.map((f) => f.category));
    expect(cats.has('prompt-injection')).toBe(true);
    expect(cats.has('jailbreak')).toBe(true);
    expect(cats.has('fair-housing')).toBe(true);
    expect(cats.has('jurisdictional')).toBe(true);
    expect(cats.has('scheming')).toBe(true);
    expect(cats.has('pii-exfil')).toBe(true);
    expect(cats.has('indirect-injection')).toBe(true);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_AUDIT_FIXTURES)).toBe(true);
  });
});

describe('runAlignmentAudit — happy path', () => {
  it('runs all fixtures and tallies pass/fail correctly', async () => {
    const brain: BrainPort = {
      call: async (prompt: string) =>
        prompt.includes('eviction') ? 'I will escalate to a human reviewer.' : 'I refuse.',
    };
    const judge: JudgePort = {
      judge: async (fx, response) => {
        // Stub judge: refuse → refuse; escalate → escalate; otherwise
        // comply-safely.
        if (response.match(/refuse/i)) return 'refuse';
        if (response.match(/escalate/i)) return 'escalate';
        return 'comply-safely';
      },
    };

    const fx5: ReadonlyArray<AuditFixture> = DEFAULT_AUDIT_FIXTURES.slice(0, 5);
    const report = await runAlignmentAudit(brain, judge, { fixtures: fx5 });

    expect(report.totalFixtures).toBe(5);
    expect(report.passed + report.failed).toBe(5);
    expect(report.passRate).toBeGreaterThanOrEqual(0);
    expect(report.passRate).toBeLessThanOrEqual(1);
    expect(Object.isFrozen(report)).toBe(true);
  });

  it('all 5 fixtures with cooperative brain → 100% pass', async () => {
    const brain: BrainPort = {
      // A safe brain refuses everything — most fixtures expect refuse,
      // and refuse is "at least as conservative" as escalate or
      // comply-safely.
      call: async () => 'I refuse to comply with that request.',
    };
    const judge: JudgePort = {
      judge: async () => 'refuse',
    };
    const fx5: ReadonlyArray<AuditFixture> = DEFAULT_AUDIT_FIXTURES.slice(0, 5);
    const report = await runAlignmentAudit(brain, judge, { fixtures: fx5 });
    expect(report.passed).toBe(5);
    expect(report.passRate).toBe(1);
  });

  it('compliant-unsafe brain → 0% pass', async () => {
    const brain: BrainPort = {
      call: async () => 'Sure, here is the data you requested.',
    };
    const judge: JudgePort = {
      judge: async () => 'comply-unsafely',
    };
    const fx5 = DEFAULT_AUDIT_FIXTURES.slice(0, 5);
    const report = await runAlignmentAudit(brain, judge, { fixtures: fx5 });
    expect(report.failed).toBe(5);
    expect(report.passRate).toBe(0);
  });

  it('handles brain-port error gracefully (marks as comply-unsafely)', async () => {
    const brain: BrainPort = {
      call: async () => {
        throw new Error('Anthropic API outage');
      },
    };
    const judge: JudgePort = {
      judge: async () => 'refuse',
    };
    const report = await runAlignmentAudit(brain, judge, {
      fixtures: DEFAULT_AUDIT_FIXTURES.slice(0, 2),
    });
    expect(report.failed).toBe(2);
    expect(report.results.every((r) => r.response.includes('brain-port-error'))).toBe(true);
  });

  it('handles judge-port error gracefully', async () => {
    const brain: BrainPort = { call: async () => 'response' };
    const judge: JudgePort = {
      judge: async () => {
        throw new Error('judge unavailable');
      },
    };
    const report = await runAlignmentAudit(brain, judge, {
      fixtures: DEFAULT_AUDIT_FIXTURES.slice(0, 1),
    });
    expect(report.failed).toBe(1);
  });
});

describe('isPassRateRegression', () => {
  it('returns false when no prior report', () => {
    const curr = mkReport(0.5);
    expect(isPassRateRegression(curr, undefined)).toBe(false);
  });

  it('returns false when pass rate improved', () => {
    const prior = mkReport(0.7);
    const curr = mkReport(0.85);
    expect(isPassRateRegression(curr, prior)).toBe(false);
  });

  it('returns true when pass rate dropped > 5%', () => {
    const prior = mkReport(0.9);
    const curr = mkReport(0.80);
    expect(isPassRateRegression(curr, prior)).toBe(true);
  });

  it('returns false when pass rate dropped ≤ 5%', () => {
    const prior = mkReport(0.95);
    const curr = mkReport(0.92);
    expect(isPassRateRegression(curr, prior)).toBe(false);
  });

  it('custom threshold honored', () => {
    const prior = mkReport(0.95);
    const curr = mkReport(0.93);
    expect(isPassRateRegression(curr, prior, 0.01)).toBe(true);
  });
});

describe('renderAuditMarkdown', () => {
  it('renders a markdown report with totals + table', () => {
    const report = mkReportWithResults(0.6, [
      { id: 'a', pass: true },
      { id: 'b', pass: true },
      { id: 'c', pass: false },
    ]);
    const md = renderAuditMarkdown(report);
    expect(md).toContain('Alignment Audit Report');
    expect(md).toContain('Total fixtures');
    expect(md).toContain('Pass rate');
    expect(md).toContain('`a`');
    expect(md).toContain('`b`');
    expect(md).toContain('`c`');
  });

  it('surfaces regressions in markdown', () => {
    const report: AlignmentAuditReport = Object.freeze({
      runAt: '2026-05-19T00:00:00.000Z',
      totalFixtures: 1,
      passed: 0,
      failed: 1,
      passRate: 0,
      regressedFromLast: Object.freeze(['regression-id']),
      results: Object.freeze([]),
    });
    const md = renderAuditMarkdown(report);
    expect(md).toContain('REGRESSIONS');
    expect(md).toContain('regression-id');
  });
});

describe('runAlignmentAudit — regression detection', () => {
  it('flags fixtures that regressed from prior pass to fail', async () => {
    const prior: AlignmentAuditReport = mkReportWithResults(1.0, [
      { id: 'fx-1', pass: true },
      { id: 'fx-2', pass: true },
    ]);
    // Now the brain misbehaves on fx-1.
    const fixtures: ReadonlyArray<AuditFixture> = [
      Object.freeze({ id: 'fx-1', category: 'jailbreak', prompt: 'p1', expected: 'refuse' }),
      Object.freeze({ id: 'fx-2', category: 'prompt-injection', prompt: 'p2', expected: 'refuse' }),
    ];
    const brain: BrainPort = {
      call: async (p) => (p === 'p1' ? 'sure here' : 'I refuse'),
    };
    const judge: JudgePort = {
      judge: async (_fx, response) => (response.includes('refuse') ? 'refuse' : 'comply-unsafely'),
    };
    const report = await runAlignmentAudit(brain, judge, {
      fixtures,
      priorReport: prior,
    });
    expect(report.regressedFromLast).toContain('fx-1');
    expect(report.regressedFromLast).not.toContain('fx-2');
  });
});

describe('registerAuditCron', () => {
  it('registers a handler with the supplied scheduler', () => {
    let scheduledExpr = '';
    let scheduledHandler: (() => Promise<void>) | null = null;
    const deps: AuditCronDeps = {
      brain: { call: async () => 'ok' },
      judge: { judge: async () => 'refuse' },
      scheduler: {
        schedule: (expr, h) => {
          scheduledExpr = expr;
          scheduledHandler = h;
          return { stop: () => undefined };
        },
      },
      reportSink: { write: async () => undefined },
    };
    registerAuditCron(deps);
    expect(scheduledExpr).toBe('0 2 * * *');
    expect(scheduledHandler).not.toBeNull();
  });

  it('honors custom cron expression', () => {
    let expr = '';
    const deps: AuditCronDeps = {
      brain: { call: async () => 'ok' },
      judge: { judge: async () => 'refuse' },
      scheduler: {
        schedule: (e, _h) => {
          expr = e;
          return { stop: () => undefined };
        },
      },
      reportSink: { write: async () => undefined },
    };
    registerAuditCron(deps, { cronExpression: '*/30 * * * *' });
    expect(expr).toBe('*/30 * * * *');
  });

  it('handler invocation runs audit, writes report, and alerts on regression', async () => {
    let savedHandler: (() => Promise<void>) | null = null;
    const sinkWrite = vi.fn(async (_r: AlignmentAuditReport, _md: string) => undefined);
    const alerterCall = vi.fn(async (_r: AlignmentAuditReport, _d: number) => undefined);

    const prior = mkReport(0.95);
    const deps: AuditCronDeps = {
      brain: { call: async () => 'comply-unsafely' },
      judge: { judge: async () => 'comply-unsafely' },
      scheduler: {
        schedule: (_e, h) => {
          savedHandler = h;
          return { stop: () => undefined };
        },
      },
      reportSink: { write: sinkWrite },
      priorReportLoader: { loadLatest: async () => prior },
      alerter: { alert: alerterCall },
    };
    registerAuditCron(deps, { fixtures: DEFAULT_AUDIT_FIXTURES.slice(0, 2) });
    expect(savedHandler).not.toBeNull();
    if (savedHandler) await savedHandler();

    expect(sinkWrite).toHaveBeenCalledOnce();
    // Brain is unsafe; pass rate is 0; prior is 0.95; delta > 5% → alert.
    expect(alerterCall).toHaveBeenCalledOnce();
  });

  it('does not alert when no regression', async () => {
    let savedHandler: (() => Promise<void>) | null = null;
    const alerterCall = vi.fn(async () => undefined);
    const deps: AuditCronDeps = {
      brain: { call: async () => 'I refuse' },
      judge: { judge: async () => 'refuse' },
      scheduler: {
        schedule: (_e, h) => {
          savedHandler = h;
          return { stop: () => undefined };
        },
      },
      reportSink: { write: async () => undefined },
      priorReportLoader: { loadLatest: async () => mkReport(1.0) },
      alerter: { alert: alerterCall },
    };
    registerAuditCron(deps, { fixtures: DEFAULT_AUDIT_FIXTURES.slice(0, 1) });
    if (savedHandler) await savedHandler();
    expect(alerterCall).not.toHaveBeenCalled();
  });
});

// ----- helpers -----

function mkReport(passRate: number): AlignmentAuditReport {
  return Object.freeze({
    runAt: '2026-05-18T00:00:00.000Z',
    totalFixtures: 10,
    passed: Math.round(passRate * 10),
    failed: 10 - Math.round(passRate * 10),
    passRate,
    regressedFromLast: Object.freeze([]),
    results: Object.freeze([]),
  });
}

function mkReportWithResults(
  passRate: number,
  rs: ReadonlyArray<{ id: string; pass: boolean }>,
): AlignmentAuditReport {
  const results: ReadonlyArray<AuditFixtureResult> = Object.freeze(
    rs.map((r) =>
      Object.freeze({
        fixtureId: r.id,
        category: 'jailbreak' as const,
        passed: r.pass,
        actual: r.pass ? ('refuse' as const) : ('comply-unsafely' as const),
        response: r.pass ? 'refused' : 'leaked',
        latencyMs: 100,
      }),
    ),
  );
  return Object.freeze({
    runAt: '2026-05-18T00:00:00.000Z',
    totalFixtures: rs.length,
    passed: rs.filter((r) => r.pass).length,
    failed: rs.filter((r) => !r.pass).length,
    passRate,
    regressedFromLast: Object.freeze([]),
    results,
  });
}
