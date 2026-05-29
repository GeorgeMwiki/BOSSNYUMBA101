/**
 * Mr. Mwikila handler — payroll prep.
 *
 * Computes the monthly payroll batch for caretakers / property
 * managers / maintenance crew + overtime. Default tier is T1 —
 * payroll is money out; owner approves the batch before disbursement.
 *
 * Pure-logic shape: ports for staff-roll, attendance, and prior
 * payroll runs are injected so vitest drives every branch
 * deterministically.
 */

import type {
  MwikilaHandler,
  MwikilaHandlerProposal,
} from '../handler-runtime.js';

export interface PayrollStaffRow {
  readonly staffId: string;
  readonly fullName: string;
  readonly role: 'caretaker' | 'property_manager' | 'maintenance' | 'other';
  readonly baseSalary: number;
  readonly currencyCode: string;
  readonly hourlyOvertimeRate: number;
}

export interface AttendanceRow {
  readonly staffId: string;
  readonly hoursWorked: number;
  readonly overtimeHours: number;
}

export interface PayrollPorts {
  listActiveStaff(args: {
    readonly tenantId: string;
  }): Promise<ReadonlyArray<PayrollStaffRow>>;
  listAttendanceFor(args: {
    readonly tenantId: string;
    readonly periodStartIso: string;
    readonly periodEndIso: string;
  }): Promise<ReadonlyArray<AttendanceRow>>;
  /**
   * Returns true when a payroll batch already exists for the period.
   * The handler skips when true to avoid double-paying.
   */
  batchAlreadyExists(args: {
    readonly tenantId: string;
    readonly periodStartIso: string;
    readonly periodEndIso: string;
  }): Promise<boolean>;
}

export interface PayrollComputedRow {
  readonly staffId: string;
  readonly fullName: string;
  readonly role: PayrollStaffRow['role'];
  readonly baseSalary: number;
  readonly overtimePay: number;
  readonly totalPay: number;
  readonly currencyCode: string;
}

export function computePayrollRow(
  staff: PayrollStaffRow,
  attendance: AttendanceRow | null,
): PayrollComputedRow {
  const overtimeHours = attendance?.overtimeHours ?? 0;
  const overtimePay = staff.hourlyOvertimeRate * overtimeHours;
  return {
    staffId: staff.staffId,
    fullName: staff.fullName,
    role: staff.role,
    baseSalary: staff.baseSalary,
    overtimePay,
    totalPay: staff.baseSalary + overtimePay,
    currencyCode: staff.currencyCode,
  };
}

export function buildPayrollProposal(
  staffRows: ReadonlyArray<PayrollStaffRow>,
  attendanceRows: ReadonlyArray<AttendanceRow>,
  periodStartIso: string,
  periodEndIso: string,
): MwikilaHandlerProposal | null {
  if (staffRows.length === 0) return null;

  const attendanceByStaff = new Map<string, AttendanceRow>();
  for (const a of attendanceRows) {
    attendanceByStaff.set(a.staffId, a);
  }

  const computed = staffRows.map((s) =>
    computePayrollRow(s, attendanceByStaff.get(s.staffId) ?? null),
  );

  // Mixed-currency payrolls are tracked but reported per-currency for
  // the envelope check. We use the first row's currency for the
  // proposal-level amount field; the rail evaluates against the
  // domestic currency at runtime.
  const totalsByCurrency = new Map<string, number>();
  for (const row of computed) {
    totalsByCurrency.set(
      row.currencyCode,
      (totalsByCurrency.get(row.currencyCode) ?? 0) + row.totalPay,
    );
  }

  const firstRow = computed[0];
  if (!firstRow) return null;
  const totalForFirstCurrency =
    totalsByCurrency.get(firstRow.currencyCode) ?? 0;

  const summaryCurrencies = Array.from(totalsByCurrency.entries())
    .map(([cur, total]) => `${total.toLocaleString()} ${cur}`)
    .join(' + ');

  return {
    actionKind: 'payroll.monthly_batch_prep',
    category: 'payroll-prep',
    summary: `Prepared monthly payroll: ${summaryCurrencies} across ${computed.length} staff.`,
    summarySw: `Mshahara wa mwezi umetayarishwa: ${summaryCurrencies} kwa wafanyakazi ${computed.length}.`,
    rationale:
      `Computed base + overtime for ${computed.length} active staff over ` +
      `${periodStartIso}..${periodEndIso}. Owner reviews per-row breakdown ` +
      `then one-tap-approves disbursement.`,
    payload: {
      periodStartIso,
      periodEndIso,
      rows: computed,
      totalsByCurrency: Object.fromEntries(totalsByCurrency),
    },
    amount: totalForFirstCurrency,
    currency: firstRow.currencyCode,
    targetRelation: 'staff',
  };
}

export function createPayrollHandler(
  ports: PayrollPorts,
): MwikilaHandler {
  return Object.freeze({
    actionKind: 'payroll.monthly_batch_prep',
    category: 'payroll-prep',
    async propose({ tenantId, now }) {
      // Run on the 28th of each month for the just-finished period.
      // For tests we use a deterministic window: prev-month start ..
      // prev-month end based on `now`.
      const periodEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59),
      );
      const periodStart = new Date(
        Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1),
      );
      const periodStartIso = periodStart.toISOString();
      const periodEndIso = periodEnd.toISOString();
      const exists = await ports.batchAlreadyExists({
        tenantId,
        periodStartIso,
        periodEndIso,
      });
      if (exists) return null;
      const [staff, attendance] = await Promise.all([
        ports.listActiveStaff({ tenantId }),
        ports.listAttendanceFor({
          tenantId,
          periodStartIso,
          periodEndIso,
        }),
      ]);
      return buildPayrollProposal(staff, attendance, periodStartIso, periodEndIso);
    },
  });
}
