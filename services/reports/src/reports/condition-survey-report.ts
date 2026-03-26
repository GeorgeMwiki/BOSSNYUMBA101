/**
 * Condition Survey Report - Survey findings and repair estimates
 */

import type { ReportData } from '../generators/generator.interface.js';
import type { DateRange } from './report-types.js';

export interface SurveyFindingItem {
  assetCode: string;
  assetName: string;
  conditionBefore: string;
  conditionAfter: string;
  defectsCount: number;
  repairsRequired: number;
  estimatedRepairCost: number;
  priorityLevel: string;
}

export interface ConditionSurveyReportData {
  dateRange: DateRange;
  surveyTitle: string;
  financialYear: string;
  totalAssetsAssessed: number;
  totalDefectsFound: number;
  totalEstimatedRepairCost: number;
  currency: string;
  findings: SurveyFindingItem[];
  conditionDistribution: Array<{ condition: string; count: number; percentage: number }>;
  byPriority: Array<{ priority: string; count: number; totalCost: number }>;
}

export function conditionSurveyReportToReportData(data: ConditionSurveyReportData): ReportData {
  const sections: ReportData['sections'] = [];

  sections.push({
    title: 'Condition Distribution',
    table: {
      headers: ['Condition', 'Count', 'Percentage'],
      rows: data.conditionDistribution.map((c) => [
        c.condition,
        c.count,
        `${c.percentage.toFixed(1)}%`,
      ]),
    },
  });

  sections.push({
    title: 'Repairs by Priority',
    table: {
      headers: ['Priority', 'Count', 'Estimated Cost'],
      rows: data.byPriority.map((p) => [p.priority, p.count, p.totalCost]),
    },
  });

  sections.push({
    title: 'Survey Findings',
    table: {
      headers: ['Asset Code', 'Asset Name', 'Before', 'After', 'Defects', 'Repairs', 'Est. Cost', 'Priority'],
      rows: data.findings.map((f) => [
        f.assetCode,
        f.assetName,
        f.conditionBefore,
        f.conditionAfter,
        f.defectsCount,
        f.repairsRequired,
        f.estimatedRepairCost,
        f.priorityLevel,
      ]),
    },
  });

  return {
    sections,
    summary: {
      'Survey': data.surveyTitle,
      'Financial Year': data.financialYear,
      'Total Assets Assessed': data.totalAssetsAssessed,
      'Total Defects Found': data.totalDefectsFound,
      'Total Estimated Repair Cost': data.totalEstimatedRepairCost,
    },
  };
}
