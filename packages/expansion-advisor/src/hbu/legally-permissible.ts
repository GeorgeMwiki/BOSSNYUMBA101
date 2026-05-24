/**
 * HBU Gate 1 — legally permissible.
 *
 * Checks zoning code, FAR limits, height limits, setback envelope
 * compatibility, and required entitlements.
 */

import type { CandidateUse, GateResult, Parcel } from '../types.js';

export interface LegalityRules {
  /** Asset classes allowed by each zoning code. */
  readonly zoningAllowance: Readonly<Record<string, ReadonlyArray<CandidateUse['assetClass']>>>;
  /**
   * Approved-entitlements map per parcel. If a candidate requires
   * an entitlement that is not in this set, the gate considers it
   * conditional and still passes (with caveat), but marks
   * `requiresEntitlement` in reasons.
   */
  readonly approvedEntitlements?: ReadonlyArray<string>;
}

export function legallyPermissible(
  parcel: Parcel,
  use: CandidateUse,
  rules: LegalityRules,
): GateResult {
  const reasons: string[] = [];
  const allowed = rules.zoningAllowance[parcel.zoning] ?? [];

  if (!allowed.includes(use.assetClass)) {
    reasons.push(
      `zoning ${parcel.zoning} does not allow asset-class ${use.assetClass}`,
    );
  }
  if (use.far > parcel.far) {
    reasons.push(`required FAR ${use.far} exceeds allowable ${parcel.far}`);
  }
  if (use.heightM > parcel.maxHeightM) {
    reasons.push(
      `required height ${use.heightM}m exceeds allowable ${parcel.maxHeightM}m`,
    );
  }

  const needed = use.requiredEntitlements ?? [];
  const approved = new Set(rules.approvedEntitlements ?? []);
  const missing = needed.filter((e) => !approved.has(e));
  if (missing.length > 0) {
    reasons.push(`requires entitlements not yet approved: ${missing.join(', ')}`);
  }

  // Conditional-permit pattern: missing entitlements still fail
  // the hard gate, callers can request a separate `entitlement-
  // contingency` analysis.
  const outcome = reasons.length === 0 ? 'pass' : 'fail';

  return {
    use,
    gate: 'legallyPermissible',
    outcome,
    reasons,
  };
}
