/**
 * Asset Register Report - Fixed assets with condition and occupancy
 */

import type { ReportData } from '../generators/generator.interface.js';
import type { DateRange } from './report-types.js';

export interface AssetReportItem {
  assetCode: string;
  name: string;
  type: string;
  location: string;
  currentCondition: string;
  occupancyStatus: string;
  acquisitionCost: number;
  currentBookValue: number;
  monthlyRent: number;
  customerName?: string;
}

export interface AssetRegisterReportData {
  dateRange: DateRange;
  totalAssets: number;
  occupiedCount: number;
  unoccupiedCount: number;
  totalBookValue: number;
  totalMonthlyRent: number;
  currency: string;
  assets: AssetReportItem[];
  byCondition: Array<{ condition: string; count: number }>;
  byType: Array<{ type: string; count: number; totalValue: number }>;
}

export function assetRegisterReportToReportData(data: AssetRegisterReportData): ReportData {
  const sections: ReportData['sections'] = [];

  sections.push({
    title: 'Assets by Condition',
    table: {
      headers: ['Condition', 'Count'],
      rows: data.byCondition.map((c) => [c.condition, c.count]),
    },
  });

  sections.push({
    title: 'Assets by Type',
    table: {
      headers: ['Type', 'Count', 'Total Value'],
      rows: data.byType.map((t) => [t.type, t.count, t.totalValue]),
    },
  });

  sections.push({
    title: 'Asset Register',
    table: {
      headers: ['Code', 'Name', 'Type', 'Location', 'Condition', 'Occupancy', 'Book Value', 'Monthly Rent'],
      rows: data.assets.map((a) => [
        a.assetCode,
        a.name,
        a.type,
        a.location,
        a.currentCondition,
        a.occupancyStatus,
        a.currentBookValue,
        a.monthlyRent,
      ]),
    },
  });

  return {
    sections,
    summary: {
      'Total Assets': data.totalAssets,
      'Occupied': data.occupiedCount,
      'Unoccupied': data.unoccupiedCount,
      'Total Book Value': data.totalBookValue,
      'Total Monthly Rent': data.totalMonthlyRent,
    },
  };
}
