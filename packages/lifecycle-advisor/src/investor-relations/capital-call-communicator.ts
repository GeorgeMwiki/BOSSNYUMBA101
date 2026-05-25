/**
 * Capital-call communicator — generates LP-compliant capital-call
 * messages per ILPA Capital-Call Notice Template 2024.
 *
 * Best practice:
 *  - ≥ 10 business days notice
 *  - explicit use-of-proceeds
 *  - cumulative-called as % of commitment
 *  - wire verification (anti-fraud note)
 *  - late-cure period + default consequences
 */

import type {
  CapitalCallInputs,
  CapitalCallMessage,
  CapitalCallType,
} from '../types.js';

const MIN_NOTICE_BUSINESS_DAYS = 10;

function typeHeader(t: CapitalCallType): string {
  switch (t) {
    case 'standard': return 'Capital Call Notice — Standard';
    case 'bridge': return 'Capital Call Notice — Bridge';
    case 'defaulting-lp-cure': return 'Capital Call Notice — Defaulting-LP Cure Re-Statement';
    case 'final': return 'Capital Call Notice — Final / Close-Out';
  }
}

export function buildCapitalCallMessage(
  inputs: Readonly<CapitalCallInputs>,
): CapitalCallMessage {
  const violations: string[] = [];
  if (inputs.daysNotice < MIN_NOTICE_BUSINESS_DAYS) {
    violations.push(`notice ${inputs.daysNotice} bd < ${MIN_NOTICE_BUSINESS_DAYS} bd (ILPA minimum)`);
  }
  if (inputs.callAmount <= 0) {
    violations.push('callAmount must be > 0');
  }
  if (inputs.cumulativeCalled + inputs.callAmount > inputs.totalCommitment) {
    violations.push('call would exceed total commitment');
  }
  if (!inputs.useOfProceeds || inputs.useOfProceeds.length === 0) {
    violations.push('useOfProceeds is required (ILPA hygiene)');
  }
  const cumAfter = inputs.cumulativeCalled + inputs.callAmount;
  const pctCalled = (cumAfter / inputs.totalCommitment) * 100;
  const subject = typeHeader(inputs.type);
  const body = [
    `Dear Limited Partner,`,
    ``,
    `This is a ${inputs.type} capital call of $${inputs.callAmount.toLocaleString()} (${pctCalled.toFixed(2)}% cumulative of commitment).`,
    `Use of proceeds: ${inputs.useOfProceeds}`,
    `Due: T+${inputs.daysNotice} business days.`,
    ``,
    `Cumulative called including this notice: $${cumAfter.toLocaleString()} of $${inputs.totalCommitment.toLocaleString()}.`,
    ``,
    `Wire instructions will be transmitted by separate notice and verified by phone — please confirm the wiring contact at fund admin before remitting.`,
    ``,
    `Late-payment cure period: 5 business days. Failure to fund within cure invokes default consequences per the LPA.`,
    ``,
    `Kind regards,`,
    `Fund Administration`,
  ].join('\n');
  return {
    type: inputs.type,
    subject,
    body,
    compliant: violations.length === 0,
    violations,
  };
}
