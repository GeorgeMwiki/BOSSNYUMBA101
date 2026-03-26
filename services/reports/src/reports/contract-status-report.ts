/**
 * Contract Status Report - Lease contract analysis
 */

import type { ReportData } from '../generators/generator.interface.js';
import type { DateRange } from './report-types.js';

export interface ContractItem {
  leaseNumber: string;
  customerName: string;
  propertyName: string;
  unitOrParcel: string;
  startDate: string;
  endDate: string;
  status: string;
  monthlyRent: number;
  currency: string;
  daysToExpiry?: number;
}

export interface ContractStatusReportData {
  dateRange: DateRange;
  totalContracts: number;
  activeCount: number;
  expiredCount: number;
  terminatedCount: number;
  expiringSoon: number;
  totalMonthlyRent: number;
  currency: string;
  contracts: ContractItem[];
  byStatus: Array<{ status: string; count: number; totalRent: number }>;
  expiringNext90Days: ContractItem[];
}

export function contractStatusReportToReportData(data: ContractStatusReportData): ReportData {
  const sections: ReportData['sections'] = [];

  sections.push({
    title: 'Contracts by Status',
    table: {
      headers: ['Status', 'Count', 'Total Rent'],
      rows: data.byStatus.map((s) => [s.status, s.count, s.totalRent]),
    },
  });

  if (data.expiringNext90Days.length > 0) {
    sections.push({
      title: 'Expiring in Next 90 Days',
      table: {
        headers: ['Lease #', 'Customer', 'Property', 'End Date', 'Days Left', 'Monthly Rent'],
        rows: data.expiringNext90Days.map((c) => [
          c.leaseNumber,
          c.customerName,
          c.propertyName,
          c.endDate,
          c.daysToExpiry ?? '',
          c.monthlyRent,
        ]),
      },
    });
  }

  sections.push({
    title: 'All Contracts',
    table: {
      headers: ['Lease #', 'Customer', 'Property', 'Unit/Parcel', 'Start', 'End', 'Status', 'Monthly Rent'],
      rows: data.contracts.map((c) => [
        c.leaseNumber,
        c.customerName,
        c.propertyName,
        c.unitOrParcel,
        c.startDate,
        c.endDate,
        c.status,
        c.monthlyRent,
      ]),
    },
  });

  return {
    sections,
    summary: {
      'Total Contracts': data.totalContracts,
      'Active': data.activeCount,
      'Expired': data.expiredCount,
      'Terminated': data.terminatedCount,
      'Expiring Soon (90 days)': data.expiringSoon,
      'Total Monthly Rent': data.totalMonthlyRent,
    },
  };
}
