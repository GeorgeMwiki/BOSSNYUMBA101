/**
 * Cadence engine — emits the next-run dates for a set of
 * stakeholder preferences, anchored to `referenceDate` (typically
 * "now"). Yields one entry per stakeholder.
 */

import type {
  CadencePeriod,
  ReportScheduleEntry,
  StakeholderPreference,
} from '../types.js';

export function nextRunDates(
  prefs: ReadonlyArray<StakeholderPreference>,
  referenceDate: Date = new Date(),
): ReportScheduleEntry[] {
  return prefs.map((p) => ({
    stakeholderId: p.stakeholderId,
    kind: p.kind,
    cadence: p.cadence,
    nextRun: nextRunFor(p.cadence, referenceDate),
    delivery: p.delivery,
    format: p.format,
  }));
}

function nextRunFor(cadence: CadencePeriod, ref: Date): string {
  const d = new Date(ref);
  switch (cadence) {
    case 'monthly': {
      // 1st of next month
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      return next.toISOString().slice(0, 10);
    }
    case 'quarterly': {
      const month = d.getUTCMonth();
      const nextQuarterStartMonth = Math.floor(month / 3) * 3 + 3;
      const next = new Date(Date.UTC(d.getUTCFullYear(), nextQuarterStartMonth, 1));
      return next.toISOString().slice(0, 10);
    }
    case 'yearly': {
      const next = new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1));
      return next.toISOString().slice(0, 10);
    }
  }
}
