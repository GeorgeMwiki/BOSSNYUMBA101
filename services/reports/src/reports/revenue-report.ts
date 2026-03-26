/**
 * Revenue Report - Income analysis across all intervals
 */

import type { ReportData } from '../generators/generator.interface.js';
import type { DateRange } from './report-types.js';

export interface RevenueLineItem {
  date: string;
  propertyName: string;
  unitOrParcel: string;
  customerName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string;
}

export interface RevenueReportData {
  dateRange: DateRange;
  interval: string;
  totalRevenue: number;
  totalInvoiced: number;
  collectionRate: number;
  currency: string;
  lineItems: RevenueLineItem[];
  byProperty: Array<{ propertyName: string; amount: number; count: number }>;
  byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
  byMonth: Array<{ month: string; invoiced: number; collected: number }>;
}

export function revenueReportToReportData(data: RevenueReportData): ReportData {
  const sections: ReportData['sections'] = [];

  sections.push({
    title: 'Revenue by Property',
    table: {
      headers: ['Property', 'Amount', 'Transactions'],
      rows: data.byProperty.map((p) => [p.propertyName, p.amount, p.count]),
    },
  });

  sections.push({
    title: 'Revenue by Payment Method',
    table: {
      headers: ['Method', 'Amount', 'Transactions'],
      rows: data.byPaymentMethod.map((m) => [m.method, m.amount, m.count]),
    },
  });

  sections.push({
    title: 'Monthly Breakdown',
    table: {
      headers: ['Month', 'Invoiced', 'Collected'],
      rows: data.byMonth.map((m) => [m.month, m.invoiced, m.collected]),
    },
  });

  sections.push({
    title: 'Transaction Details',
    table: {
      headers: ['Date', 'Property', 'Unit/Parcel', 'Customer', 'Amount', 'Method', 'Reference'],
      rows: data.lineItems.map((i) => [
        i.date,
        i.propertyName,
        i.unitOrParcel,
        i.customerName,
        i.amount,
        i.paymentMethod,
        i.reference,
      ]),
    },
  });

  return {
    sections,
    summary: {
      'Total Revenue': data.totalRevenue,
      'Total Invoiced': data.totalInvoiced,
      'Collection Rate': `${data.collectionRate.toFixed(1)}%`,
      'Currency': data.currency,
      'Interval': data.interval,
    },
  };
}
