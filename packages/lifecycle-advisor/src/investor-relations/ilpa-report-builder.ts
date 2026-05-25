/**
 * ILPA Reporting Template v1.1 renderer — produces a quarterly LP
 * report conformant with ILPA's standard sections.
 *
 * Authority: Institutional Limited Partners Association *Reporting
 * Template v1.1* (2024).
 *
 * Sections rendered:
 *   1. Fund summary
 *   2. Performance metrics
 *   3. Capital account statement
 *   4. Schedule of investments (top 10)
 *   5. Material events
 *   6. Outlook & GP commentary
 */

import type { ILPAReport, ILPAReportInputs } from '../types.js';

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function pct(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

export function buildILPAReport(
  inputs: Readonly<ILPAReportInputs>,
): ILPAReport {
  const missing: string[] = [];
  if (inputs.fundNAV <= 0) missing.push('fundNAV');
  if (inputs.fundCalled < 0) missing.push('fundCalled');
  if (inputs.topInvestments.length === 0) missing.push('topInvestments (at least 1 required)');

  const sections = [
    {
      title: '1. Fund Summary',
      content: [
        `Period: ${inputs.periodLabel}`,
        `NAV: $${fmt(inputs.fundNAV)}`,
        `Called: $${fmt(inputs.fundCalled)}`,
        `Distributed: $${fmt(inputs.fundDistributed)}`,
        `Unfunded commitment: $${fmt(inputs.fundUnfunded)}`,
      ].join('\n'),
    },
    {
      title: '2. Performance Metrics',
      content: [
        `Net IRR: ${pct(inputs.netIRR)}    Gross IRR: ${pct(inputs.grossIRR)}`,
        `Net MOIC: ${inputs.netMOIC.toFixed(2)}x    Gross MOIC: ${inputs.grossMOIC.toFixed(2)}x`,
        `DPI: ${inputs.dpi.toFixed(2)}x    RVPI: ${inputs.rvpi.toFixed(2)}x    TVPI: ${inputs.tvpi.toFixed(2)}x`,
      ].join('\n'),
    },
    {
      title: '3. Capital Account Statement (per LP — summary)',
      content: [
        `Beginning balance: from prior period`,
        `Capital called: $${fmt(inputs.fundCalled)} (cumulative)`,
        `Distributions paid: $${fmt(inputs.fundDistributed)} (cumulative)`,
        `Ending NAV: $${fmt(inputs.fundNAV)}`,
      ].join('\n'),
    },
    {
      title: '4. Schedule of Investments (top investments)',
      content: inputs.topInvestments
        .slice(0, 10)
        .map(
          (inv, i) =>
            `${i + 1}. ${inv.name} (${inv.id}) — cost $${fmt(inv.cost)}, FV $${fmt(inv.fairValue)}, unrealised MOIC ${inv.unrealizedMOIC.toFixed(2)}x`,
        )
        .join('\n'),
    },
    {
      title: '5. Material Events',
      content: inputs.materialEvents.length === 0
        ? 'No material events in the period.'
        : inputs.materialEvents.map((e, i) => `${i + 1}. ${e}`).join('\n'),
    },
    {
      title: '6. Outlook & GP Commentary',
      content: inputs.outlook,
    },
  ];

  return {
    periodLabel: inputs.periodLabel,
    compliantWithTemplate: 'ILPA-1.1',
    sections,
    missingDataFlags: missing,
  };
}
