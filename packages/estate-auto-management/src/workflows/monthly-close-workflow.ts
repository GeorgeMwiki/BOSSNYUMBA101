/**
 * Monthly-close workflow generator.
 *
 * For a given month, emits the set of close tasks (rent posting,
 * vendor reconciliation, owner reporting trigger) timed against
 * the standard month-end + business-day-1 calendar.
 */

import type { WorkflowTask } from '../types.js';

export interface MonthlyCloseOptions {
  readonly year: number;
  /** 1..12 */
  readonly month: number;
  readonly assetIds: ReadonlyArray<string>;
}

const TASKS: ReadonlyArray<{ readonly offsetDaysFromMonthEnd: number; readonly desc: string }> = [
  { offsetDaysFromMonthEnd: -2, desc: 'Pre-close AR aging snapshot' },
  { offsetDaysFromMonthEnd: 0, desc: 'Month-end rent + vendor posting' },
  { offsetDaysFromMonthEnd: 1, desc: 'Bank reconciliation' },
  { offsetDaysFromMonthEnd: 3, desc: 'Owner monthly statement trigger' },
];

export function planMonthlyClose(o: MonthlyCloseOptions): WorkflowTask[] {
  const monthEnd = lastDayOfMonth(o.year, o.month);
  return o.assetIds.flatMap((assetId) =>
    TASKS.map((t) => {
      const date = new Date(monthEnd);
      date.setUTCDate(date.getUTCDate() + t.offsetDaysFromMonthEnd);
      return {
        assetId,
        type: 'monthly-close',
        scheduledFor: date.toISOString(),
        description: t.desc,
      } as WorkflowTask;
    }),
  );
}

function lastDayOfMonth(year: number, month: number): Date {
  // month is 1..12; new Date(y, m, 0) → last day of previous month
  // in local TZ, so we use UTC explicitly.
  const next = new Date(Date.UTC(year, month, 1));
  next.setUTCDate(next.getUTCDate() - 1);
  return next;
}
