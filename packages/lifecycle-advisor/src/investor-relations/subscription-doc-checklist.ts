/**
 * Subscription-doc + PPM hygiene checklist.
 *
 * Authority: PPM Standard Template (Schwabe Williamson 2024 ed.),
 * ILPA Standard Subscription Document v3.0, FinCEN AML rules
 * (USD 1 M trigger for enhanced KYC).
 */

import type {
  SubscriptionDocCheck,
  SubscriptionDocChecklistResult,
} from '../types.js';

const AML_THRESHOLD = 1_000_000;

export function runSubscriptionDocChecklist(
  inputs: Readonly<SubscriptionDocCheck>,
): SubscriptionDocChecklistResult {
  const missing: string[] = [];
  if (!inputs.hasAccreditedQuestionnaire) {
    missing.push('accredited-investor questionnaire not signed');
  }
  if (!inputs.hasSignedSubAgreement) {
    missing.push('subscription agreement not counter-signed by GP');
  }
  if (!inputs.hasW9OrW8) {
    missing.push('W-9 / W-8BEN tax form not collected');
  }
  if (!inputs.hasBadActorRep) {
    missing.push('bad-actor representation (Rule 506(d)) not present');
  }
  const amlRequired = inputs.investmentSize >= AML_THRESHOLD;
  if (amlRequired && !inputs.hasAMLKYC) {
    missing.push(`AML KYC required (investment ≥ $${AML_THRESHOLD.toLocaleString()})`);
  }
  return {
    complete: missing.length === 0,
    missing,
    amlRequired,
  };
}
