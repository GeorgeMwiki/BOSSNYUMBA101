/**
 * payroll.compile — Compile<PayrollLedger, PayRun>
 *
 * Aggregates a period's payroll ledger into a single pay-run summary:
 * total gross, total net, statutory deductions, per-employee rows,
 * anomalies (negative net, >25% jump vs prior period, etc).
 *
 * The MD reads the pay-run, applies four-eyes review, and (under
 * `act-on-yes`) hands it off to finance for bank-rail execution.
 * payroll.compile NEVER pays — it only reports.
 */

import {
  createCompile,
  type CompilePrimitive,
  type CompileReport,
  type CompileStrategy,
} from '../../primitives/compile.js';
import type { PayrollLedgerRow } from './entities.js';

export interface PayRunSummary extends CompileReport {
  readonly perEmployee: ReadonlyArray<{
    readonly employeeId: string;
    readonly grossMinor: number;
    readonly netMinor: number;
    readonly statutoryTotalMinor: number;
  }>;
  readonly totalGrossMinor: number;
  readonly totalNetMinor: number;
  readonly totalStatutoryMinor: number;
  readonly currency: string;
}

export interface PayrollCompileStrategyOptions {
  /** A map: employeeId → prior period net (for jump detection). */
  readonly priorPeriodByEmployee?: Readonly<Record<string, number>>;
  /** Jump threshold (fraction). Defaults 0.25 (25%). */
  readonly jumpThreshold?: number;
}

export function createPayrollCompileStrategy(
  opts: PayrollCompileStrategyOptions = {},
): CompileStrategy<PayrollLedgerRow, PayRunSummary> {
  const jumpThreshold = opts.jumpThreshold ?? 0.25;
  const priorByEmp = opts.priorPeriodByEmployee ?? {};

  return {
    async compile({ inputs, window }) {
      if (inputs.length === 0) {
        return {
          title: 'Pay Run (empty)',
          window,
          aggregates: { totalEmployees: 0 },
          topN: [],
          anomalies: [],
          recommendedActions: [],
          inputsExamined: 0,
          perEmployee: [],
          totalGrossMinor: 0,
          totalNetMinor: 0,
          totalStatutoryMinor: 0,
          currency: 'XXX',
        };
      }

      const currencies = new Set(inputs.map((r) => r.currency));
      if (currencies.size > 1) {
        // The substrate currency check on Reconcile applies here too —
        // mixed currencies in one pay run is a data integrity bug.
        return {
          title: 'Pay Run REJECTED: mixed currencies',
          window,
          aggregates: {},
          topN: [],
          anomalies: [
            {
              label: 'mixed-currency',
              severity: 'critical',
              rationale: `currencies seen: ${[...currencies].join(',')}`,
            },
          ],
          recommendedActions: ['Fix currency normalisation upstream before payment'],
          inputsExamined: inputs.length,
          perEmployee: [],
          totalGrossMinor: 0,
          totalNetMinor: 0,
          totalStatutoryMinor: 0,
          currency: 'MIXED',
        };
      }

      let totalGross = 0;
      let totalNet = 0;
      let totalStat = 0;
      const perEmployee: Array<{
        employeeId: string;
        grossMinor: number;
        netMinor: number;
        statutoryTotalMinor: number;
      }> = [];
      const anomalies: Array<{
        label: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        rationale: string;
      }> = [];

      for (const r of inputs) {
        const stat = Object.values(r.statutoryDeductions).reduce(
          (s, v) => s + v,
          0,
        );
        totalGross += r.grossMinor;
        totalNet += r.netMinor;
        totalStat += stat;
        perEmployee.push({
          employeeId: r.employeeId,
          grossMinor: r.grossMinor,
          netMinor: r.netMinor,
          statutoryTotalMinor: stat,
        });

        if (r.netMinor <= 0) {
          anomalies.push({
            label: `negative-net:${r.employeeId}`,
            severity: 'critical',
            rationale: `net pay ${r.netMinor} (gross ${r.grossMinor}, statutory ${stat})`,
          });
        }

        const prior = priorByEmp[r.employeeId];
        if (prior !== undefined && prior > 0) {
          const ratio = Math.abs(r.netMinor - prior) / prior;
          if (ratio >= jumpThreshold) {
            anomalies.push({
              label: `period-jump:${r.employeeId}`,
              severity: ratio >= 0.5 ? 'high' : 'medium',
              rationale: `net moved ${(ratio * 100).toFixed(0)}% vs prior period`,
            });
          }
        }
      }

      perEmployee.sort((a, b) => b.grossMinor - a.grossMinor);

      const recommendedActions: string[] = [];
      if (anomalies.length > 0) {
        recommendedActions.push(
          `Investigate ${anomalies.length} anomalies before approving disbursement`,
        );
      }
      recommendedActions.push(
        `Four-eyes review by finance lead, then dispatch to bank rail`,
      );

      const currency = inputs[0]!.currency;

      return {
        title: `Pay Run ${currency} ${(totalNet / 100).toFixed(2)}`,
        window,
        aggregates: {
          totalEmployees: inputs.length,
          totalGrossMinor: totalGross,
          totalNetMinor: totalNet,
          totalStatutoryMinor: totalStat,
        },
        topN: perEmployee.slice(0, 5).map((p) => ({
          label: p.employeeId,
          value: p.grossMinor,
        })),
        anomalies,
        recommendedActions,
        inputsExamined: inputs.length,
        perEmployee,
        totalGrossMinor: totalGross,
        totalNetMinor: totalNet,
        totalStatutoryMinor: totalStat,
        currency,
      };
    },
  };
}

export interface PayrollCompileSubMd {
  readonly name: string;
  readonly compile: CompilePrimitive<PayrollLedgerRow, PayRunSummary>;
}

export function createPayrollCompile(
  opts: PayrollCompileStrategyOptions = {},
): PayrollCompileSubMd {
  return Object.freeze({
    name: 'payroll.compile',
    compile: createCompile<PayrollLedgerRow, PayRunSummary>({
      name: 'payroll.compile.pay-run',
      strategy: createPayrollCompileStrategy(opts),
      maxInputs: 5_000,
    }),
  });
}
