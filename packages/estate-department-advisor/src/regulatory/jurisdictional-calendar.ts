/**
 * jurisdictional-calendar — per-jurisdiction filing windows.
 *
 * TZ, KE, UG, NG, RW, ZA + US fallback. Sources cited inline.
 */

import type { Jurisdiction, RegulatoryCalendarEntry } from '../types.js';

export const REGULATORY_CALENDAR: ReadonlyArray<RegulatoryCalendarEntry> = [
  // Kenya
  { id: 'KE.property-rates', jurisdiction: 'KE', filingName: 'County property rates', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '05-01', authority: 'County government', citation: 'Kenya Rating Act 2019' },
  { id: 'KE.nema-neeap', jurisdiction: 'KE', filingName: 'NEMA NEEAP self-audit', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '03-31', authority: 'NEMA', citation: 'Environmental Management & Coordination Act 1999' },
  { id: 'KE.icpak', jurisdiction: 'KE', filingName: 'ICPAK audited financials', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '06-30', authority: 'ICPAK', citation: 'ICPAK practice manual 2024' },
  { id: 'KE.kra-rental', jurisdiction: 'KE', filingName: 'KRA monthly rental income tax', cadence: 'monthly', windowOpensIso: 'month-start', windowClosesIso: '20th', authority: 'KRA', citation: 'Income Tax Act §6A' },
  { id: 'KE.land-rent', jurisdiction: 'KE', filingName: 'Annual land rent', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '04-01', authority: 'Ministry of Lands', citation: 'Lands Act 2012' },

  // Tanzania
  { id: 'TZ.property-tax', jurisdiction: 'TZ', filingName: 'TRA property tax', cadence: 'annual', windowOpensIso: '07-01', windowClosesIso: '08-31', authority: 'TRA', citation: 'Local Govt Finance Act 1982' },
  { id: 'TZ.nemc-eia', jurisdiction: 'TZ', filingName: 'NEMC EIA refresh', cadence: 'per-event', windowOpensIso: 'trigger', windowClosesIso: '5y cycle', authority: 'NEMC', citation: 'Environmental Management Act 2004' },
  { id: 'TZ.icpa', jurisdiction: 'TZ', filingName: 'ICPA Tanzania financials', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '06-30', authority: 'ICPA-T', citation: 'NBAA Auditors Act 1972' },
  { id: 'TZ.nssf', jurisdiction: 'TZ', filingName: 'NSSF monthly', cadence: 'monthly', windowOpensIso: 'month-start', windowClosesIso: '07th', authority: 'NSSF', citation: 'NSSF Act 1997' },
  { id: 'TZ.lst', jurisdiction: 'TZ', filingName: 'LST monthly', cadence: 'monthly', windowOpensIso: 'month-start', windowClosesIso: '07th', authority: 'LGA', citation: 'Local Govt Finance Act 1982' },

  // Uganda
  { id: 'UG.property-rates', jurisdiction: 'UG', filingName: 'Property rates', cadence: 'annual', windowOpensIso: '07-01', windowClosesIso: '09-30', authority: 'LG council', citation: 'Local Govt Rating Act 2005' },
  { id: 'UG.nema-eia', jurisdiction: 'UG', filingName: 'NEMA EIA renewal', cadence: 'per-event', windowOpensIso: 'trigger', windowClosesIso: '3-5y cycle', authority: 'NEMA UG', citation: 'National Environment Act 2019' },
  { id: 'UG.ura-rental', jurisdiction: 'UG', filingName: 'URA monthly rental tax', cadence: 'monthly', windowOpensIso: 'month-start', windowClosesIso: '20th', authority: 'URA', citation: 'Income Tax Act Cap 340' },
  { id: 'UG.icpau', jurisdiction: 'UG', filingName: 'ICPAU financials', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '06-30', authority: 'ICPAU', citation: 'Accountants Act 2013' },

  // Nigeria
  { id: 'NG.luc', jurisdiction: 'NG', filingName: 'Land Use Charge (Lagos)', cadence: 'annual', windowOpensIso: '07-01', windowClosesIso: '12-31', authority: 'LASG / state', citation: 'Lagos State LUC Law 2020' },
  { id: 'NG.firs-rental', jurisdiction: 'NG', filingName: 'FIRS rental withholding', cadence: 'monthly', windowOpensIso: 'month-start', windowClosesIso: '21st', authority: 'FIRS', citation: 'CITA s.81' },
  { id: 'NG.nesrea', jurisdiction: 'NG', filingName: 'NESREA environmental audit', cadence: 'per-event', windowOpensIso: 'trigger', windowClosesIso: '5y cycle', authority: 'NESREA', citation: 'NESREA Act 2007' },
  { id: 'NG.ican', jurisdiction: 'NG', filingName: 'ICAN financials', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '06-30', authority: 'ICAN', citation: 'ICAN Act 1965' },

  // Rwanda
  { id: 'RW.property-tax', jurisdiction: 'RW', filingName: 'RRA property tax', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '03-31', authority: 'RRA', citation: 'Law 75/2018' },
  { id: 'RW.rema-eia', jurisdiction: 'RW', filingName: 'REMA EIA', cadence: 'per-event', windowOpensIso: 'trigger', windowClosesIso: 'per project', authority: 'REMA', citation: 'Environment Law 2018' },
  { id: 'RW.rental-tax', jurisdiction: 'RW', filingName: 'RRA rental income tax', cadence: 'monthly', windowOpensIso: 'month-start', windowClosesIso: '15th', authority: 'RRA', citation: 'Law on Tax Procedures 2019' },
  { id: 'RW.icpar', jurisdiction: 'RW', filingName: 'ICPAR financials', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '06-30', authority: 'ICPAR', citation: 'ICPAR Act 2008' },

  // South Africa
  { id: 'ZA.municipal-rates', jurisdiction: 'ZA', filingName: 'Municipal property rates', cadence: 'monthly', windowOpensIso: 'month-start', windowClosesIso: 'last-day', authority: 'Municipality', citation: 'MPRA 2004' },
  { id: 'ZA.sars-rental', jurisdiction: 'ZA', filingName: 'SARS rental income (annual)', cadence: 'annual', windowOpensIso: '07-01', windowClosesIso: '01-31', authority: 'SARS', citation: 'Income Tax Act 58/1962' },
  { id: 'ZA.saica', jurisdiction: 'ZA', filingName: 'SAICA audited financials', cadence: 'annual', windowOpensIso: '01-01', windowClosesIso: '06-30', authority: 'SAICA', citation: 'Companies Act 71/2008' },
];

export interface UpcomingFilingsInput {
  readonly jurisdictions: ReadonlyArray<Jurisdiction>;
  readonly nowMs: number;
  readonly horizonDays: number;
}

export interface UpcomingFiling {
  readonly entry: RegulatoryCalendarEntry;
  readonly daysUntilDue: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function nextDueDateMs(entry: RegulatoryCalendarEntry, nowMs: number): number {
  const date = new Date(nowMs);
  const year = date.getUTCFullYear();
  if (entry.cadence === 'monthly') {
    // Use last day of current month as a deterministic proxy for "this period's close".
    const lastDay = new Date(Date.UTC(year, date.getUTCMonth() + 1, 0)).getTime();
    return lastDay >= nowMs ? lastDay : new Date(Date.UTC(year, date.getUTCMonth() + 2, 0)).getTime();
  }
  if (entry.cadence === 'annual') {
    const match = entry.windowClosesIso.match(/^(\d{2})-(\d{2})$/);
    if (match) {
      const month = parseInt(match[1] ?? '12', 10) - 1;
      const day = parseInt(match[2] ?? '31', 10);
      let due = Date.UTC(year, month, day);
      if (due < nowMs) due = Date.UTC(year + 1, month, day);
      return due;
    }
    return Date.UTC(year, 11, 31);
  }
  if (entry.cadence === 'quarterly') {
    const month = date.getUTCMonth();
    const nextQuarterEndMonth = month - (month % 3) + 2;
    return new Date(Date.UTC(year, nextQuarterEndMonth + 1, 0)).getTime();
  }
  if (entry.cadence === 'semi-annual') {
    const half = date.getUTCMonth() < 6 ? 5 : 11;
    return new Date(Date.UTC(year, half + 1, 0)).getTime();
  }
  // per-event: surface but no due date.
  return nowMs;
}

export function upcomingFilings(input: UpcomingFilingsInput): ReadonlyArray<UpcomingFiling> {
  const setJ = new Set(input.jurisdictions);
  return REGULATORY_CALENDAR.filter((e) => setJ.has(e.jurisdiction))
    // Skip per-event cadence — they're trigger-based, not calendar-based.
    .filter((e) => e.cadence !== 'per-event')
    .map((entry) => {
      const due = nextDueDateMs(entry, input.nowMs);
      const days = Math.round((due - input.nowMs) / MS_PER_DAY);
      return { entry, daysUntilDue: days };
    })
    .filter((u) => u.daysUntilDue <= input.horizonDays && u.daysUntilDue >= 0)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export function listEntriesByJurisdiction(j: Jurisdiction): ReadonlyArray<RegulatoryCalendarEntry> {
  return REGULATORY_CALENDAR.filter((e) => e.jurisdiction === j);
}

export const __test__ = { nextDueDateMs };
