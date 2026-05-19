import { describe, expect, it } from 'vitest';
import { createPayrollCompile } from '../verticals/bossnyumba-internal/payroll-compile.js';
import type { PayrollLedgerRow } from '../verticals/bossnyumba-internal/entities.js';
import { makeCtx } from './_helpers.js';

function row(
  employeeId: string,
  gross: number,
  net: number,
  cur = 'TZS',
  statutory: Record<string, number> = { paye: gross * 0.2 },
): PayrollLedgerRow {
  return {
    id: `r-${employeeId}`,
    employeeId,
    grossMinor: gross,
    netMinor: net,
    currency: cur,
    periodStartMs: 0,
    periodEndMs: 86_400_000 * 30,
    statutoryDeductions: statutory,
  };
}

describe('payroll.compile', () => {
  it('aggregates totals', async () => {
    const sub = createPayrollCompile();
    const { ctx } = makeCtx();
    const r = await sub.compile.run({
      inputs: [row('e1', 100_000, 80_000), row('e2', 200_000, 160_000)],
      window: { startMs: 0, endMs: 1 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.totalGrossMinor).toBe(300_000);
    expect(r.output.totalNetMinor).toBe(240_000);
  });

  it('flags negative net as critical anomaly', async () => {
    const sub = createPayrollCompile();
    const { ctx } = makeCtx();
    const r = await sub.compile.run({
      inputs: [row('e1', 100_000, -500)],
      window: { startMs: 0, endMs: 1 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.anomalies.some((a) => a.severity === 'critical')).toBe(true);
  });

  it('flags period-jump when net moves > 25%', async () => {
    const sub = createPayrollCompile({
      priorPeriodByEmployee: { e1: 100_000 },
    });
    const { ctx } = makeCtx();
    const r = await sub.compile.run({
      inputs: [row('e1', 200_000, 160_000)],
      window: { startMs: 0, endMs: 1 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.anomalies.some((a) => a.label.includes('period-jump'))).toBe(true);
  });

  it('rejects mixed-currency runs', async () => {
    const sub = createPayrollCompile();
    const { ctx } = makeCtx();
    const r = await sub.compile.run({
      inputs: [row('e1', 100_000, 80_000, 'TZS'), row('e2', 200_000, 160_000, 'USD')],
      window: { startMs: 0, endMs: 1 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.title).toMatch(/REJECTED/);
    expect(r.output.anomalies.some((a) => a.label === 'mixed-currency')).toBe(true);
  });

  it('emits empty pay-run for zero rows without crashing', async () => {
    const sub = createPayrollCompile();
    const { ctx } = makeCtx();
    const r = await sub.compile.run({
      inputs: [],
      window: { startMs: 0, endMs: 1 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.totalNetMinor).toBe(0);
  });

  it('always recommends four-eyes review', async () => {
    const sub = createPayrollCompile();
    const { ctx } = makeCtx();
    const r = await sub.compile.run({
      inputs: [row('e1', 100_000, 80_000)],
      window: { startMs: 0, endMs: 1 },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.recommendedActions.some((a) => a.includes('Four-eyes'))).toBe(true);
  });
});
