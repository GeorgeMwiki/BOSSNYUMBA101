/**
 * Collections Report - Arrears aging and collection performance
 */

import type { ReportData } from '../generators/generator.interface.js';
import type { DateRange } from './report-types.js';

export interface ArrearsItem {
  customerName: string;
  propertyName: string;
  unitOrParcel: string;
  totalArrears: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  currency: string;
  lastPaymentDate?: string;
}

export interface CollectionsReportData {
  dateRange: DateRange;
  totalArrears: number;
  totalCollected: number;
  collectionRate: number;
  currency: string;
  arrearsItems: ArrearsItem[];
  agingBuckets: Array<{ bucket: string; amount: number; count: number; percentage: number }>;
  byProperty: Array<{ propertyName: string; totalArrears: number; customersCount: number }>;
  topDebtors: Array<{ customerName: string; totalArrears: number; daysPastDue: number }>;
}

export function collectionsReportToReportData(data: CollectionsReportData): ReportData {
  const sections: ReportData['sections'] = [];

  sections.push({
    title: 'Aging Analysis',
    table: {
      headers: ['Bucket', 'Amount', 'Accounts', 'Percentage'],
      rows: data.agingBuckets.map((b) => [
        b.bucket,
        b.amount,
        b.count,
        `${b.percentage.toFixed(1)}%`,
      ]),
    },
  });

  sections.push({
    title: 'Arrears by Property',
    table: {
      headers: ['Property', 'Total Arrears', 'Customers'],
      rows: data.byProperty.map((p) => [p.propertyName, p.totalArrears, p.customersCount]),
    },
  });

  if (data.topDebtors.length > 0) {
    sections.push({
      title: 'Top Debtors',
      table: {
        headers: ['Customer', 'Total Arrears', 'Days Past Due'],
        rows: data.topDebtors.map((d) => [d.customerName, d.totalArrears, d.daysPastDue]),
      },
    });
  }

  sections.push({
    title: 'Detailed Arrears',
    table: {
      headers: ['Customer', 'Property', 'Unit/Parcel', 'Current', '30 Days', '60 Days', '90 Days', '90+ Days', 'Total'],
      rows: data.arrearsItems.map((a) => [
        a.customerName,
        a.propertyName,
        a.unitOrParcel,
        a.current,
        a.days30,
        a.days60,
        a.days90,
        a.over90,
        a.totalArrears,
      ]),
    },
  });

  return {
    sections,
    summary: {
      'Total Arrears': data.totalArrears,
      'Total Collected': data.totalCollected,
      'Collection Rate': `${data.collectionRate.toFixed(1)}%`,
    },
  };
}
