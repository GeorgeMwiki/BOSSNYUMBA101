/**
 * Expense reconciler — checks each opex category against
 * institutional benchmarks (BOMA EER 2024 + IREM Benchmarks 2024).
 *
 * Caller supplies T-12 actual per category; the reconciler flags
 * deviations beyond the benchmark band.
 */

import type { AssetClass, ExpenseReconciliation } from '../types.js';

export interface ExpenseLineItem {
  readonly category: string;
  readonly t12Reported: number;
  /** Benchmark unit. Defaults are USD/sqm/yr unless overridden. */
  readonly benchmarkUnit?: 'usd-per-sqm-yr' | 'pct-of-egi';
}

export interface ExpenseReconcileInputs {
  readonly assetClass: AssetClass;
  readonly nlaSqm: number;
  readonly egi: number;
  readonly items: ReadonlyArray<ExpenseLineItem>;
  /** Optional per-asset-class benchmark overrides (USD per sqm/yr). */
  readonly benchmarkOverrides?: Partial<Record<string, [number, number]>>;
}

const BENCHMARKS_MULTIFAMILY: Readonly<Record<string, [number, number]>> = {
  propertyTax: [3.5, 12.0],
  insurance: [0.8, 3.2],
  utilities: [2.5, 6.5],
  repairsMaintenance: [3.0, 7.5],
  payroll: [4.0, 10.0],
  management: [1.5, 4.0],
  marketing: [0.3, 1.0],
  reserves: [2.5, 5.0],
};

const BENCHMARKS_OFFICE: Readonly<Record<string, [number, number]>> = {
  propertyTax: [4.5, 14.0],
  insurance: [0.8, 2.5],
  utilities: [4.5, 9.0],
  repairsMaintenance: [4.0, 8.5],
  payroll: [3.5, 7.5],
  cleaning: [3.0, 6.5],
  management: [1.0, 3.0],
  marketing: [0.2, 0.8],
};

const BENCHMARKS_DEFAULT: Readonly<Record<string, [number, number]>> = {
  propertyTax: [2.0, 12.0],
  insurance: [0.5, 3.0],
  utilities: [2.0, 8.0],
  repairsMaintenance: [2.0, 8.0],
  payroll: [3.0, 10.0],
  management: [1.0, 4.0],
  marketing: [0.2, 1.0],
};

function benchmarkSet(assetClass: AssetClass): Readonly<Record<string, [number, number]>> {
  switch (assetClass) {
    case 'multifamily':
      return BENCHMARKS_MULTIFAMILY;
    case 'office':
      return BENCHMARKS_OFFICE;
    default:
      return BENCHMARKS_DEFAULT;
  }
}

export function reconcileExpenses(
  inputs: ExpenseReconcileInputs,
): ReadonlyArray<ExpenseReconciliation> {
  if (inputs.nlaSqm <= 0) {
    throw new Error('nlaSqm must be > 0');
  }
  const baseBench = benchmarkSet(inputs.assetClass);
  return inputs.items.map((item) => {
    const bench = inputs.benchmarkOverrides?.[item.category] ?? baseBench[item.category];
    if (!bench) {
      return {
        category: item.category,
        t12Reported: item.t12Reported,
        benchmarkLow: 0,
        benchmarkHigh: 0,
        redFlag: false,
        notes: 'no benchmark available — manual review required',
      };
    }
    const unitValue = item.t12Reported / inputs.nlaSqm;
    const [lo, hi] = bench;
    let redFlag = false;
    const notes: string[] = [];
    if (unitValue < lo * 0.6) {
      redFlag = true;
      notes.push(`under-reported: ${unitValue.toFixed(2)}/sqm vs benchmark ${lo}-${hi}`);
    } else if (unitValue > hi * 1.4) {
      redFlag = true;
      notes.push(`over-reported: ${unitValue.toFixed(2)}/sqm vs benchmark ${lo}-${hi}`);
    } else if (unitValue < lo) {
      notes.push(`below band: ${unitValue.toFixed(2)}/sqm vs ${lo}-${hi}`);
    } else if (unitValue > hi) {
      notes.push(`above band: ${unitValue.toFixed(2)}/sqm vs ${lo}-${hi}`);
    } else {
      notes.push('within band');
    }
    return {
      category: item.category,
      t12Reported: item.t12Reported,
      benchmarkLow: lo,
      benchmarkHigh: hi,
      redFlag,
      notes: notes.join('; '),
    };
  });
}

export const EXPENSE_BENCHMARKS = {
  multifamily: BENCHMARKS_MULTIFAMILY,
  office: BENCHMARKS_OFFICE,
  default: BENCHMARKS_DEFAULT,
} as const;
